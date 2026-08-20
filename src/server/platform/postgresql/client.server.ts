import '@tanstack/react-start/server-only'

import { Pool, type PoolClient } from 'pg'

import { getServerEnvironment } from '#/server/platform/environment/environment.server'

const applicationName = 'reviewfold'

let postgresPool: Pool | undefined

export function getPostgresPool(): Pool {
  if (postgresPool) {
    return postgresPool
  }

  const { connectionString } = getServerEnvironment().postgresql
  const pool = new Pool({ application_name: applicationName, connectionString })

  pool.on('error', (error) => {
    console.error('Unexpected error from an idle PostgreSQL client.', error)
  })

  postgresPool = pool
  return pool
}

/**
 * Runs a unit of work on one checked-out client because PostgreSQL transactions
 * are scoped to a single connection.
 */
export async function withPostgresTransaction<Result>(
  operation: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await getPostgresPool().connect()

  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function closePostgresPool(): Promise<void> {
  const pool = postgresPool
  postgresPool = undefined

  if (!pool) {
    return
  }

  await pool.end()
}
