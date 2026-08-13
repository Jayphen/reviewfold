# Reviewfold Pi workspace

Pi automatically loads project extensions from `.pi/extensions/` after the
repository is trusted. Run `/trust`, restart Pi, and use `/reload` after editing
an extension.

## Linear workflow

The `reviewfold-linear.js` extension wraps the globally installed
`@schpet/linear-cli` and uses its existing authentication. It provides:

- `/linear-start JAY-123` — confirm setting an issue to In Progress, make it the
  active issue, update the footer, and name an unnamed Pi session.
- `/linear-refresh [JAY-123]` — refresh the active issue and autocomplete cache.
- `/linear-finish [JAY-123]` — run `pnpm check`, edit and confirm a completion
  comment, post it, and mark the issue Done.
- `JAY-*` autocomplete in the editor and `/linear-start` arguments.
- `linear_workflow` — one model-callable tool with `view`, `query`, `start`,
  `update`, and `comment` actions.

Mutations always require interactive confirmation. Starting an issue does not
create or switch Git branches, so dirty worktrees remain untouched. Linear
comments are submitted through temporary Markdown files and removed afterward.

The extension infers an issue from, in order: an explicit argument, the active
session issue, or a Git branch containing `JAY-<number>`.
