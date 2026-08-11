import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <VStack gap={6} hAlign="start" maxWidth={720}>
      <VStack gap={2} hAlign="start">
        <Text type="label" color="accent" display="block">
          Reviewfold
        </Text>
        <Heading level={1} type="display-2" textWrap="balance">
          Shape thoughtful documents together.
        </Heading>
        <Text as="p" type="large" color="secondary">
          The project foundation is ready for the document creation vertical
          slice, with Markdown workflows and type-safe server data access.
        </Text>
      </VStack>

      <Banner
        status="info"
        title="Foundation ready"
        description="Astryx provides the interface foundation, while TanStack Query handles cached server state with SSR hydration."
      />

      <Button
        label="Create a document"
        variant="primary"
        isDisabled
        tooltip="Document creation will be implemented in JAY-6."
      />
    </VStack>
  )
}
