const source = '^src/'
const routes = '^src/(?:routes/|router[.]tsx$|routeTree[.]gen[.]ts$)'
const ui = '^src/ui(?:/|$)'
const functions = '^src/functions(?:/|$)'
const contracts = '^src/contracts(?:/|$)'
const server = '^src/server(?:/|$)'
const serverModules = '^src/server/modules(?:/|$)'
const serverPlatform = '^src/server/platform(?:/|$)'
const universal = '^src/shared/universal(?:/|$)'
const sharedUi = '^src/shared/ui(?:/|$)'
const sharedServer = '^src/shared/server(?:/|$)'

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      comment:
        'Keep the source dependency graph acyclic, apart from TanStack Router generated type registration.',
      from: { path: source, pathNot: '^src/routeTree[.]gen[.]ts$' },
      to: {
        circular: true,
        pathNot: '^src/routeTree[.]gen[.]ts$',
      },
    },
    {
      name: 'no-unresolved-dependencies',
      severity: 'error',
      comment: 'Every import must resolve with the project TypeScript config.',
      from: { path: source },
      to: { couldNotResolve: true },
    },
    {
      name: 'no-undeclared-dependencies',
      severity: 'error',
      comment:
        'Runtime and type dependencies must be declared in package.json.',
      from: { path: source },
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'routes-cannot-import-server-internals',
      severity: 'error',
      comment:
        'Routes are isomorphic adapters; import a public *.functions.ts module instead.',
      from: { path: routes },
      to: { path: [server, sharedServer] },
    },
    {
      name: 'ui-cannot-import-routes-or-server-internals',
      severity: 'error',
      comment:
        'UI may call public server functions, but cannot depend on routes or server-only code.',
      from: { path: ui },
      to: {
        path: '^src/(?:routes|server|shared/server)(?:/|$)',
      },
    },
    {
      name: 'shared-ui-can-only-depend-inward',
      severity: 'error',
      comment:
        'Shared UI helpers cannot depend on feature UI, adapters, or server code.',
      from: { path: sharedUi },
      to: {
        path: '^src/(?:routes|ui|functions|server|shared/server)(?:/|$)',
      },
    },
    {
      name: 'functions-cannot-import-outward-adapters-or-ui',
      severity: 'error',
      comment:
        'Server functions validate contracts and delegate inward to server modules.',
      from: { path: functions },
      to: { path: '^src/(?:routes|ui|shared/ui)(?:/|$)' },
    },
    {
      name: 'functions-cannot-import-server-platform',
      severity: 'error',
      comment:
        'Public server functions must delegate to feature modules instead of importing platform infrastructure.',
      from: { path: functions },
      to: { path: serverPlatform },
    },
    {
      name: 'contracts-must-remain-portable',
      severity: 'error',
      comment:
        'Contracts may only depend on other contracts, universal helpers, and portable packages.',
      from: { path: contracts },
      to: {
        path: '^src/(?:routes|ui|functions|server|shared/(?:ui|server))(?:/|$)',
      },
    },
    {
      name: 'contracts-cannot-import-mongodb',
      severity: 'error',
      comment: 'Database concerns belong behind the server boundary.',
      from: { path: contracts },
      to: { path: '^mongodb(?:/|$)' },
    },
    {
      name: 'server-cannot-import-outward-adapters-or-ui',
      severity: 'error',
      comment:
        'Server internals cannot depend on routes, UI, or public functions.',
      from: { path: server },
      to: { path: '^src/(?:routes|ui|functions|shared/ui)(?:/|$)' },
    },
    {
      name: 'server-platform-cannot-import-feature-modules',
      severity: 'error',
      comment:
        'Platform infrastructure is an inner server layer and cannot depend on feature modules.',
      from: { path: serverPlatform },
      to: { path: serverModules },
    },
    {
      name: 'shared-server-can-only-depend-inward',
      severity: 'error',
      comment:
        'Shared server helpers cannot depend on feature server code, adapters, or UI.',
      from: { path: sharedServer },
      to: {
        path: '^src/(?:routes|ui|functions|server|shared/ui)(?:/|$)',
      },
    },
    {
      name: 'universal-code-cannot-import-target-specific-code',
      severity: 'error',
      comment:
        'Universal helpers are the innermost layer and cannot depend on a deployment target.',
      from: { path: universal },
      to: {
        path: '^src/(?:routes|ui|functions|contracts|server|shared/(?:ui|server))(?:/|$)',
      },
    },
    {
      name: 'non-server-code-cannot-import-node-core',
      severity: 'error',
      comment: 'Keep Node-only APIs inside the server boundary.',
      from: {
        path: [routes, '^src/(?:ui|contracts|shared/(?:ui|universal))(?:/|$)'],
      },
      to: { dependencyTypes: ['core'] },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    moduleSystems: ['es6'],
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      conditionNames: ['import', 'node', 'default', 'types'],
      exportsFields: ['exports'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
