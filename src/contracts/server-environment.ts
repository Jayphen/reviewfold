import { z } from 'zod'

const postgresConnectionStringPattern = /^postgres(?:ql)?:\/\/\S+$/

const serverEnvironmentSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production'], {
    error: 'must be development, test, or production',
  }),
  DATABASE_URL: z
    .string({ error: 'is required' })
    .trim()
    .min(1, 'must not be empty')
    .regex(
      postgresConnectionStringPattern,
      'must be a PostgreSQL connection string beginning with postgres:// or postgresql://',
    ),
})

export interface ServerEnvironment {
  appEnvironment: 'development' | 'test' | 'production'
  postgresql: {
    connectionString: string
  }
}

export class InvalidServerEnvironmentError extends Error {
  constructor(details: ReadonlyArray<string>) {
    super(
      [
        'Invalid server environment configuration:',
        ...details.map((detail) => `- ${detail}`),
        'Copy .env.example to .env for local development and set each listed variable.',
      ].join('\n'),
    )
    this.name = 'InvalidServerEnvironmentError'
  }
}

export function parseServerEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(environment)

  if (!result.success) {
    throw new InvalidServerEnvironmentError(
      result.error.issues.map((issue) => {
        const variableName = issue.path.join('.') || 'environment'
        return `${variableName}: ${issue.message}`
      }),
    )
  }

  return {
    appEnvironment: result.data.APP_ENV,
    postgresql: {
      connectionString: result.data.DATABASE_URL,
    },
  }
}
