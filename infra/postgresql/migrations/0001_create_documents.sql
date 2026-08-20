CREATE TABLE documents (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  created_by_actor_id uuid NOT NULL,
  command_id uuid NOT NULL,
  workflow_state text NOT NULL DEFAULT 'draft',
  current_revision_id uuid NOT NULL,
  current_revision_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT documents_workspace_command_id_key
    UNIQUE (workspace_id, command_id),
  CONSTRAINT documents_workflow_state_check
    CHECK (workflow_state IN ('draft')),
  CONSTRAINT documents_current_revision_number_check
    CHECK (current_revision_number > 0)
);

CREATE TABLE document_revisions (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL,
  revision_number integer NOT NULL,
  title text NOT NULL,
  markdown_source text NOT NULL,
  created_by_actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT document_revisions_document_revision_key
    UNIQUE (document_id, revision_number),
  CONSTRAINT document_revisions_identity_key
    UNIQUE (id, document_id, revision_number),
  CONSTRAINT document_revisions_document_id_fkey
    FOREIGN KEY (document_id) REFERENCES documents (id),
  CONSTRAINT document_revisions_revision_number_check
    CHECK (revision_number > 0),
  CONSTRAINT document_revisions_title_check
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT document_revisions_markdown_source_check
    CHECK (
      length(btrim(markdown_source)) > 0
      AND octet_length(markdown_source) <= 262144
      AND position(chr(13) IN markdown_source) = 0
    )
);

ALTER TABLE documents
  ADD CONSTRAINT documents_current_revision_fkey
  FOREIGN KEY (current_revision_id, id, current_revision_number)
  REFERENCES document_revisions (id, document_id, revision_number)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX documents_workspace_created_at_idx
  ON documents (workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_document_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'document revisions are immutable' USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER document_revisions_are_immutable
BEFORE UPDATE OR DELETE ON document_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_document_revision_mutation();
