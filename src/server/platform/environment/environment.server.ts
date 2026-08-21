import '@tanstack/react-start/server-only'

import {
  parseServerEnvironment,
  type ServerEnvironment,
} from '#/contracts/platform/environment'

export function getServerEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnvironment {
  return parseServerEnvironment(environment)
}
