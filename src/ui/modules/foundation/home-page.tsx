import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

import { RouterButtonLink } from '#/shared/ui/router-link'

export function HomePage() {
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
        <Text as="p" type="supporting" color="secondary">
          Get started by creating your first document or exploring the available
          features.
        </Text>
      </VStack>

      <Banner
        status="info"
        title="Foundation ready for document creation"
        description="Astryx provides the interface foundation, while TanStack Query handles cached server state with SSR hydration."
      />
      <RouterButtonLink
        to="/documents/new"
        label="Create a new document"
        variant="primary"
      />
    </VStack>
  )
}
