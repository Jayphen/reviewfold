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
      mongodb/               MongoDB infrastructure
  shared/
    universal/               Runtime-neutral helpers
    ui/                      Cross-feature UI helpers
    server/                  Cross-feature server-only helpers
```

## Dependency direction

```text
route → UI → public *.functions.ts adapter → server module → platform
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
- `contracts` stay portable: no UI, MongoDB, Node-only, server, or function
  imports.
- `server` owns server-only application and infrastructure code. Executable
  server-only files use the `.server.ts` suffix. Platform integrations such as
  the cached MongoDB client stay under `server/platform`; feature persistence
  belongs under the matching `server/modules` feature when it is introduced.
- `shared/universal` cannot depend on a deployment target. `shared/ui` and
  `shared/server` are target-specific and cannot cross-import.

Empty zones are retained with `.gitkeep` until their first real vertical
behavior exists. Do not add speculative barrel exports or empty business-module
trees.

## Enforcement

Run `pnpm boundaries` to validate this dependency graph with
[dependency-cruiser](../.dependency-cruiser.mjs). The boundary check also rejects
circular, unresolved, undeclared, and Node-only dependencies outside the server
zone. ESLint keeps the corresponding high-signal rules available in editors,
including the allowed `ui → functions` direction and forbidden reverse import,
and enforces the target-specific filename suffixes.

## MongoDB platform boundary

`server/platform/mongodb/client.server.ts` is the only MongoDB connection
owner. It reads validated configuration at connection time, caches one
`MongoClient` promise for the server process, clears failed attempts so they can
be retried, exposes session/transaction primitives, and can be explicitly
closed by tests. It does not own feature collections, indexes, schemas, or
repositories.

Local development runs a single `rs0` member through `compose.yaml`. The member
advertises `127.0.0.1:27017` because the application runs on the host while the
database runs inside Colima. The published port is loopback-only and persistent
state belongs to the Docker-managed `reviewfold-mongodb-data` volume rather than
the repository. The one-shot initializer keeps connection retries in a small
shell wrapper and replica-set configuration in a standalone mongosh JavaScript
file.
