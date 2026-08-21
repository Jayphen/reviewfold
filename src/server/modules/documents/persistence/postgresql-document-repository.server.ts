import '@tanstack/react-start/server-only'

import { randomUUID } from 'node:crypto'

import { err, errAsync, ok, ResultAsync } from 'neverthrow'
import { DatabaseError } from 'pg'

import {
  getPostgresPool,
  withPostgresTransaction,
} from '#/server/platform/postgresql/client.server'

const uniqueViolationSqlState = '23505'
const commandIdConstraint = 'documents_workspace_command_id_key'
const connectionExceptionSqlStateClass = '08'
const transactionRollbackSqlStateClass = '40'
const insufficientResourcesSqlStateClass = '53'
const queryCanceledSqlState = '57014'
const administratorShutdownSqlState = '57P01'
const crashShutdownSqlState = '57P02'
const cannotConnectNowSqlState = '57P03'
const recoverableSqlStateClasses = new Set([
  connectionExceptionSqlStateClass,
  transactionRollbackSqlStateClass,
  insufficientResourcesSqlStateClass,
])
const recoverableSqlStates = new Set([
  queryCanceledSqlState,
  administratorShutdownSqlState,
  crashShutdownSqlState,
  cannotConnectNowSqlState,
])
const recoverableSystemErrorCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
])

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

export type PersistDocumentError =
  | { type: 'persistence-unavailable' }
  | { type: 'persistence-outcome-ambiguous' }

type WriteDocumentError = PersistDocumentError | { type: 'command-id-conflict' }

interface DocumentIdRow {
  documentId: string
}

function isCommandIdConflict(error: unknown): boolean {
  return (
    error instanceof DatabaseError &&
    error.code === uniqueViolationSqlState &&
    error.constraint === commandIdConstraint
  )
}

function hasRecoverableSystemErrorCode(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    recoverableSystemErrorCodes.has(error.code)
  )
}

function isRecoverablePostgresFailure(error: unknown): boolean {
  if (hasRecoverableSystemErrorCode(error)) {
    return true
  }

  if (!(error instanceof DatabaseError) || !error.code) {
    return false
  }

  return (
    recoverableSqlStateClasses.has(error.code.slice(0, 2)) ||
    recoverableSqlStates.has(error.code)
  )
}

function mapReadFailure(error: unknown): PersistDocumentError {
  if (isRecoverablePostgresFailure(error)) {
    return { type: 'persistence-unavailable' }
  }

  throw error
}

function mapWriteFailure(error: unknown): WriteDocumentError {
  if (isCommandIdConflict(error)) {
    return { type: 'command-id-conflict' }
  }

  if (isRecoverablePostgresFailure(error)) {
    return { type: 'persistence-outcome-ambiguous' }
  }

  throw error
}

const findDocumentIdByCommand = ResultAsync.fromThrowable(
  async (workspaceId: string, commandId: string) => {
    const result = await getPostgresPool().query<DocumentIdRow>(
      `SELECT id AS "documentId"
         FROM documents
        WHERE workspace_id = $1
          AND command_id = $2`,
      [workspaceId, commandId],
    )

    return result.rows[0]?.documentId
  },
  mapReadFailure,
)

const writeDocument = ResultAsync.fromThrowable(
  async (
    input: PersistDocumentInput,
    documentId: string,
    revisionId: string,
  ) => {
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
  },
  mapWriteFailure,
)

function resolveCommandConflict(
  workspaceId: string,
  commandId: string,
): ResultAsync<PersistDocumentResult, PersistDocumentError> {
  return findDocumentIdByCommand(workspaceId, commandId)
    .mapErr((): PersistDocumentError => ({
      type: 'persistence-outcome-ambiguous',
    }))
    .andThen((documentId) =>
      documentId
        ? ok({ outcome: 'already-committed', documentId } as const)
        : err({ type: 'persistence-outcome-ambiguous' } as const),
    )
}

function createDocumentRecord(
  input: PersistDocumentInput,
): ResultAsync<PersistDocumentResult, PersistDocumentError> {
  const documentId = randomUUID()
  const revisionId = randomUUID()

  return writeDocument(input, documentId, revisionId)
    .map(() => ({ outcome: 'created', documentId }) as const)
    .orElse((error) => {
      if (error.type === 'command-id-conflict') {
        return resolveCommandConflict(input.workspaceId, input.commandId)
      }

      return errAsync(error)
    })
}

export function persistDocument(
  input: PersistDocumentInput,
): ResultAsync<PersistDocumentResult, PersistDocumentError> {
  return createDocumentRecord(input)
}
