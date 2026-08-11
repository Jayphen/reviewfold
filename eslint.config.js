import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { builtinModules } from 'node:module'

const serverOnlyImportPatterns = [
  {
    regex:
      '^(?:#/(?:server|shared/server)(?:/|$)|(?:\\.\\.?/)+(?:.*?/)?(?:server|shared/server)(?:/|$)|.*\\.server(?:\\.[^/]*)?$)',
    message:
      'Import a public *.functions.ts adapter instead of server-only code.',
  },
]

const contractForbiddenImportPatterns = [
  ...serverOnlyImportPatterns,
  {
    regex:
      '^(?:#/(?:ui|routes|functions|shared/ui)(?:/|$)|(?:\\.\\.?/)+(?:.*?/)?(?:ui|routes|functions|shared/ui)(?:/|$)|mongodb(?:/|$)|.*\\.functions(?:\\.[^/]*)?$)',
    message: 'Contracts must remain portable across deployment targets.',
  },
]

const nodeOnlyImports = [
  ...new Set(
    builtinModules.flatMap((name) => {
      const bareName = name.replace(/^node:/, '')

      return bareName.startsWith('_') ? [] : [bareName, `node:${bareName}`]
    }),
  ),
].map((name) => ({
  name,
  message: 'Contracts cannot depend on Node-only modules.',
}))

const architecturePlugin = {
  rules: {
    'functions-file-suffix': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          suffix:
            'Client-callable server-function adapters must use the .functions.ts or .functions.tsx suffix.',
        },
      },
      create(context) {
        const filename = context.filename.replaceAll('\\', '/')

        return {
          Program(node) {
            if (
              filename.includes('/src/functions/') &&
              /\.tsx?$/.test(filename) &&
              !/\.functions\.tsx?$/.test(filename)
            ) {
              context.report({ node, messageId: 'suffix' })
            }
          },
        }
      },
    },
    'server-file-suffix': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          suffix:
            'Server-only source files must use the .server.ts or .server.tsx suffix.',
        },
      },
      create(context) {
        const filename = context.filename.replaceAll('\\', '/')

        return {
          Program(node) {
            if (
              filename.includes('/src/server/') &&
              /\.tsx?$/.test(filename) &&
              !/\.server\.tsx?$/.test(filename)
            ) {
              context.report({ node, messageId: 'suffix' })
            }
          },
        }
      },
    },
  },
}

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.tanstack/**',
      'dist/**',
      'node_modules/**',
      'src/routeTree.gen.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    plugins: {
      architecture: architecturePlugin,
    },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: serverOnlyImportPatterns },
      ],
      // TanStack file routes must export the non-component Route definition.
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/shared/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: serverOnlyImportPatterns },
      ],
    },
  },
  {
    files: ['src/contracts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeOnlyImports,
          patterns: contractForbiddenImportPatterns,
        },
      ],
    },
  },
  {
    files: ['src/functions/**/*.{ts,tsx}'],
    rules: {
      'architecture/functions-file-suffix': 'error',
    },
  },
  {
    files: ['src/server/**/*.{ts,tsx}'],
    rules: {
      'architecture/server-file-suffix': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^(?:#/(?:ui|routes|functions|shared/ui)(?:/|$)|(?:\\.\\.?/)+(?:.*?/)?(?:ui|routes|functions|shared/ui)(?:/|$))',
              message:
                'Server internals cannot depend on UI or outward adapters.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/universal/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^(?:#/(?:ui|routes|functions|server|contracts|shared/ui|shared/server)(?:/|$)|(?:\\.\\.?/)+(?:.*?/)?(?:ui|routes|functions|server|contracts|shared/ui|shared/server)(?:/|$)|.*\\.(?:server|functions)(?:\\.[^/]*)?$)',
              message:
                'Universal code cannot depend on a deployment target or outward adapter.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
)
