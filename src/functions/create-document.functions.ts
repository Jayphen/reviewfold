import type * as z from 'zod'

import {
  createDocumentCommandSchema,
  type CreateDocumentResult,
  type CreateDocumentValidationIssue,
} from '#/contracts/documents/create-document'
import {
  createDocument,
  type CreateDocumentError,
  type CreateDocumentOperation,
  type RequestContext,
} from '#/server/modules/documents/application/create-document.server'

const unavailableMessage = 'Document creation is temporarily unavailable'
const ambiguousMessage =
  'Document creation may have completed. Retry with the same command ID'

export type GetRequestContext = () => Promise<RequestContext>

export interface CreateDocumentHandlerDependencies {
  getRequestContext: GetRequestContext
  createDocument?: CreateDocumentOperation
}

function getValidationField(
  issue: z.core.$ZodIssue,
): CreateDocumentValidationIssue['field'] {
  const field = issue.path[0]

  return field === 'title' || field === 'content' || field === 'commandId'
    ? field
    : 'commandId'
}

function mapCreationError(error: CreateDocumentError): CreateDocumentResult {
  switch (error.type) {
    case 'document-creation-unavailable':
      return { outcome: 'recoverable-failure', message: unavailableMessage }
    case 'document-creation-outcome-ambiguous':
      return { outcome: 'ambiguous', message: ambiguousMessage }
  }
}

export function createCreateDocumentHandler({
  getRequestContext,
  createDocument: runCreateDocument = createDocument,
}: CreateDocumentHandlerDependencies) {
  return async (input: unknown): Promise<CreateDocumentResult> => {
    const parsedCommand = createDocumentCommandSchema.safeParse(input)

    if (!parsedCommand.success) {
      return {
        outcome: 'invalid',
        issues: parsedCommand.error.issues.map((issue) => ({
          field: getValidationField(issue),
          message: issue.message,
        })),
      }
    }

    const requestContext = await getRequestContext()

    return runCreateDocument(parsedCommand.data, requestContext).match(
      ({ documentId }) => ({ outcome: 'created', documentId }),
      mapCreationError,
    )
  }
}
