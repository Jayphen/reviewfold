import { QueryClient } from '@tanstack/react-query'

export function getQueryContext() {
  return {
    queryClient: new QueryClient(),
  }
}
