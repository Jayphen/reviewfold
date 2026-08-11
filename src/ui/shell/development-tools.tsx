import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

const tanstackQueryDevtoolsPlugin = {
  name: 'TanStack Query',
  render: <ReactQueryDevtoolsPanel />,
}

export function DevelopmentTools() {
  return (
    <TanStackDevtools
      config={{ position: 'bottom-right' }}
      plugins={[
        {
          name: 'TanStack Router',
          render: <TanStackRouterDevtoolsPanel />,
        },
        tanstackQueryDevtoolsPlugin,
      ]}
    />
  )
}
