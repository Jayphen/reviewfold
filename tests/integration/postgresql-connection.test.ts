import { afterAll, describe, expect, it } from 'vitest'

import {
  closePostgresPool,
  getPostgresPool,
  withPostgresTransaction,
} from '#/server/platform/postgresql/client.server'

const describeWithPostgres =
  process.env.RUN_POSTGRES_INTEGRATION === '1' ? describe : describe.skip

describeWithPostgres('local PostgreSQL', () => {
  afterAll(async () => {
    await closePostgresPool()
  })

  it('connects to the test database and reuses the pool', async () => {
    const firstPool = getPostgresPool()
    const secondPool = getPostgresPool()
    const result = await firstPool.query<{
      applicationName: string
      databaseName: string
    }>(
      `SELECT current_database() AS "databaseName",
              current_setting('application_name') AS "applicationName"`,
    )

    expect(secondPool).toBe(firstPool)
    expect(result.rows[0]).toEqual({
      applicationName: 'reviewfold',
      databaseName: 'reviewfold_test',
    })
  })

  it('rolls back failed transactions', async () => {
    await expect(
      withPostgresTransaction(async (client) => {
        await client.query('CREATE TEMP TABLE reviewfold_transaction_probe ()')
        throw new Error('rollback probe')
      }),
    ).rejects.toThrow('rollback probe')

    const result = await getPostgresPool().query<{ tableName: string | null }>(
      `SELECT to_regclass('pg_temp.reviewfold_transaction_probe') AS "tableName"`,
    )

    expect(result.rows[0]?.tableName).toBeNull()
  })
})
