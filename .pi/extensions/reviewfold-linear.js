import { Buffer } from 'node:buffer'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { StringEnum } from '@earendil-works/pi-ai'
import { Type } from 'typebox'

const ACTIVE_ISSUE_ENTRY = 'reviewfold-linear-active-issue'
const TEAM_KEY = 'JAY'
const MAX_ISSUES = 100
const MAX_OUTPUT_BYTES = 40_000
const MAX_OUTPUT_LINES = 1_000

function extractIssueIdentifier(value) {
  return value?.match(/(?:^|\/|\b)(JAY-\d+)\b/i)?.[1]?.toUpperCase()
}

function issueSummary(issue) {
  return {
    identifier: issue.identifier,
    state: issue.state?.name ?? 'Unknown',
    title: issue.title,
    url: issue.url,
  }
}

function truncateOutput(value) {
  const lines = value.split('\n')
  let output = lines.slice(0, MAX_OUTPUT_LINES).join('\n')
  let truncated = lines.length > MAX_OUTPUT_LINES

  if (Buffer.byteLength(output, 'utf8') > MAX_OUTPUT_BYTES) {
    output = Buffer.from(output, 'utf8')
      .subarray(0, MAX_OUTPUT_BYTES)
      .toString('utf8')
    truncated = true
  }

  return truncated ? `${output}\n\n[Output truncated]` : output
}

function formatCommandError(command, result) {
  const details = result.stderr.trim() || result.stdout.trim()
  return `${command} failed${details ? `: ${details}` : ` with exit code ${result.code}`}`
}

async function runLinear(pi, args, options = {}) {
  const result = await pi.exec('linear', args, {
    cwd: options.cwd,
    signal: options.signal,
    timeout: options.timeout ?? 30_000,
  })

  if (result.code !== 0) {
    throw new Error(formatCommandError(`linear ${args.join(' ')}`, result))
  }

  return result.stdout
}

async function runLinearJson(pi, args, options) {
  const output = await runLinear(pi, args, options)

  try {
    return JSON.parse(output)
  } catch {
    throw new Error(`linear ${args.join(' ')} returned invalid JSON`)
  }
}

async function viewIssue(pi, identifier, options) {
  return runLinearJson(pi, ['issue', 'view', identifier, '--json'], options)
}

async function updateIssueState(pi, identifier, state, options) {
  await runLinear(
    pi,
    ['issue', 'update', identifier, '--state', state],
    options,
  )
  return viewIssue(pi, identifier, options)
}

async function addIssueComment(pi, identifier, body, options) {
  const directory = await mkdtemp(join(tmpdir(), 'reviewfold-linear-'))
  const bodyPath = join(directory, 'comment.md')

  try {
    await writeFile(bodyPath, body, 'utf8')
    await runLinear(
      pi,
      ['issue', 'comment', 'add', identifier, '--body-file', bodyPath],
      options,
    )
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

function getPersistedIssueIdentifier(ctx) {
  const entries = ctx.sessionManager.getBranch()

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (
      entry.type === 'custom' &&
      entry.customType === ACTIVE_ISSUE_ENTRY &&
      typeof entry.data?.identifier === 'string'
    ) {
      return extractIssueIdentifier(entry.data.identifier)
    }
  }

  return undefined
}

async function getBranchIssueIdentifier(pi, cwd) {
  const result = await pi.exec('git', ['branch', '--show-current'], {
    cwd,
    timeout: 5_000,
  })

  return result.code === 0 ? extractIssueIdentifier(result.stdout) : undefined
}

function createIssueAutocompleteProvider(current, getIssues) {
  return {
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? ''
      const textBeforeCursor = line.slice(0, cursorCol)
      const match = textBeforeCursor.match(/(?:^|[\s(])(JAY-[\w-]*)$/i)

      if (!match) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options)
      }

      const token = match[1]
      const query = token.toLowerCase()
      const issues = await getIssues()

      if (options.signal.aborted || issues.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options)
      }

      const matchingIssues = issues
        .filter((issue) =>
          `${issue.identifier} ${issue.title}`.toLowerCase().includes(query),
        )
        .slice(0, 20)

      if (matchingIssues.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options)
      }

      return {
        items: matchingIssues.map((issue) => ({
          value: issue.identifier,
          label: issue.identifier,
          description: `[${issue.state?.name ?? 'Unknown'}] ${issue.title}`,
        })),
        prefix: token,
      }
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix)
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      )
    },
  }
}

async function confirmMutation(ctx, title, message) {
  if (!ctx.hasUI) {
    return false
  }

  return ctx.ui.confirm(title, message)
}

export default function reviewfoldLinear(pi) {
  let activeIssue
  let cachedIssues = []
  let issuesPromise

  const setIssueStatus = (ctx) => {
    if (!activeIssue) {
      ctx.ui.setStatus('reviewfold-linear', undefined)
      return
    }

    const text = `${activeIssue.identifier} · ${activeIssue.state}`
    ctx.ui.setStatus('reviewfold-linear', ctx.ui.theme.fg('dim', text))
  }

  const activateIssue = (issue, ctx, { persist = true } = {}) => {
    activeIssue = issueSummary(issue)
    setIssueStatus(ctx)

    if (persist) {
      pi.appendEntry(ACTIVE_ISSUE_ENTRY, {
        identifier: activeIssue.identifier,
      })
    }

    if (!pi.getSessionName()) {
      pi.setSessionName(`${activeIssue.identifier} — ${activeIssue.title}`)
    }
  }

  const loadIssues = async (ctx, { refresh = false } = {}) => {
    if (refresh) {
      issuesPromise = undefined
    }

    issuesPromise ||= runLinearJson(
      pi,
      [
        'issue',
        'query',
        '--team',
        TEAM_KEY,
        '--limit',
        String(MAX_ISSUES),
        '--json',
      ],
      { cwd: ctx.cwd },
    )
      .then((result) => {
        cachedIssues = result.nodes ?? []
        return cachedIssues
      })
      .catch((error) => {
        ctx.ui.notify(`Linear issue loading failed: ${error.message}`, 'error')
        return []
      })

    return issuesPromise
  }

  const resolveIssueIdentifier = async (value, ctx) => {
    return (
      extractIssueIdentifier(value) ??
      activeIssue?.identifier ??
      (await getBranchIssueIdentifier(pi, ctx.cwd))
    )
  }

  const requireIssueIdentifier = async (value, ctx) => {
    const identifier = await resolveIssueIdentifier(value, ctx)
    if (!identifier) {
      throw new Error(
        'Specify a JAY issue, run /linear-start, or use a branch containing JAY-<number>.',
      )
    }
    return identifier
  }

  const startIssue = async (identifier, ctx, signal) => {
    let issue = await viewIssue(pi, identifier, { cwd: ctx.cwd, signal })

    if (issue.state?.name !== 'In Progress') {
      const confirmed = await confirmMutation(
        ctx,
        `Start ${identifier}?`,
        `Set “${issue.title}” from ${issue.state?.name ?? 'Unknown'} to In Progress? No git branch will be created or switched.`,
      )
      if (!confirmed) {
        return { changed: false, issue }
      }

      issue = await updateIssueState(pi, identifier, 'In Progress', {
        cwd: ctx.cwd,
        signal,
      })
    }

    activateIssue(issue, ctx)
    issuesPromise = undefined
    return { changed: true, issue }
  }

  pi.on('session_start', async (_event, ctx) => {
    const identifier =
      getPersistedIssueIdentifier(ctx) ??
      (await getBranchIssueIdentifier(pi, ctx.cwd))

    if (identifier) {
      try {
        const issue = await viewIssue(pi, identifier, { cwd: ctx.cwd })
        activateIssue(issue, ctx, { persist: false })
      } catch (error) {
        ctx.ui.notify(`Linear issue restore failed: ${error.message}`, 'error')
      }
    }

    ctx.ui.addAutocompleteProvider((current) =>
      createIssueAutocompleteProvider(current, () => loadIssues(ctx)),
    )
    void loadIssues(ctx)
  })

  pi.on('session_shutdown', (_event, ctx) => {
    ctx.ui.setStatus('reviewfold-linear', undefined)
  })

  pi.registerCommand('linear-start', {
    description: 'Set a JAY issue In Progress and make it active',
    getArgumentCompletions: (prefix) => {
      const query = prefix.trim().toLowerCase()
      const items = cachedIssues
        .filter((issue) =>
          `${issue.identifier} ${issue.title}`.toLowerCase().includes(query),
        )
        .slice(0, 20)
        .map((issue) => ({
          value: issue.identifier,
          label: issue.identifier,
          description: `[${issue.state?.name ?? 'Unknown'}] ${issue.title}`,
        }))

      return items.length > 0 ? items : null
    },
    handler: async (args, ctx) => {
      try {
        const identifier = await requireIssueIdentifier(args, ctx)
        const { issue } = await startIssue(identifier, ctx)
        ctx.ui.notify(
          `${issue.identifier} is active · ${issue.state?.name}`,
          'info',
        )
      } catch (error) {
        ctx.ui.notify(error.message, 'error')
      }
    },
  })

  pi.registerCommand('linear-refresh', {
    description: 'Refresh the active JAY issue and autocomplete cache',
    handler: async (args, ctx) => {
      try {
        const identifier = await requireIssueIdentifier(args, ctx)
        const [issue] = await Promise.all([
          viewIssue(pi, identifier, { cwd: ctx.cwd }),
          loadIssues(ctx, { refresh: true }),
        ])
        activateIssue(issue, ctx)
        ctx.ui.notify(
          `${issue.identifier} refreshed · ${issue.state?.name}`,
          'info',
        )
      } catch (error) {
        ctx.ui.notify(error.message, 'error')
      }
    },
  })

  pi.registerCommand('linear-finish', {
    description:
      'Run checks, post a completion comment, and mark a JAY issue Done',
    handler: async (args, ctx) => {
      try {
        if (!ctx.hasUI) {
          throw new Error('/linear-finish requires interactive mode.')
        }

        const identifier = await requireIssueIdentifier(args, ctx)
        const issue = await viewIssue(pi, identifier, { cwd: ctx.cwd })

        ctx.ui.setStatus(
          'reviewfold-linear',
          ctx.ui.theme.fg('accent', `${identifier} · running pnpm check`),
        )
        const check = await pi.exec('pnpm', ['check'], {
          cwd: ctx.cwd,
          timeout: 300_000,
        })
        setIssueStatus(ctx)

        if (check.code !== 0) {
          const details = truncateOutput(
            check.stderr.trim() || check.stdout.trim(),
          )
          ctx.ui.notify(`pnpm check failed:\n${details}`, 'error')
          return
        }

        const draft = await ctx.ui.editor(
          `Completion comment for ${identifier}`,
          `Implemented ${issue.title}.\n\n## Changes\n\n- Describe the completed changes.\n\n## Verification\n\n- \`pnpm check\``,
        )
        if (!draft?.trim()) {
          ctx.ui.notify('Completion cancelled; no Linear changes made.', 'info')
          return
        }

        const confirmed = await confirmMutation(
          ctx,
          `Finish ${identifier}?`,
          'Post the edited completion comment and mark the issue Done?',
        )
        if (!confirmed) {
          ctx.ui.notify('Completion cancelled; no Linear changes made.', 'info')
          return
        }

        await addIssueComment(pi, identifier, draft.trim(), { cwd: ctx.cwd })
        const completedIssue = await updateIssueState(pi, identifier, 'Done', {
          cwd: ctx.cwd,
        })
        activateIssue(completedIssue, ctx)
        issuesPromise = undefined
        ctx.ui.notify(`${identifier} marked Done.`, 'info')
      } catch (error) {
        setIssueStatus(ctx)
        ctx.ui.notify(error.message, 'error')
      }
    },
  })

  pi.registerTool({
    name: 'linear_workflow',
    label: 'Linear Workflow',
    description:
      'View, query, start, update, or comment on Reviewfold JAY issues. Mutations require user confirmation.',
    promptSnippet:
      'View and manage Reviewfold Linear issues through a confirmation-gated workflow',
    promptGuidelines: [
      'Use linear_workflow instead of shelling out to Linear when working with Reviewfold JAY issues.',
      'Use linear_workflow mutations only when the user has asked to change Linear; every mutation still requires confirmation.',
    ],
    parameters: Type.Object({
      action: StringEnum(['view', 'query', 'start', 'update', 'comment']),
      issue: Type.Optional(
        Type.String({ description: 'Issue identifier such as JAY-24' }),
      ),
      search: Type.Optional(
        Type.String({ description: 'Full-text query for the query action' }),
      ),
      state: Type.Optional(
        Type.String({ description: 'Linear workflow state for update' }),
      ),
      comment: Type.Optional(
        Type.String({ description: 'Markdown comment body' }),
      ),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const options = { cwd: ctx.cwd, signal }

      if (params.action === 'query') {
        const args = [
          'issue',
          'query',
          '--team',
          TEAM_KEY,
          '--limit',
          String(params.limit ?? 20),
          '--json',
        ]
        if (params.search) {
          args.push('--search', params.search)
        }

        const result = await runLinearJson(pi, args, options)
        const issues = result.nodes ?? []
        const output = issues
          .map(
            (issue) =>
              `${issue.identifier} · ${issue.state?.name ?? 'Unknown'} · ${issue.title}\n${issue.url}`,
          )
          .join('\n\n')

        return {
          content: [
            {
              type: 'text',
              text: truncateOutput(output || 'No matching JAY issues.'),
            },
          ],
          details: { issues: issues.map(issueSummary) },
        }
      }

      const identifier = await requireIssueIdentifier(params.issue, ctx)

      if (params.action === 'view') {
        const issue = await viewIssue(pi, identifier, options)
        activateIssue(issue, ctx)
        return {
          content: [
            {
              type: 'text',
              text: truncateOutput(JSON.stringify(issue, null, 2)),
            },
          ],
          details: { issue },
        }
      }

      if (params.action === 'start') {
        const { changed, issue } = await startIssue(identifier, ctx, signal)
        return {
          content: [
            {
              type: 'text',
              text: changed
                ? `${identifier} is active in ${issue.state?.name}.`
                : `Start cancelled; ${identifier} was not changed.`,
            },
          ],
          details: { changed, issue: issueSummary(issue) },
        }
      }

      if (params.action === 'update') {
        if (!params.state?.trim()) {
          throw new Error('The update action requires state.')
        }
        const confirmed = await confirmMutation(
          ctx,
          `Update ${identifier}?`,
          `Set the issue state to “${params.state.trim()}”?`,
        )
        if (!confirmed) {
          return {
            content: [{ type: 'text', text: 'Update cancelled.' }],
            details: { changed: false },
          }
        }

        const issue = await updateIssueState(
          pi,
          identifier,
          params.state.trim(),
          options,
        )
        activateIssue(issue, ctx)
        issuesPromise = undefined
        return {
          content: [
            {
              type: 'text',
              text: `${identifier} updated to ${issue.state?.name}.`,
            },
          ],
          details: { changed: true, issue: issueSummary(issue) },
        }
      }

      if (!params.comment?.trim()) {
        throw new Error('The comment action requires comment.')
      }
      const confirmed = await confirmMutation(
        ctx,
        `Comment on ${identifier}?`,
        truncateOutput(params.comment.trim()),
      )
      if (!confirmed) {
        return {
          content: [{ type: 'text', text: 'Comment cancelled.' }],
          details: { changed: false },
        }
      }

      await addIssueComment(pi, identifier, params.comment.trim(), options)
      return {
        content: [{ type: 'text', text: `Comment added to ${identifier}.` }],
        details: { changed: true, identifier },
      }
    },
  })
}
