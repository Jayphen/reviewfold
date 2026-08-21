import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { describe, expect, it, vi } from 'vitest'

import {
  createDocumentResultSchema,
  type CreateDocumentResult,
} from '#/contracts/documents/create-document'
import { createCreateDocumentHandler } from '#/functions/create-document.functions'
import {
  type CreateDocumentOperation,
  type RequestContext,
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

function expectPortableResult(result: CreateDocumentResult) {
  expect(createDocumentResultSchema.parse(result)).toEqual(result)
  expect(result).not.toBeInstanceOf(ResultAsync)
}

describe('create document public handler', () => {
  it('returns Zod validation issues without requesting trusted context', async () => {
    const getRequestContext = vi.fn<() => Promise<RequestContext>>()
    const runCreateDocument = vi.fn<CreateDocumentOperation>()
    const handler = createCreateDocumentHandler({
      getRequestContext,
      createDocument: runCreateDocument,
    })

    const result = await handler({ ...command, title: '   ' })

    expect(result).toEqual({
      outcome: 'invalid',
      issues: [{ field: 'title', message: 'Title must not be empty' }],
    })
    expect(getRequestContext).not.toHaveBeenCalled()
    expect(runCreateDocument).not.toHaveBeenCalled()
    expectPortableResult(result)
  })

  it('uses trusted request context and returns a portable success', async () => {
    const runCreateDocument = vi.fn<CreateDocumentOperation>(() =>
      okAsync({ documentId: 'document-1' }),
    )
    const handler = createCreateDocumentHandler({
      getRequestContext: async () => requestContext,
      createDocument: runCreateDocument,
    })

    const result = await handler(command)

    expect(runCreateDocument).toHaveBeenCalledWith(command, requestContext)
    expect(result).toEqual({ outcome: 'created', documentId: 'document-1' })
    expectPortableResult(result)
  })

  it.each([
    {
      error: { type: 'document-creation-unavailable' } as const,
      expected: {
        outcome: 'recoverable-failure',
        message: 'Document creation is temporarily unavailable',
      } as const,
    },
    {
      error: { type: 'document-creation-outcome-ambiguous' } as const,
      expected: {
        outcome: 'ambiguous',
        message:
          'Document creation may have completed. Retry with the same command ID',
      } as const,
    },
  ])('maps $error.type to a portable result', async ({ error, expected }) => {
    const handler = createCreateDocumentHandler({
      getRequestContext: async () => requestContext,
      createDocument: () => errAsync(error),
    })

    const result = await handler(command)

    expect(result).toEqual(expected)
    expectPortableResult(result)
  })

  it('allows unexpected exceptions to reject the adapter call', async () => {
    const unexpectedError = new TypeError('programmer error')
    const runCreateDocument = ResultAsync.fromThrowable(
      async () => {
        throw unexpectedError
      },
      (error) => {
        throw error
      },
    ) as CreateDocumentOperation
    const handler = createCreateDocumentHandler({
      getRequestContext: async () => requestContext,
      createDocument: runCreateDocument,
    })

    await expect(handler(command)).rejects.toBe(unexpectedError)
  })
})
