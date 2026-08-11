import { createMiddleware, createStart } from '@tanstack/react-start'

import { getServerEnvironment } from '#/server/platform/environment/environment.server'

const validateServerEnvironment = createMiddleware().server(({ next }) => {
  getServerEnvironment()
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [validateServerEnvironment],
}))
