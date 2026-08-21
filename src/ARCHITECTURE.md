# Source boundaries

Reviewfold is organized first by deployment target, then by feature. When a
feature appears in `ui/modules`, `functions`, `contracts`, or `server/modules`,
it uses the same feature folder name in every zone. Dependencies point from
adapters toward portable contracts and server internals.

```text
src/
  routes/                    TanStack file-route adapters
  ui/
    design-system/           Astryx global stylesheet entry point
    shell/                   Application frame and root providers
    modules/<feature>/       Browser-facing feature modules
  functions/<feature>/       Client-callable createServerFn adapters
  contracts/<feature>/       Portable commands, results, and schemas
  contracts/platform/        Portable platform configuration contracts
  server/
    modules/<feature>/
      application/           Server-only orchestration
      persistence/           Feature storage and driver error mapping
    platform/
      environment/           Validated server runtime configuration
      postgresql/            PostgreSQL infrastructure
  shared/
    universal/               Runtime-neutral helpers
    ui/                      Cross-feature UI helpers
    server/                  Cross-feature server-only helpers
```

`router.tsx`, `start.ts`, and generated `routeTree.gen.ts` remain at `src/`
because they are TanStack Start entry points rather than product zones. The
Astryx CSS imports live in `ui/design-system`; the shell owns the runtime theme
provider and application frame.

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
// Allowed: public adapter delegates to an application operation.
import { createDocument } from '#/server/modules/documents/application/create-document.server'

// Rejected: public adapter bypasses the feature module.
import { getPostgresPool } from '#/server/platform/postgresql/client.server'

// Allowed: persistence uses platform infrastructure.
import { getPostgresPool } from '#/server/platform/postgresql/client.server'

// Rejected: application code imports a PostgreSQL driver type.
import { DatabaseError } from 'pg'

// Rejected: persistence depends on application orchestration.
import { createDocument } from '#/server/modules/documents/application/create-document.server'
```

Application code may depend on persistence outcomes but cannot import `pg`.
Persistence may depend on server platform code but cannot import application
code. Both sublayers remain isolated from routes, UI, public functions, and
`shared/ui`.

## Enforcement

Run `pnpm boundaries` to validate this dependency graph with
[dependency-cruiser](../.dependency-cruiser.mjs). The boundary check also rejects
circular, unresolved, undeclared, and Node-only dependencies outside the server
zone. ESLint keeps the corresponding high-signal rules available in editors,
including the allowed `ui → functions` direction and forbidden reverse import,
the application and persistence rules, and the target-specific filename
suffixes.

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

## Expected errors

Reviewfold uses `Result<T, E>` and `ResultAsync<T, E>` from `neverthrow` for
expected failures in application and infrastructure operations. Feature-local
discriminated unions define errors at each layer. Do not create a global error
class hierarchy.

- Persistence converts expected third-party failures at its boundary with an
  explicit `unknown` mapper. It may retain database-specific classification,
  but its returned errors cannot contain SQL, credentials, rows, or driver
  objects.
- Application operations translate persistence errors with `mapErr` and
  compose dependent operations with `andThen` or `orElse`.
- Public adapters consume every internal result with `match` and return only a
  portable contract or framework response. Never serialize a `Result` or
  `ResultAsync` instance to the browser.
- Programmer errors, violated invariants, impossible states, and framework
  control flow remain exceptions. Resource ownership still uses `try/finally`
  where a PostgreSQL client, pool, or similar handle must always be released.
- Do not wrap functions that cannot meaningfully fail or replace Zod validation
  issues with neverthrow errors. Avoid unsafe result unwrapping in production
  code.

Naming follows the operation. Functions return `Result<T, FeatureError>` or
`ResultAsync<T, FeatureError>`, use a small `type`-discriminated error union,
and name conversions after their boundary, such as `mapPersistenceError`.
`map` transforms success values, `mapErr` translates errors between layers,
`andThen` sequences required work, `orElse` performs typed recovery, and
`match` exhaustively consumes a result at the outward boundary.

```ts
// Persistence introduces a feature-local expected error.
function persistDocument(
  input: PersistDocumentInput,
): ResultAsync<PersistDocumentResult, PersistDocumentError>

// Application code translates it without exposing PostgreSQL details.
return persistDocument(input)
  .map(({ documentId }) => ({ documentId }))
  .mapErr(mapPersistenceError)

// The outward adapter consumes the class instance and returns plain data.
return createDocument(command, requestContext).match(
  ({ documentId }) => ({ outcome: 'created', documentId }),
  mapCreationError,
)
```

`eslint-plugin-neverthrow` 1.1.4 was evaluated but is not enabled. It depends
on legacy rule APIs including `context.parserServices` and `context.getScope`
that are incompatible with the repository's ESLint 10 setup. Focused tests and
review enforce result consumption until the plugin supports the current ESLint
API or an equivalent maintained rule is available.
