import { errAsync, okAsync } from 'neverthrow'
import { describe, expect, it, vi } from 'vitest'

import {
  createCreateDocumentOperation,
  type PersistDocumentOperation,
} from '#/server/modules/documents/application/create-document.server'

const command = {
  commandId: '01950000-0000-7000-8000-000000000001',
  title: 'A document title',
  content: '# Introduction\n\nDocument content.',
} as const

const requestContext = {
  workspaceId: '01950000-0000-7000-8000-000000000002',
  actorId: '01950000-0000-7000-8000-000000000003',
} as const

describe('create document application operation', () => {
  it.each(['created', 'already-committed'] as const)(
    'maps the %s persistence outcome to creation success',
    async (outcome) => {
      const persist = vi.fn<PersistDocumentOperation>(() =>
        okAsync({ outcome, documentId: 'document-1' }),
      )
      const createDocument = createCreateDocumentOperation(persist)

      const result = await createDocument(command, requestContext)

      expect(persist).toHaveBeenCalledWith({
        ...command,
        ...requestContext,
      })
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual({ documentId: 'document-1' })
      }
    },
  )

  it.each([
    {
      persistenceError: { type: 'persistence-unavailable' } as const,
      creationError: { type: 'document-creation-unavailable' },
    },
    {
      persistenceError: {
        type: 'persistence-outcome-ambiguous',
      } as const,
      creationError: { type: 'document-creation-outcome-ambiguous' },
    },
  ])(
    'translates $persistenceError.type at the application boundary',
    async ({ persistenceError, creationError }) => {
      const persist = vi.fn<PersistDocumentOperation>(() =>
        errAsync(persistenceError),
      )
      const createDocument = createCreateDocumentOperation(persist)

      const result = await createDocument(command, requestContext)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toEqual(creationError)
      }
    },
  )

  it('does not convert unexpected exceptions into expected failures', () => {
    const unexpectedError = new TypeError('programmer error')
    const persist = vi.fn<PersistDocumentOperation>(() => {
      throw unexpectedError
    })
    const createDocument = createCreateDocumentOperation(persist)

    expect(() => createDocument(command, requestContext)).toThrow(
      unexpectedError,
    )
  })
})
