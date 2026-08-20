import console from 'node:console'
import { readdir, readFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import pg from 'pg'

const migrationsDirectory = fileURLToPath(
  new URL('../infra/postgresql/migrations/', import.meta.url),
)
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run PostgreSQL migrations.')
}

const pool = new pg.Pool({
  application_name: 'reviewfold-migrations',
  connectionString,
})

try {
  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviewfold_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT transaction_timestamp()
    )
  `)

  for (const migrationName of migrationNames) {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('reviewfold-migrations'))",
      )

      const appliedMigration = await client.query(
        'SELECT 1 FROM reviewfold_migrations WHERE name = $1',
        [migrationName],
      )

      if (appliedMigration.rowCount === 0) {
        const migrationSql = await readFile(
          new URL(
            `../infra/postgresql/migrations/${migrationName}`,
            import.meta.url,
          ),
          'utf8',
        )

        await client.query(migrationSql)
        await client.query(
          'INSERT INTO reviewfold_migrations (name) VALUES ($1)',
          [migrationName],
        )
        console.log(`Applied PostgreSQL migration ${migrationName}.`)
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
} finally {
  await pool.end()
}
