import '@tanstack/react-start/server-only'

import { randomUUID } from 'node:crypto'

import {
  getPostgresPool,
  withPostgresTransaction,
} from '#/server/platform/postgresql/client.server'

const uniqueViolationSqlState = '23505'
const commandIdConstraint = 'documents_workspace_command_id_key'

export interface PersistDocumentInput {
  commandId: string
  title: string
  content: string
  workspaceId: string
  actorId: string
}

export type PersistDocumentResult =
  | { outcome: 'created'; documentId: string }
  | { outcome: 'already-committed'; documentId: string }

interface DocumentIdRow {
  documentId: string
}

function isCommandIdConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === uniqueViolationSqlState &&
    'constraint' in error &&
    error.constraint === commandIdConstraint
  )
}

async function findDocumentIdByCommand(
  workspaceId: string,
  commandId: string,
): Promise<string | undefined> {
  const result = await getPostgresPool().query<DocumentIdRow>(
    `SELECT id AS "documentId"
       FROM documents
      WHERE workspace_id = $1
        AND command_id = $2`,
    [workspaceId, commandId],
  )

  return result.rows[0]?.documentId
}

export async function persistDocument(
  input: PersistDocumentInput,
): Promise<PersistDocumentResult> {
  const existingDocumentId = await findDocumentIdByCommand(
    input.workspaceId,
    input.commandId,
  )

  if (existingDocumentId) {
    return { outcome: 'already-committed', documentId: existingDocumentId }
  }

  const documentId = randomUUID()
  const revisionId = randomUUID()

  try {
    await withPostgresTransaction(async (client) => {
      await client.query(
        `INSERT INTO documents (
           id,
           workspace_id,
           created_by_actor_id,
           command_id,
           current_revision_id,
           current_revision_number
         ) VALUES ($1, $2, $3, $4, $5, 1)`,
        [
          documentId,
          input.workspaceId,
          input.actorId,
          input.commandId,
          revisionId,
        ],
      )

      await client.query(
        `INSERT INTO document_revisions (
           id,
           document_id,
           revision_number,
           title,
           markdown_source,
           created_by_actor_id
         ) VALUES ($1, $2, 1, $3, $4, $5)`,
        [revisionId, documentId, input.title, input.content, input.actorId],
      )
    })
  } catch (error) {
    if (!isCommandIdConflict(error)) {
      throw error
    }

    const committedDocumentId = await findDocumentIdByCommand(
      input.workspaceId,
      input.commandId,
    )

    if (!committedDocumentId) {
      throw error
    }

    return {
      outcome: 'already-committed',
      documentId: committedDocumentId,
    }
  }

  return { outcome: 'created', documentId }
}
