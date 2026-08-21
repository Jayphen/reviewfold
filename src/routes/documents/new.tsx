import { createFileRoute } from '@tanstack/react-router'

import { CreateDocumentForm } from '#/ui/modules/documents/create-document-form'

export const Route = createFileRoute('/documents/new')({
  component: CreateDocumentForm,
})
