import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

export function CreateDocumentForm() {
  return (
    <VStack gap={6} maxWidth={720}>
      <VStack gap={2} hAlign="start">
        <Heading level={1} type="display-2" textWrap="balance">
          Create a document
        </Heading>
        <Text as="p" type="large" color="secondary">
          Start with a clear title and Markdown content for the document you
          want to review.
        </Text>
      </VStack>

      <FormLayout></FormLayout>
    </VStack>
  )
}
