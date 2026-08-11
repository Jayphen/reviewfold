import { QueryClient } from '@tanstack/react-query'

export interface RouterContext {
  queryClient: QueryClient
}

export function createRouterContext(): RouterContext {
  return {
    queryClient: new QueryClient(),
  }
}
