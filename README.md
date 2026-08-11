# Reviewfold

A React and TanStack Start foundation for creating, reading, and reviewing Markdown documents.

## Stack

- React 19, TypeScript, TanStack Start, and file-based TanStack Router
- TanStack Query with SSR dehydration/hydration through `@tanstack/react-router-ssr-query`
- TanStack Form and Zod for forms and validation
- Astryx core with the neutral theme and StyleX compilation
- Unified, remark parse/stringify, and GFM support for Markdown workflows
- ESLint, Prettier, and pnpm
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
pnpm typecheck
pnpm build
pnpm check
```

`pnpm format` writes formatting changes; CI and review workflows should use the non-mutating `pnpm format:check`. `pnpm check` runs formatting validation, linting, type checking, and the production build. The wider JAY-7 verification suite is still pending.

## Astryx

Astryx is the only UI design system. Its reset, base styles, and neutral theme are imported in `src/styles.css`; StyleX compilation is configured in `vite.config.ts`.

Before implementing UI, use the installed CLI to discover supported patterns and component APIs:

```bash
pnpm exec astryx build "describe the view"
pnpm exec astryx component ComponentName
pnpm exec astryx search "interface pattern"
```

The Astryx agent guidance is installed in `AGENTS.md`. Tailwind and the generated Tailwind demo files have been removed.

## TanStack Query

A fresh `QueryClient` is created for every router instance in `src/integrations/tanstack-query/root-provider.ts`. `src/router.tsx` connects it to TanStack Router's SSR integration, which installs the React provider and handles query dehydration and hydration. Query and Router development panels are available through TanStack Devtools in development.

## Environment variables

No application variables are wired up yet. `.env.example` contains no secrets. JAY-7 still requires typed validation for MongoDB configuration before persistence is introduced. Never prefix server secrets with `VITE_`, because Vite exposes prefixed values to the browser.

## Markdown

`unified`, `remark-parse`, `remark-stringify`, and `remark-gfm` support parsing Markdown into mdast and serializing programmatic edits back to Markdown. Markdown source remains the canonical document format.

## Railway deployment

Railway's Railpack builder detects pnpm and the package scripts automatically:

1. Push the repository to GitHub and create a Railway project from it.
2. Add required production variables after the MongoDB environment contract exists.
3. Deploy and generate a domain under **Networking**.

Railpack runs `pnpm build` and starts the Nitro server with `pnpm start` (`node .output/server/index.mjs`).

## Active work

[JAY-7](https://linear.app/jayphen/issue/JAY-7/initialize-and-scaffold-the-reviewfold-project) tracks foundation setup. [JAY-6](https://linear.app/jayphen/issue/JAY-6/implement-document-creation-vertical-slice) is the first product vertical slice.
