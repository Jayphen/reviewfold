import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { cruise, type IConfiguration } from 'dependency-cruiser'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixtureRoot = join(workspaceRoot, 'tests/fixtures/dependency-boundaries')

let dependencyCruiserConfig: IConfiguration
const eslint = new ESLint({ cwd: workspaceRoot })

beforeAll(async () => {
  const configUrl = pathToFileURL(
    join(workspaceRoot, '.dependency-cruiser.mjs'),
  ).href
  const configModule = (await import(configUrl)) as {
    default: IConfiguration
  }

  dependencyCruiserConfig = configModule.default
})

async function getBoundaryViolations(fixtureName: string) {
  const result = await cruise(['src'], {
    ...dependencyCruiserConfig.options,
    baseDir: join(fixtureRoot, fixtureName),
    ruleSet: {
      forbidden: dependencyCruiserConfig.forbidden,
    },
    validate: true,
  })

  if (typeof result.output === 'string') {
    throw new TypeError('Expected dependency-cruiser object output')
  }

  return result.output.summary.violations
}

async function getEditorBoundaryMessages(
  fixtureName: string,
  sourcePath: string,
) {
  const source = await readFile(
    join(fixtureRoot, fixtureName, 'src', sourcePath),
    'utf8',
  )
  const [result] = await eslint.lintText(source, {
    filePath: join(workspaceRoot, 'src', sourcePath),
  })

  return result.messages.filter(
    ({ ruleId }) => ruleId === 'no-restricted-imports',
  )
}

describe('UI and server-function dependency boundaries', () => {
  it('allows UI to import a public server function', async () => {
    await expect(getBoundaryViolations('ui-to-functions')).resolves.toEqual([])
    await expect(
      getEditorBoundaryMessages('ui-to-functions', 'ui/document-form.ts'),
    ).resolves.toEqual([])
  })

  it('rejects UI imports of server internals', async () => {
    const violations = await getBoundaryViolations('ui-to-server')
    const messages = await getEditorBoundaryMessages(
      'ui-to-server',
      'ui/document-form.ts',
    )

    expect(violations).toEqual([
      expect.objectContaining({
        from: 'src/ui/document-form.ts',
        rule: expect.objectContaining({
          name: 'ui-cannot-import-routes-or-server-internals',
        }),
        to: 'src/server/modules/documents/create-document.server.ts',
      }),
    ])
    expect(messages).toEqual([
      expect.objectContaining({
        message: expect.stringContaining(
          'Import a public *.functions.ts adapter',
        ),
      }),
    ])
  })

  it('rejects server-function imports of UI', async () => {
    const violations = await getBoundaryViolations('functions-to-ui')
    const messages = await getEditorBoundaryMessages(
      'functions-to-ui',
      'functions/create-document.functions.ts',
    )

    expect(violations).toEqual([
      expect.objectContaining({
        from: 'src/functions/create-document.functions.ts',
        rule: expect.objectContaining({
          name: 'functions-cannot-import-outward-adapters-or-ui',
        }),
        to: 'src/ui/document-form.ts',
      }),
    ])
    expect(messages).toEqual([
      expect.objectContaining({
        message: expect.stringContaining(
          'Public server functions cannot depend on routes, UI, or shared UI',
        ),
      }),
    ])
  })
})

describe('server-layer dependency boundaries', () => {
  it('allows server functions to import feature modules', async () => {
    await expect(
      getBoundaryViolations('functions-to-modules'),
    ).resolves.toEqual([])
  })

  it('rejects server-function imports of platform infrastructure', async () => {
    const violations = await getBoundaryViolations('functions-to-platform')

    expect(violations).toEqual([
      expect.objectContaining({
        from: 'src/functions/create-document.functions.ts',
        rule: expect.objectContaining({
          name: 'functions-cannot-import-server-platform',
        }),
        to: 'src/server/platform/mongodb/client.server.ts',
      }),
    ])
  })

  it('allows feature modules to import platform infrastructure', async () => {
    await expect(getBoundaryViolations('modules-to-platform')).resolves.toEqual(
      [],
    )
  })

  it('rejects platform imports of feature modules', async () => {
    const violations = await getBoundaryViolations('platform-to-modules')

    expect(violations).toEqual([
      expect.objectContaining({
        from: 'src/server/platform/mongodb/client.server.ts',
        rule: expect.objectContaining({
          name: 'server-platform-cannot-import-feature-modules',
        }),
        to: 'src/server/modules/documents/create-document.server.ts',
      }),
    ])
  })
})
