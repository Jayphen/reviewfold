import { z } from 'zod'

const mongoDbUriPattern = /^mongodb(?:\+srv)?:\/\/\S+$/
const mongoDbDatabaseNamePattern = /^[^/\\."$*<>:|?\s]+$/

const serverEnvironmentSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production'], {
    error: 'must be development, test, or production',
  }),
  MONGODB_URI: z
    .string({ error: 'is required' })
    .trim()
    .min(1, 'must not be empty')
    .regex(
      mongoDbUriPattern,
      'must be a MongoDB URI beginning with mongodb:// or mongodb+srv://',
    ),
  MONGODB_DATABASE: z
    .string({ error: 'is required' })
    .trim()
    .min(1, 'must not be empty')
    .regex(
      mongoDbDatabaseNamePattern,
      'must not contain whitespace or MongoDB database-name separators',
    ),
})

export interface ServerEnvironment {
  appEnvironment: 'development' | 'test' | 'production'
  mongodb: {
    databaseName: string
    uri: string
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
    mongodb: {
      databaseName: result.data.MONGODB_DATABASE,
      uri: result.data.MONGODB_URI,
    },
  }
}
