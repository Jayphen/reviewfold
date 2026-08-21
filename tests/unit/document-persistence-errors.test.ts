import { DatabaseError } from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const postgres = vi.hoisted(() => ({
  getPostgresPool: vi.fn(),
  withPostgresTransaction: vi.fn(),
}))

vi.mock('#/server/platform/postgresql/client.server', () => postgres)

import { persistDocument } from '#/server/modules/documents/persistence/postgresql-repository.server'

const validInput = {
  commandId: '01950000-0000-7000-8000-000000000001',
  workspaceId: '01950000-0000-7000-8000-000000000002',
  actorId: '01950000-0000-7000-8000-000000000003',
  title: 'A document title',
  content: '# Introduction\n\nDocument content.',
} as const

function createSystemError(code: string) {
  return Object.assign(new Error(`PostgreSQL failed with ${code}`), { code })
}

function createCommandConflict() {
  const error = new DatabaseError('duplicate key', 0, 'error')
  error.code = '23505'
  error.constraint = 'documents_workspace_command_id_key'
  return error
}

describe('document persistence errors', () => {
  beforeEach(() => {
    postgres.getPostgresPool.mockReset()
    postgres.withPostgresTransaction.mockReset()
  })

  it('attempts the write without a command lookup', async () => {
    postgres.withPostgresTransaction.mockResolvedValue(undefined)

    const result = await persistDocument(validInput)

    expect(result.isOk()).toBe(true)
    expect(postgres.withPostgresTransaction).toHaveBeenCalledOnce()
    expect(postgres.getPostgresPool).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'a synchronous driver throw',
      arrange: () => {
        postgres.getPostgresPool.mockImplementation(() => {
          throw createSystemError('ECONNREFUSED')
        })
      },
    },
    {
      name: 'an asynchronous driver rejection',
      arrange: () => {
        postgres.getPostgresPool.mockReturnValue({
          query: vi.fn().mockRejectedValue(createSystemError('ECONNRESET')),
        })
      },
    },
  ])(
    'maps $name while confirming a conflict to ambiguity',
    async ({ arrange }) => {
      arrange()
      postgres.withPostgresTransaction.mockRejectedValue(
        createCommandConflict(),
      )

      const result = await persistDocument(validInput)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toEqual({ type: 'persistence-outcome-ambiguous' })
      }
    },
  )

  it('maps a transient write failure to an ambiguous outcome', async () => {
    postgres.withPostgresTransaction.mockRejectedValue(
      createSystemError('ETIMEDOUT'),
    )

    const result = await persistDocument(validInput)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toEqual({
        type: 'persistence-outcome-ambiguous',
      })
    }
  })

  it('recovers a command conflict by returning the committed document', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ documentId: 'document-1' }],
    })
    postgres.getPostgresPool.mockReturnValue({ query })
    postgres.withPostgresTransaction.mockRejectedValue(createCommandConflict())

    const result = await persistDocument(validInput)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toEqual({
        outcome: 'already-committed',
        documentId: 'document-1',
      })
    }
  })

  it('keeps unexpected exceptions outside the expected error union', async () => {
    const unexpectedError = new TypeError('programmer error')
    postgres.withPostgresTransaction.mockRejectedValue(unexpectedError)

    await expect(persistDocument(validInput)).rejects.toBe(unexpectedError)
  })
})
