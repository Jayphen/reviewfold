import { z } from 'zod'

export const CREATE_DOCUMENT_TITLE_MAX_LENGTH = 200
export const CREATE_DOCUMENT_CONTENT_MAX_BYTES = 256 * 1024

const utf8Encoder = new TextEncoder()

export function getUtf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).byteLength
}

function normalizeMarkdownSource(value: string): string {
  return value.replace(/\r\n?/g, '\n')
}

const titleSchema = z
  .string({ error: 'Title is required' })
  .trim()
  .min(1, 'Title must not be empty')
  .max(
    CREATE_DOCUMENT_TITLE_MAX_LENGTH,
    `Title must be ${CREATE_DOCUMENT_TITLE_MAX_LENGTH} characters or fewer`,
  )

const contentSchema = z
  .string({ error: 'Content is required' })
  .transform(normalizeMarkdownSource)
  .refine((content) => content.trim().length > 0, {
    message: 'Content must not be empty',
  })
  .refine(
    (content) =>
      getUtf8ByteLength(content) <= CREATE_DOCUMENT_CONTENT_MAX_BYTES,
    {
      message: `Content must be ${CREATE_DOCUMENT_CONTENT_MAX_BYTES} UTF-8 bytes or fewer`,
    },
  )

export const createDocumentCommandSchema = z.strictObject({
  commandId: z.uuid('Command ID must be a valid UUID'),
  title: titleSchema,
  content: contentSchema,
})

export type CreateDocumentCommandInput = z.input<
  typeof createDocumentCommandSchema
>

export type CreateDocumentCommand = z.output<typeof createDocumentCommandSchema>

export const createDocumentValidationIssueSchema = z.strictObject({
  field: z.enum(['commandId', 'title', 'content']),
  message: z.string().trim().min(1),
})

export type CreateDocumentValidationIssue = z.infer<
  typeof createDocumentValidationIssueSchema
>

export const createDocumentResultSchema = z.discriminatedUnion('outcome', [
  z.strictObject({
    outcome: z.literal('created'),
    documentId: z.string().trim().min(1),
  }),
  z.strictObject({
    outcome: z.literal('invalid'),
    issues: z.array(createDocumentValidationIssueSchema).min(1),
  }),
  z.strictObject({
    outcome: z.literal('recoverable-failure'),
    message: z.string().trim().min(1),
  }),
  z.strictObject({
    outcome: z.literal('ambiguous'),
    message: z.string().trim().min(1),
  }),
])

export type CreateDocumentResult = z.infer<typeof createDocumentResultSchema>
