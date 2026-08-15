import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { useForm } from '@tanstack/react-form'

import {
  createDocumentCommandSchema,
  type CreateDocumentCommandInput,
} from '#/contracts/documents/create-document'

const defaultValues = {
  title: '',
} satisfies Pick<CreateDocumentCommandInput, 'title'>

function validateTitle(value: string): string | undefined {
  const result = createDocumentCommandSchema.shape.title.safeParse(value)

  return result.success ? undefined : result.error.issues[0]?.message
}

export function CreateDocumentForm() {
  const form = useForm({ defaultValues })

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

      <form onSubmit={(event) => event.preventDefault()}>
        <FormLayout>
          <form.Field
            name="title"
            validators={{
              onBlur: ({ value }) => validateTitle(value),
            }}
          >
            {(field) => {
              const error = field.state.meta.errors[0]

              return (
                <TextInput
                  label="Title"
                  isRequired
                  htmlName={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  status={
                    typeof error === 'string'
                      ? { type: 'error', message: error }
                      : undefined
                  }
                  width="100%"
                />
              )
            }}
          </form.Field>
        </FormLayout>
      </form>
    </VStack>
  )
}
