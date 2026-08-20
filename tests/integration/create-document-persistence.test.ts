import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  closePostgresPool,
  getPostgresPool,
  withPostgresTransaction,
} from '#/server/platform/postgresql/client.server'
import { persistDocument } from '#/server/modules/documents/persistence/postgresql-document-repository.server'

const describeWithPostgres =
  process.env.RUN_POSTGRES_INTEGRATION === '1' ? describe : describe.skip

const commandId = '01950000-0000-7000-8000-000000000001'
const workspaceId = '01950000-0000-7000-8000-000000000002'
const actorId = '01950000-0000-7000-8000-000000000003'

const validInput = {
  commandId,
  workspaceId,
  actorId,
  title: 'A document title',
  content: '# Introduction\n\nDocument content.',
} as const

describeWithPostgres('PostgreSQL document persistence', () => {
  beforeEach(async () => {
    await getPostgresPool().query(
      'TRUNCATE document_revisions, documents RESTART IDENTITY',
    )
  })

  afterAll(async () => {
    await closePostgresPool()
  })

  it('atomically creates a draft document and immutable revision 1', async () => {
    const result = await persistDocument(validInput)

    expect(result.outcome).toBe('created')

    const persisted = await getPostgresPool().query<{
      documentId: string
      workspaceId: string
      documentActorId: string
      commandId: string
      workflowState: string
      currentRevisionId: string
      currentRevisionNumber: number
      revisionId: string
      revisionActorId: string
      revisionNumber: number
      title: string
      content: string
    }>(
      `SELECT
         d.id AS "documentId",
         d.workspace_id AS "workspaceId",
         d.created_by_actor_id AS "documentActorId",
         d.command_id AS "commandId",
         d.workflow_state AS "workflowState",
         d.current_revision_id AS "currentRevisionId",
         d.current_revision_number AS "currentRevisionNumber",
         r.id AS "revisionId",
         r.created_by_actor_id AS "revisionActorId",
         r.revision_number AS "revisionNumber",
         r.title,
         r.markdown_source AS content
       FROM documents d
       JOIN document_revisions r ON r.document_id = d.id`,
    )

    expect(persisted.rows).toEqual([
      {
        documentId: result.documentId,
        workspaceId,
        documentActorId: actorId,
        commandId,
        workflowState: 'draft',
        currentRevisionId: persisted.rows[0]?.revisionId,
        currentRevisionNumber: 1,
        revisionId: persisted.rows[0]?.revisionId,
        revisionActorId: actorId,
        revisionNumber: 1,
        title: validInput.title,
        content: validInput.content,
      },
    ])
  })

  it('returns the original document for sequential and concurrent retries', async () => {
    const [first, concurrentRetry] = await Promise.all([
      persistDocument(validInput),
      persistDocument(validInput),
    ])
    const laterRetry = await persistDocument(validInput)

    expect([first.outcome, concurrentRetry.outcome]).toContain('created')
    expect([first.documentId, concurrentRetry.documentId]).toEqual([
      first.documentId,
      first.documentId,
    ])
    expect(laterRetry).toEqual({
      outcome: 'already-committed',
      documentId: first.documentId,
    })

    const counts = await getPostgresPool().query<{
      documentCount: number
      revisionCount: number
    }>(
      `SELECT
         (SELECT count(*)::integer FROM documents) AS "documentCount",
         (SELECT count(*)::integer FROM document_revisions) AS "revisionCount"`,
    )

    expect(counts.rows[0]).toEqual({ documentCount: 1, revisionCount: 1 })
  })

  it('scopes command idempotency to a workspace', async () => {
    const otherWorkspaceId = '01950000-0000-7000-8000-000000000004'
    const first = await persistDocument(validInput)
    const second = await persistDocument({
      ...validInput,
      workspaceId: otherWorkspaceId,
    })

    expect(first.outcome).toBe('created')
    expect(second.outcome).toBe('created')
    expect(second.documentId).not.toBe(first.documentId)
  })

  it('rolls back the document when revision insertion fails', async () => {
    await expect(
      persistDocument({
        ...validInput,
        title: 'a'.repeat(201),
      }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'document_revisions_title_check',
    })

    const count = await getPostgresPool().query<{ count: number }>(
      'SELECT count(*)::integer AS count FROM documents',
    )
    expect(count.rows[0]?.count).toBe(0)
  })

  it('rejects a document that does not reference its own committed revision', async () => {
    const documentId = '01950000-0000-7000-8000-000000000005'
    const missingRevisionId = '01950000-0000-7000-8000-000000000006'
    const otherRevisionId = '01950000-0000-7000-8000-000000000008'

    await expect(
      withPostgresTransaction(async (client) => {
        await client.query(
          `INSERT INTO documents (
             id,
             workspace_id,
             created_by_actor_id,
             command_id,
             current_revision_id,
             current_revision_number
           ) VALUES ($1, $2, $3, $4, $5, 1)`,
          [documentId, workspaceId, actorId, commandId, missingRevisionId],
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
          [
            otherRevisionId,
            documentId,
            validInput.title,
            validInput.content,
            actorId,
          ],
        )
      }),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'documents_current_revision_fkey',
    })

    const counts = await getPostgresPool().query<{
      documentCount: number
      revisionCount: number
    }>(
      `SELECT
         (SELECT count(*)::integer FROM documents) AS "documentCount",
         (SELECT count(*)::integer FROM document_revisions) AS "revisionCount"`,
    )
    expect(counts.rows[0]).toEqual({ documentCount: 0, revisionCount: 0 })
  })

  it('prevents revision updates and duplicate revision numbers', async () => {
    const created = await persistDocument(validInput)

    await expect(
      getPostgresPool().query(
        'UPDATE document_revisions SET title = $1 WHERE document_id = $2',
        ['Changed title', created.documentId],
      ),
    ).rejects.toMatchObject({ code: '55000' })

    await expect(
      getPostgresPool().query(
        'DELETE FROM document_revisions WHERE document_id = $1',
        [created.documentId],
      ),
    ).rejects.toMatchObject({ code: '55000' })

    await expect(
      getPostgresPool().query(
        `INSERT INTO document_revisions (
           id,
           document_id,
           revision_number,
           title,
           markdown_source,
           created_by_actor_id
         ) VALUES ($1, $2, 1, $3, $4, $5)`,
        [
          '01950000-0000-7000-8000-000000000007',
          created.documentId,
          validInput.title,
          validInput.content,
          actorId,
        ],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'document_revisions_document_revision_key',
    })
  })
})
