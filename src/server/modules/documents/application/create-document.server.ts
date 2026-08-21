import '@tanstack/react-start/server-only'

import { type ResultAsync } from 'neverthrow'

import { type CreateDocumentCommand } from '#/contracts/documents/create-document'
import {
  persistDocument,
  type PersistDocumentError,
  type PersistDocumentInput,
  type PersistDocumentResult,
} from '#/server/modules/documents/persistence/postgresql-repository.server'

export interface RequestContext {
  actorId: string
  workspaceId: string
}

export interface CreatedDocument {
  documentId: string
}

export type CreateDocumentError =
  | { type: 'document-creation-unavailable' }
  | { type: 'document-creation-outcome-ambiguous' }

export type PersistDocumentOperation = (
  input: PersistDocumentInput,
) => ResultAsync<PersistDocumentResult, PersistDocumentError>

export type CreateDocumentOperation = (
  command: CreateDocumentCommand,
  requestContext: RequestContext,
) => ResultAsync<CreatedDocument, CreateDocumentError>

function mapPersistenceError(error: PersistDocumentError): CreateDocumentError {
  switch (error.type) {
    case 'persistence-unavailable':
      return { type: 'document-creation-unavailable' }
    case 'persistence-outcome-ambiguous':
      return { type: 'document-creation-outcome-ambiguous' }
  }
}

export function createCreateDocumentOperation(
  persist: PersistDocumentOperation,
): CreateDocumentOperation {
  return (command, requestContext) =>
    persist({
      ...command,
      actorId: requestContext.actorId,
      workspaceId: requestContext.workspaceId,
    })
      .map(({ documentId }) => ({ documentId }))
      .mapErr(mapPersistenceError)
}

export const createDocument = createCreateDocumentOperation(persistDocument)
