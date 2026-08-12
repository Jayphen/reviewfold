<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

# Project Context

## Scaffold provenance

- Generated from the TanStack React blank/base starter with the exact command:
  `npx @tanstack/cli@latest create my-tanstack-app --agent --package-manager pnpm --tailwind --deployment railway --add-ons form`
- The CLI reported that `--tailwind` is deprecated and ignored. The generated standard scaffold initially included Tailwind, but Tailwind and its demo files were intentionally removed when Astryx became the sole design system.
- Follow-up Intent commands run from the generated workspace:
  - `npx @tanstack/intent@latest install`
  - `npx @tanstack/intent@latest list`
  - `pnpm dlx @tanstack/intent@latest load @tanstack/react-start#react-start`
  - `pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/deployment`
  - `pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/execution-model`
  - `pnpm dlx @tanstack/intent@latest install`
  - `pnpm dlx @tanstack/intent@latest list`
- Astryx guidance was initialized with:
  `pnpm exec astryx init --features agents --agent codex --agent-docs-path AGENTS.md`
- Before future substantial TanStack work, list and load the most specific installed Intent skill as described above.

## Stack and integrations

- React 19 + TypeScript on TanStack Start and TanStack Router (file-based routing).
- TanStack Query is integrated through `@tanstack/react-router-ssr-query`; each router gets its own `QueryClient` from `src/shared/universal/query-context.ts`, and query state is dehydrated/hydrated across SSR.
- TanStack Form and Zod are installed for the upcoming document creation view. Build product form UI directly with Astryx primitives rather than restoring the removed generated Tailwind demo adapters.
- Astryx core with the neutral theme is the sole design system. StyleX is compiled by `@astryxdesign/build/vite`; global CSS is limited to the Astryx reset, base, and theme imports in `src/ui/design-system/styles.css`.
- Markdown read/write pipeline: `unified`, `remark-parse`, `remark-stringify`, and `remark-gfm`. Keep Markdown as the canonical stored source; parse to mdast only when validation or transformation is needed, and stringify mdast when programmatic edits must be written back.
- MongoDB 8.0.28 runs locally as a single-node `rs0` replica set through Docker Compose on Colima. The official Node.js driver is isolated behind `src/server/platform/mongodb/client.server.ts`.
- Railway deployment through the generated Nitro Node server. The Vite Nitro plugin, `build` script, and `start` script are required deployment integration points.
- pnpm is the only supported package manager. Approved native dependency builds live in `pnpm-workspace.yaml`.
- ESLint flat config handles code-quality rules, while Prettier handles formatting. `eslint-config-prettier` is last in `eslint.config.js` to disable conflicting stylistic rules. Use `pnpm format`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, or the combined `pnpm check` before merging.

## Environment and deployment

- `APP_ENV`, `MONGODB_URI`, and `MONGODB_DATABASE` are required. `.env.example` provides non-secret local defaults, the portable parser lives in `src/contracts/server-environment.ts`, and `src/server/platform/environment/environment.server.ts` reads `process.env` per request.
- Global request middleware in `src/start.ts` validates the server environment before application request handling. Tests pass isolated environment objects and must not mutate the developer's `process.env`.
- Never prefix server secrets with `VITE_`; that prefix exposes values to the browser bundle.
- TanStack Start modules and route loaders are isomorphic by default. Read server environment variables per request inside `createServerFn` handlers or another explicit server boundary, never at module scope.
- Railway setup: connect the repository, let Railpack run `pnpm build`, and start with `pnpm start` (`node .output/server/index.mjs`). Generate a public domain under Railway Networking.
- If document persistence later uses a Railway database or volume, add the service in Railway, expose its reference variable to this app, and mirror only the variable name (never a secret value) in `.env.example`.
- Local MongoDB publishes only on `127.0.0.1:27017`, advertises the same host address to host-run clients, and persists in the Docker-managed `reviewfold-mongodb-data` volume. Use `pnpm db:up`, `pnpm db:down`, and destructive `pnpm db:reset`; never commit database files.

## Architectural decisions and gotchas

- `src/routeTree.gen.ts` is generated and excluded from ESLint; never edit it manually.
- Source is split by deployment target, then feature, as documented in `src/ARCHITECTURE.md`: routes are framework adapters; UI, public server functions, portable contracts, server internals, and shared target-specific code remain separate dependency zones.
- ESLint enforces cross-target import restrictions. Server-only files under `src/server` use `.server.ts`; client-callable wrappers under `src/functions` use `.functions.ts`.
- Document reads/writes that touch MongoDB, a filesystem, or credentials must be implemented in a server function. Client forms should call mutations with `useServerFn`; invalidate the relevant TanStack Query keys or router state after successful writes.
- The shared MongoDB client caches a connection promise, resets failed attempts, supports sessions and transaction callbacks, and has an explicit test close hook. Feature collections, validators, indexes, and repositories are intentionally absent until their vertical slice.
- Generated Tailwind starter components, demo form adapters, and demo routes were removed. Do not reintroduce Tailwind or another component library.
- Astryx 0.3.0's source-build alias shadows published artifacts, so `vite.config.ts` keeps exact aliases for the core CSS exports and `@astryxdesign/theme-neutral/built` before `astryxStylex()` adds its broad source alias. The theme alias also lets Vite resolve the built theme's extensionless internal icon import during development SSR. Keep these workarounds until the upstream packages resolve their published artifacts directly.
- `@tanstack/intent list` reported two transitive versions of `@tanstack/devtools-event-client`; Intent selected the newer local version. This is currently informational.

## Next steps

1. Complete JAY-7 with the pinned runtime/toolchain, remaining smoke-test harnesses, and CI.
2. Build the JAY-6 document creation route with TanStack Form, Zod validation, and Astryx primitives.
3. Put persistence behind a validated `createServerFn` mutation; keep Markdown source canonical and invalidate relevant TanStack Query data after writes.
4. Add tests for Markdown round-tripping, form validation, and document creation before shipping the feature.

<!-- ASTRYX:START -->

Astryx v0.3.0 · 155 components
CLI: run every command as `pnpm exec astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:

1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:

- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else the xstyle prop / StyleX tokens (@astryxdesign/core/theme/tokens.stylex). No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any className=, style={{…}}, raw <div>/<span> layout, imported .css/@apply, or hardcoded #hex/px with the component or the xstyle prop + a token. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
search "<query>" find any component / hook / doc / template / block
component --list 155 components by category
template --list page + block recipes
docs <topic> color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
swizzle <Name> eject component source for deep customization
upgrade --apply run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
