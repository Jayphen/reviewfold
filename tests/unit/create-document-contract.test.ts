import { describe, expect, it } from 'vitest'

import {
  CREATE_DOCUMENT_CONTENT_MAX_BYTES,
  CREATE_DOCUMENT_TITLE_MAX_LENGTH,
  createDocumentCommandSchema,
  createDocumentResultSchema,
  getUtf8ByteLength,
  type CreateDocumentResult,
} from '#/contracts/documents/create-document'

const validCommand = {
  commandId: '01950000-0000-7000-8000-000000000001',
  title: 'A document title',
  content: '# Introduction\n\nDocument content.',
} as const

describe('create document command contract', () => {
  it('accepts and normalizes a valid browser command', () => {
    expect(
      createDocumentCommandSchema.parse({
        ...validCommand,
        title: '  A document title  ',
        content: '# Introduction\r\n\rBody\rLast line',
      }),
    ).toEqual({
      commandId: validCommand.commandId,
      title: 'A document title',
      content: '# Introduction\n\nBody\nLast line',
    })
  })

  it.each([
    {
      name: 'an invalid command ID',
      command: { ...validCommand, commandId: 'not-a-uuid' },
      path: ['commandId'],
    },
    {
      name: 'a whitespace-only title',
      command: { ...validCommand, title: '   ' },
      path: ['title'],
    },
    {
      name: 'whitespace-only content',
      command: { ...validCommand, content: ' \n\t ' },
      path: ['content'],
    },
  ])('rejects $name', ({ command, path }) => {
    const result = createDocumentCommandSchema.safeParse(command)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      )
    }
  })

  it('enforces the title length after trimming', () => {
    expect(
      createDocumentCommandSchema.safeParse({
        ...validCommand,
        title: ` ${'a'.repeat(CREATE_DOCUMENT_TITLE_MAX_LENGTH)} `,
      }).success,
    ).toBe(true)

    expect(
      createDocumentCommandSchema.safeParse({
        ...validCommand,
        title: 'a'.repeat(CREATE_DOCUMENT_TITLE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it('enforces the content limit in UTF-8 bytes', () => {
    const fourByteCharacter = '🙂'
    const contentAtLimit = fourByteCharacter.repeat(
      CREATE_DOCUMENT_CONTENT_MAX_BYTES / 4,
    )
    const contentOverLimit = `${contentAtLimit}a`

    expect(getUtf8ByteLength(fourByteCharacter)).toBe(4)
    expect(getUtf8ByteLength(contentAtLimit)).toBe(
      CREATE_DOCUMENT_CONTENT_MAX_BYTES,
    )
    expect(
      createDocumentCommandSchema.safeParse({
        ...validCommand,
        content: contentAtLimit,
      }).success,
    ).toBe(true)
    expect(
      createDocumentCommandSchema.safeParse({
        ...validCommand,
        content: contentOverLimit,
      }).success,
    ).toBe(false)
  })

  it('rejects ownership and other fields outside the browser contract', () => {
    expect(
      createDocumentCommandSchema.safeParse({
        ...validCommand,
        actorId: 'browser-controlled-actor',
        workspaceId: 'browser-controlled-workspace',
      }).success,
    ).toBe(false)
  })
})

describe('create document result contract', () => {
  const validResults: CreateDocumentResult[] = [
    { outcome: 'created', documentId: 'document-1' },
    {
      outcome: 'invalid',
      issues: [{ field: 'title', message: 'Title must not be empty' }],
    },
    {
      outcome: 'recoverable-failure',
      message: 'Document creation is temporarily unavailable',
    },
    {
      outcome: 'ambiguous',
      message: 'The commit result could not be confirmed',
    },
  ]

  it.each(validResults)('accepts the $outcome outcome', (result) => {
    expect(createDocumentResultSchema.parse(result)).toEqual(result)
  })

  it.each([
    { outcome: 'created', documentId: '' },
    { outcome: 'invalid', issues: [] },
    { outcome: 'recoverable-failure', message: '   ' },
    { outcome: 'ambiguous', message: '' },
    { outcome: 'unknown', message: 'Not a supported outcome' },
    { outcome: 'created', documentId: 'document-1', workspaceId: 'private' },
  ])('rejects an invalid result: $outcome', (result) => {
    expect(createDocumentResultSchema.safeParse(result).success).toBe(false)
  })
})
