import { createRootRouteWithContext } from '@tanstack/react-router'

import type { RouterContext } from '#/shared/universal/query-context'
import appCss from '#/ui/design-system/styles.css?url'
import { RootDocument } from '#/ui/shell/root-document'

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'Reviewfold' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})
