import { createFileRoute } from '@tanstack/react-router'

import { CreateDocumentForm } from '#/ui/modules/document-editor/create-document-form'

export const Route = createFileRoute('/documents/new')({
  component: CreateDocumentForm,
})
