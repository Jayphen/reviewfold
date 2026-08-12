import { describe, expect, it } from 'vitest'

import {
  InvalidServerEnvironmentError,
  parseServerEnvironment,
} from '#/contracts/server-environment'
import { getServerEnvironment } from '#/server/platform/environment/environment.server'

const documentedDevelopmentEnvironment = {
  APP_ENV: 'development',
  MONGODB_DATABASE: 'reviewfold',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
} as const

const isolatedTestEnvironment = {
  APP_ENV: 'test',
  MONGODB_DATABASE: 'reviewfold_test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
} as const

describe('server environment', () => {
  it('accepts the documented development configuration', () => {
    expect(parseServerEnvironment(documentedDevelopmentEnvironment)).toEqual({
      appEnvironment: 'development',
      mongodb: {
        databaseName: 'reviewfold',
        uri: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
      },
    })
  })

  it('accepts isolated test configuration without mutating process.env', () => {
    expect(getServerEnvironment(isolatedTestEnvironment)).toEqual({
      appEnvironment: 'test',
      mongodb: {
        databaseName: 'reviewfold_test',
        uri: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
      },
    })
  })

  it('reports every missing variable with setup guidance', () => {
    expect.assertions(5)

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
        expect.stringContaining('MONGODB_URI: is required'),
      )
      expect(error).toHaveProperty(
        'message',
        expect.stringContaining('MONGODB_DATABASE: is required'),
      )
      expect(error).toHaveProperty(
        'message',
        expect.stringContaining('Copy .env.example to .env'),
      )
    }
  })

  it('rejects invalid values without echoing the MongoDB URI', () => {
    const invalidUri = 'https://username:password@example.com/database'

    expect(() =>
      parseServerEnvironment({
        APP_ENV: 'staging',
        MONGODB_DATABASE: 'reviewfold invalid',
        MONGODB_URI: invalidUri,
      }),
    ).toThrow(InvalidServerEnvironmentError)

    try {
      parseServerEnvironment({
        APP_ENV: 'staging',
        MONGODB_DATABASE: 'reviewfold invalid',
        MONGODB_URI: invalidUri,
      })
    } catch (error) {
      expect(error).toHaveProperty(
        'message',
        expect.not.stringContaining(invalidUri),
      )
    }
  })
})
