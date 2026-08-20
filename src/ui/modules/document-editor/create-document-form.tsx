import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useRef } from 'react'

import {
  CREATE_DOCUMENT_CONTENT_MAX_BYTES,
  CREATE_DOCUMENT_TITLE_MAX_LENGTH,
  createDocumentCommandSchema,
  getUtf8ByteLength,
  type CreateDocumentCommandInput,
} from '#/contracts/documents/create-document'

const defaultValues = {
  title: '',
  content: '',
} satisfies Pick<CreateDocumentCommandInput, 'title' | 'content'>

const createDocumentFormSchema = createDocumentCommandSchema.pick({
  title: true,
  content: true,
})

const byteNumberFormatter = new Intl.NumberFormat('en-US')

type CreateDocumentFormValues = typeof defaultValues

interface CreateDocumentFormProps {
  onSubmit?: (values: CreateDocumentFormValues) => void | Promise<void>
}

export function CreateDocumentForm({ onSubmit }: CreateDocumentFormProps = {}) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const contentInputRef = useRef<HTMLTextAreaElement>(null)
  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic({
      mode: 'blur',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: createDocumentFormSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit?.(value)
    },
    onSubmitInvalid: ({ value }) => {
      const titleResult = createDocumentCommandSchema.shape.title.safeParse(
        value.title,
      )

      if (!titleResult.success) {
        titleInputRef.current?.focus()
        return
      }

      contentInputRef.current?.focus()
    },
  })

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

      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <form.Subscribe
          selector={(state) =>
            [
              state.submissionAttempts,
              state.isValid,
              state.errorMap.onDynamic,
            ] as const
          }
        >
          {([submissionAttempts, isValid, validationIssues]) => (
            <FormLayout>
              {submissionAttempts > 0 && !isValid ? (
                <Banner
                  status="error"
                  title="The document could not be created"
                  description="Correct the fields marked below and submit again."
                />
              ) : null}

              <form.Field name="title">
                {(field) => {
                  const isOverCharacterLimit =
                    field.state.value.length > CREATE_DOCUMENT_TITLE_MAX_LENGTH
                  const error = isOverCharacterLimit
                    ? `Title must be ${CREATE_DOCUMENT_TITLE_MAX_LENGTH} characters or fewer`
                    : validationIssues?.title?.[0]?.message
                  const shouldShowError =
                    field.state.meta.isBlurred ||
                    submissionAttempts > 0 ||
                    isOverCharacterLimit

                  return (
                    <TextInput
                      ref={titleInputRef}
                      label="Title"
                      isRequired
                      htmlName={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                      status={
                        shouldShowError && typeof error === 'string'
                          ? { type: 'error', message: error }
                          : undefined
                      }
                      width="100%"
                    />
                  )
                }}
              </form.Field>

              <form.Field name="content">
                {(field) => {
                  const byteLength = getUtf8ByteLength(field.state.value)
                  const isOverByteLimit =
                    byteLength > CREATE_DOCUMENT_CONTENT_MAX_BYTES
                  const error = isOverByteLimit
                    ? `Content must be ${CREATE_DOCUMENT_CONTENT_MAX_BYTES} UTF-8 bytes or fewer`
                    : validationIssues?.content?.[0]?.message
                  const byteFeedback = isOverByteLimit
                    ? ` ${byteNumberFormatter.format(byteLength)} of ${byteNumberFormatter.format(CREATE_DOCUMENT_CONTENT_MAX_BYTES)} UTF-8 bytes used.`
                    : ''
                  const shouldShowError =
                    field.state.meta.isBlurred ||
                    submissionAttempts > 0 ||
                    isOverByteLimit

                  return (
                    <TextArea
                      ref={contentInputRef}
                      label="Content"
                      description={`Markdown syntax is supported.${byteFeedback}`}
                      isRequired
                      htmlName={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                      rows={12}
                      status={
                        shouldShowError && typeof error === 'string'
                          ? { type: 'error', message: error }
                          : undefined
                      }
                      width="100%"
                    />
                  )
                }}
              </form.Field>

              <Button label="Create document" type="submit" variant="primary" />
            </FormLayout>
          )}
        </form.Subscribe>
      </form>
    </VStack>
  )
}
