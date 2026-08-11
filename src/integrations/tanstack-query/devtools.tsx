import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'

export const tanstackQueryDevtoolsPlugin = {
  name: 'TanStack Query',
  render: <ReactQueryDevtoolsPanel />,
}
