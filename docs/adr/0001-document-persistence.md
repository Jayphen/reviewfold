# ADR 0001: Document and revision persistence

## Status

Accepted

## Context

Document creation must atomically persist a workspace-owned document and its
first immutable Markdown revision. Retrying the same browser command must not
create another logical document, and a committed document must always identify
one of its own committed revisions as current.

## Decision

PostgreSQL is the source of truth. Versioned SQL migrations under
`infra/postgresql/migrations` own product schema changes and are recorded in the
`reviewfold_migrations` table. Request handling never creates or changes schema.

`documents` stores server-controlled identity, workspace ownership, creator,
workflow state, the command idempotency key, and the current revision identity
and number. `document_revisions` stores revisioned titles and canonical Markdown
source together with revision authorship. Both use application-generated UUIDs;
timestamps use PostgreSQL transaction time.

The create operation inserts both rows through one checked-out client and one
transaction. The document points to revision 1 before that revision exists, so
the composite current-revision foreign key is deferred until commit. It includes
the document and revision number, ensuring the current revision belongs to that
document and has the declared number without a nullable intermediate state.

Revision rows reject updates and deletes through a trigger. Their title and
Markdown checks mirror portable command invariants, including normalized line
endings and the 256 KiB UTF-8 limit. A unique `(document_id, revision_number)`
constraint protects revision ordering.

Command idempotency is unique on `(workspace_id, command_id)`. A retry returns
the original document ID, including when concurrent transactions race on the
constraint. Command IDs are retained for as long as their document is retained;
no independent expiry policy is introduced in this slice.

## Consequences

- Document creation cannot commit a partial document or revision.
- Reads and retries must include trusted workspace identity.
- Future workflow states and revision creation require explicit migrations.
- Revision correction is represented by a new revision, never mutation.
- PostgreSQL row types, constraint names, and driver errors remain inside the
  persistence layer.
