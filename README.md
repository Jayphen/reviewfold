# Reviewfold

A React and TanStack Start foundation for creating, reading, and reviewing Markdown documents.

## Stack

- React 19, TypeScript, TanStack Start, and file-based TanStack Router
- TanStack Query with SSR dehydration/hydration through `@tanstack/react-router-ssr-query`
- TanStack Form and Zod for forms and validation
- Astryx core with the neutral theme and StyleX compilation
- Unified, remark parse/stringify, and GFM support for Markdown workflows
- ESLint, Prettier, dependency-cruiser, and pnpm
- Nitro Node server targeting Railway

## Getting started

```bash
pnpm install
pnpm dev
```

The development server runs at <http://localhost:3000>.

## Quality checks

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm boundaries
pnpm typecheck
pnpm test
pnpm test:unit
pnpm build
pnpm check
```

`pnpm format` writes formatting changes; CI and review workflows should use the non-mutating `pnpm format:check`. `pnpm boundaries` validates the source dependency graph with dependency-cruiser. `pnpm check` runs formatting validation, linting, dependency-boundary checks, type checking, unit tests, and the production build. The wider JAY-7 verification suite is still pending.

## Astryx

Astryx is the only UI design system. Its reset, base styles, and neutral theme are imported in `src/ui/design-system/styles.css`; StyleX compilation is configured in `vite.config.ts`.

Before implementing UI, use the installed CLI to discover supported patterns and component APIs:

```bash
pnpm exec astryx build "describe the view"
pnpm exec astryx component ComponentName
pnpm exec astryx search "interface pattern"
```

The Astryx agent guidance is installed in `AGENTS.md`. Tailwind and the generated Tailwind demo files have been removed.

## Source structure

The source tree is split by deployment target and then by feature:

- `src/routes` contains thin, isomorphic TanStack route adapters.
- `src/ui` contains the Astryx design-system setup, application shell, and
  browser-facing feature modules.
- `src/functions` is the client-callable server-function boundary.
- `src/contracts` contains portable validation and transport contracts.
- `src/server` contains server-only feature and platform implementations.
- `src/shared` contains universal, UI-only, and server-only cross-feature code.

dependency-cruiser enforces import directions, portability, resolvability, and
an acyclic source graph. ESLint provides editor-time feedback for key boundaries
and enforces the `.functions.ts` and `.server.ts` file conventions. See
[`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) for the complete dependency
contract.

## TanStack Query

A fresh `QueryClient` is created for every router instance in
`src/shared/universal/query-context.ts`. `src/router.tsx` connects it to TanStack
Router's SSR integration, which installs the React provider and handles query
dehydration and hydration. Query and Router development panels live in the UI
shell and are available through TanStack Devtools in development.

## Environment variables

Copy the documented non-secret defaults before starting the app:

```bash
cp .env.example .env
```

The server requires `APP_ENV`, `MONGODB_URI`, and `MONGODB_DATABASE`. They are
validated on every server request before application code runs; missing or
invalid values produce an error naming each affected variable and pointing back
to `.env.example`. Tests pass isolated values directly to the parser and never
depend on or mutate the developer's environment.

Never prefix server secrets with `VITE_`, because Vite exposes prefixed values
to the browser bundle. The environment accessor lives in
`src/server/platform/environment/environment.server.ts` and must not be imported
by routes or UI.

## Markdown

`unified`, `remark-parse`, `remark-stringify`, and `remark-gfm` support parsing Markdown into mdast and serializing programmatic edits back to Markdown. Markdown source remains the canonical document format.

## Railway deployment

Railway's Railpack builder detects pnpm and the package scripts automatically:

1. Push the repository to GitHub and create a Railway project from it.
2. Configure `APP_ENV`, `MONGODB_URI`, and `MONGODB_DATABASE` with Railway
   service variables or references.
3. Deploy and generate a domain under **Networking**.

Railpack runs `pnpm build` and starts the Nitro server with `pnpm start` (`node .output/server/index.mjs`).

## Active work

[JAY-7](https://linear.app/jayphen/issue/JAY-7/initialize-and-scaffold-the-reviewfold-project) tracks foundation setup. [JAY-6](https://linear.app/jayphen/issue/JAY-6/implement-document-creation-vertical-slice) is the first product vertical slice.
