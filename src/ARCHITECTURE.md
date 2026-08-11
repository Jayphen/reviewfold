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
      mongodb/               MongoDB infrastructure
  shared/
    universal/               Runtime-neutral helpers
    ui/                      Cross-feature UI helpers
    server/                  Cross-feature server-only helpers
```

## Dependency direction

- `routes` are thin, isomorphic TanStack adapters. They may compose UI modules
  and call public server functions, but never import server internals.
- `ui` may depend on `contracts`, `shared/universal`, and `shared/ui`; it never
  imports `server` or `shared/server`.
- `functions` expose the network boundary. Feature files use the
  `.functions.ts` suffix, validate with contracts, and delegate to
  `server/modules`.
- `contracts` stay portable: no UI, MongoDB, Node-only, server, or function
  imports.
- `server` owns server-only application and infrastructure code. Executable
  server-only files use the `.server.ts` suffix.
- `shared/universal` cannot depend on a deployment target. `shared/ui` and
  `shared/server` are target-specific and cannot cross-import.

Empty zones are retained with `.gitkeep` until their first real vertical
behavior exists. Do not add speculative barrel exports or empty business-module
trees.

## Enforcement

Run `pnpm boundaries` to validate this dependency graph with
[dependency-cruiser](../.dependency-cruiser.mjs). The boundary check also rejects
circular, unresolved, undeclared, and Node-only dependencies outside the server
zone. ESLint keeps the corresponding high-signal rules available in editors and
enforces the target-specific filename suffixes.
