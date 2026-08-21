import { createFileRoute } from '@tanstack/react-router'

import { HomePage } from '#/ui/modules/home/home-page'

export const Route = createFileRoute('/')({ component: HomePage })
