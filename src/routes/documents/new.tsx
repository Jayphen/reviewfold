import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/documents/new')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/documents/new"!</div>
}
