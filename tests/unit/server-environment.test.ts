import { describe, expect, it } from 'vitest'

import {
  InvalidServerEnvironmentError,
  parseServerEnvironment,
} from '#/contracts/server-environment'
import { getServerEnvironment } from '#/server/platform/environment/environment.server'

const documentedDevelopmentEnvironment = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://reviewfold:reviewfold@127.0.0.1:5432/reviewfold',
} as const

const isolatedTestEnvironment = {
  APP_ENV: 'test',
  DATABASE_URL:
    'postgresql://reviewfold:reviewfold@127.0.0.1:5432/reviewfold_test',
} as const

describe('server environment', () => {
  it('accepts the documented development configuration', () => {
    expect(parseServerEnvironment(documentedDevelopmentEnvironment)).toEqual({
      appEnvironment: 'development',
      postgresql: {
        connectionString:
          'postgresql://reviewfold:reviewfold@127.0.0.1:5432/reviewfold',
      },
    })
  })

  it('accepts isolated test configuration without mutating process.env', () => {
    expect(getServerEnvironment(isolatedTestEnvironment)).toEqual({
      appEnvironment: 'test',
      postgresql: {
        connectionString:
          'postgresql://reviewfold:reviewfold@127.0.0.1:5432/reviewfold_test',
      },
    })
  })

  it('reports every missing variable with setup guidance', () => {
    expect.assertions(4)

    try {
      parseServerEnvironment({})
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidServerEnvironmentError)
      expect(error).toHaveProperty(
        'message',
        expect.stringContaining(
          'APP_ENV: must be development, test, or production',
        ),
      )
      expect(error).toHaveProperty(
        'message',
        expect.stringContaining('DATABASE_URL: is required'),
      )
      expect(error).toHaveProperty(
        'message',
        expect.stringContaining('Copy .env.example to .env'),
      )
    }
  })

  it('rejects invalid values without echoing the database URL', () => {
    const invalidUrl = 'https://username:password@example.com/database'

    expect(() =>
      parseServerEnvironment({
        APP_ENV: 'staging',
        DATABASE_URL: invalidUrl,
      }),
    ).toThrow(InvalidServerEnvironmentError)

    try {
      parseServerEnvironment({
        APP_ENV: 'staging',
        DATABASE_URL: invalidUrl,
      })
    } catch (error) {
      expect(error).toHaveProperty(
        'message',
        expect.not.stringContaining(invalidUrl),
      )
    }
  })
})
