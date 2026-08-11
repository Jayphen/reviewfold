import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { astryxStylex } from '@astryxdesign/build/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

const coreRoot = fileURLToPath(
  new URL('./node_modules/@astryxdesign/core/', import.meta.url),
)
const neutralThemeRoot = fileURLToPath(
  new URL('./node_modules/@astryxdesign/theme-neutral/', import.meta.url),
)

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Keep published artifacts resolvable while Astryx compiles core TS source.
      '@astryxdesign/core/astryx.css': `${coreRoot}dist/astryx.css`,
      '@astryxdesign/core/reset.css': `${coreRoot}src/reset.css`,
      '@astryxdesign/theme-neutral/built': `${neutralThemeRoot}dist/neutral.js`,
    },
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    ...astryxStylex(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
