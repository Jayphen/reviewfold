# Reviewfold

A React and TanStack Start foundation for creating, reading, and reviewing Markdown documents.

## Stack

- React 19, TypeScript, TanStack Start, and file-based TanStack Router
- TanStack Query with SSR dehydration/hydration through `@tanstack/react-router-ssr-query`
- TanStack Form and Zod for forms and validation
- Astryx core with the neutral theme and StyleX compilation
- Unified, remark parse/stringify, and GFM support for Markdown workflows
- MongoDB Node.js driver with a local single-node replica set
- ESLint, Prettier, dependency-cruiser, and pnpm
- Nitro Node server targeting Railway

## Getting started

Prerequisites are Node.js, pnpm, [Colima](https://github.com/abiosoft/colima),
and the Docker CLI with Compose support. Start Colima and confirm that Docker is
using its context before starting the database:

```bash
colima start
docker context show
```

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm dev
```

The development server runs at <http://localhost:3000>.

## Local MongoDB

The Compose setup runs MongoDB 8.0.28 as a single-node `rs0` replica set. It
initializes idempotently, waits for a writable primary, publishes only to
`127.0.0.1:27017`, and persists data in the named
`reviewfold-mongodb-data` volume managed by Colima.

```bash
pnpm db:up       # start, initialize, and wait for the primary
pnpm db:status   # inspect container and health state
pnpm db:down     # stop containers and preserve the named volume
pnpm db:reset    # delete the named volume and start from an empty database
```

`pnpm db:reset` is destructive for local MongoDB data. The replica-set member
advertises `127.0.0.1:27017` so the host-run TanStack app can discover it after
the initial connection crosses the Colima port mapping. No database credentials
are used in this loopback-only development setup.

With the replica set running, verify the driver connection and primary state:

```bash
pnpm test:integration
```

## Quality checks

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm boundaries
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm build
pnpm check
```

`pnpm format` writes formatting changes; CI and review workflows should use the non-mutating `pnpm format:check`. `pnpm boundaries` validates the source dependency graph with dependency-cruiser. `pnpm check` runs formatting validation, linting, dependency-boundary checks, type checking, unit tests, and the production build. MongoDB integration remains opt-in because it requires the local replica set.

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

The MongoDB client lives in
`src/server/platform/mongodb/client.server.ts`. It caches one connected driver
client for the server process, exposes session and transaction primitives for
future server modules, and provides an explicit close function for tests. It
does not create collections, indexes, or feature repositories.

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
