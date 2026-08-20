# Source boundaries

Reviewfold is organized first by deployment target, then by feature. A feature
may have matching folders across `ui/modules`, `functions`, `contracts`, and
`server/modules`, but dependencies always point from adapters toward portable
contracts and server internals.

```text
src/
  routes/                    TanStack file-route adapters
  ui/
    design-system/           Astryx setup and app-level design tokens
    shell/                   Application frame and root providers
    modules/                 Browser-facing feature modules
  functions/                 Client-callable createServerFn adapters
  contracts/                 Portable commands, results, and schemas
  server/
    modules/                 Server-only feature application code
    platform/
      environment/           Validated server runtime configuration
      postgresql/            PostgreSQL infrastructure
  shared/
    universal/               Runtime-neutral helpers
    ui/                      Cross-feature UI helpers
    server/                  Cross-feature server-only helpers
```

## Dependency direction

```text
routes ──→ UI ──→ functions ──→ server/modules ──→ server/platform
  │                   │                 │
  └───────────────────┴──→ contracts ←─┘
```

- `routes` are thin, isomorphic TanStack composition adapters. They compose UI
  modules and may call public server functions for route data, but never import
  server internals. User-initiated mutations remain owned by the UI module.
- `ui` may depend on public modules in `functions`, plus `contracts`,
  `shared/universal`, and `shared/ui`. UI modules call server mutations with
  `useServerFn`; they never import `server` or `shared/server`.
- `functions` expose the network boundary. Feature files use the
  `.functions.ts` suffix, validate with contracts, and delegate to
  `server/modules`. They cannot depend back on routes or UI.
- `contracts` stay portable: no UI, database driver, Node-only, server, or
  function
  imports.
- `server` owns server-only application and infrastructure code. Executable
  server-only files use the `.server.ts` suffix. Platform integrations such as
  the cached PostgreSQL pool stays under `server/platform`; feature persistence
  belongs under the matching `server/modules` feature when it is introduced.
- `shared/universal` cannot depend on a deployment target. `shared/ui` and
  `shared/server` are target-specific and cannot cross-import.

Empty zones are retained with `.gitkeep` until their first real vertical
behavior exists. Do not add speculative barrel exports or empty business-module
trees.

Within the server boundary, imports follow one direction:

```ts
// Allowed: public adapter delegates to a feature operation.
import { createDocument } from '#/server/modules/documents/create-document.server'

// Rejected: public adapter bypasses the feature module.
import { getPostgresPool } from '#/server/platform/postgresql/client.server'

// Allowed: feature code uses infrastructure.
import { getPostgresPool } from '#/server/platform/postgresql/client.server'

// Rejected: infrastructure depends on feature behavior.
import { createDocument } from '#/server/modules/documents/create-document.server'
```

Both server sublayers also remain isolated from routes, UI, public functions,
and `shared/ui`.

## Enforcement

Run `pnpm boundaries` to validate this dependency graph with
[dependency-cruiser](../.dependency-cruiser.mjs). The boundary check also rejects
circular, unresolved, undeclared, and Node-only dependencies outside the server
zone. ESLint keeps the corresponding high-signal rules available in editors,
including the allowed `ui → functions` direction and forbidden reverse import,
and enforces the target-specific filename suffixes.

Run `pnpm boundaries:graph` to write the current source dependencies as a
boundary-level Mermaid graph in `architecture-boundaries.mmd`. The graph
collapses files into the documented route, UI, function, contract, server, and
shared zones and excludes the generated route tree; it visualizes actual
imports, while this document remains the source of truth for allowed dependency
directions.

## PostgreSQL platform boundary

`server/platform/postgresql/client.server.ts` is the only PostgreSQL connection
owner. It reads validated configuration when the pool is first requested,
caches one `pg.Pool` for the server process, exposes a transaction helper that
keeps each transaction on one checked-out client, and can be explicitly closed
by tests. It does not own feature tables, indexes, migrations, or repositories.
Feature persistence stays under the matching `server/modules` feature and uses
the supplied transaction client rather than acquiring another connection.

Local development runs PostgreSQL 18.4 through `compose.yaml`. It publishes only
to `127.0.0.1:5432`, persists state in the Docker-managed
`reviewfold-postgresql-data` volume, and creates a separate `reviewfold_test`
database during first-time initialization. Product schema changes belong in
explicit migrations rather than request handling or container startup scripts.
Versioned product migrations live under `infra/postgresql/migrations` and run
with `pnpm db:migrate`; applied filenames are recorded in
`reviewfold_migrations`. Document schema and transaction decisions are captured
in [ADR 0001](../docs/adr/0001-document-persistence.md).
