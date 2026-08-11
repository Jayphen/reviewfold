import type { ReactNode } from 'react'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import { HeadContent, Scripts } from '@tanstack/react-router'

import { DevelopmentTools } from '#/ui/shell/development-tools'

export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {import.meta.env.DEV ? (
          <>
            <script type="module" src="/@id/virtual:stylex:runtime" />
          </>
        ) : null}
        <HeadContent />
      </head>
      <body>
        <Theme theme={neutralTheme} mode="system">
          <AppShell contentPadding={6} height="auto" variant="wash">
            {children}
          </AppShell>
          <DevelopmentTools />
        </Theme>
        <Scripts />
      </body>
    </html>
  )
}
