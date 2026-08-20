// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CREATE_DOCUMENT_CONTENT_MAX_BYTES,
  CREATE_DOCUMENT_TITLE_MAX_LENGTH,
} from '#/contracts/documents/create-document'
import { CreateDocumentForm } from '#/ui/modules/document-editor/create-document-form'

afterEach(cleanup)

function getTitleInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement
}

function getContentInput(): HTMLTextAreaElement {
  return screen.getByRole('textbox', {
    name: /content/i,
  }) as HTMLTextAreaElement
}

function getAccessibleDescription(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

describe('create document title field', () => {
  it('renders a required input with an associated visible label', () => {
    render(<CreateDocumentForm />)

    const input = getTitleInput()
    const label = document.querySelector(`label[for="${input.id}"]`)

    expect(input.getAttribute('aria-required')).toBe('true')
    expect(input.name).toBe('title')
    expect(label?.textContent).toContain('Title')
  })

  it.each([
    { name: 'an empty title', value: '', error: 'Title must not be empty' },
    {
      name: 'a whitespace-only title',
      value: '   ',
      error: 'Title must not be empty',
    },
    { name: 'a valid title', value: 'Architecture notes', error: undefined },
    {
      name: 'an over-limit title',
      value: 'a'.repeat(CREATE_DOCUMENT_TITLE_MAX_LENGTH + 1),
      error: `Title must be ${CREATE_DOCUMENT_TITLE_MAX_LENGTH} characters or fewer`,
    },
  ])('validates $name on blur', ({ value, error }) => {
    render(<CreateDocumentForm />)

    const input = getTitleInput()
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input)

    expect(input.value).toBe(value)
    expect(input.getAttribute('aria-invalid')).toBe(error ? 'true' : null)
    if (error) {
      expect(screen.getByText(error)).toBeTruthy()
    }
  })

  it('clears a surfaced title error on the next valid blur', () => {
    render(<CreateDocumentForm />)

    const input = getTitleInput()
    fireEvent.blur(input)
    expect(screen.getByText('Title must not be empty')).toBeTruthy()

    fireEvent.change(input, { target: { value: 'Architecture notes' } })
    fireEvent.blur(input)

    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByText('Title must not be empty')).toBeNull()
  })

  it('preserves the entered title across ordinary rerenders', () => {
    const view = render(<CreateDocumentForm />)

    fireEvent.change(getTitleInput(), {
      target: { value: 'Persistent title' },
    })
    view.rerender(<CreateDocumentForm />)

    expect(getTitleInput().value).toBe('Persistent title')
  })
})

describe('create document content field', () => {
  it('renders a required Markdown field without byte feedback under the limit', () => {
    render(<CreateDocumentForm />)

    const input = getContentInput()
    const label = document.querySelector(`label[for="${input.id}"]`)
    const description = getAccessibleDescription(input)

    expect(input.getAttribute('aria-required')).toBe('true')
    expect(input.name).toBe('content')
    expect(label?.textContent).toContain('Content')
    expect(description).toContain('Markdown syntax is supported.')
    expect(description).not.toContain('UTF-8 bytes used.')
  })

  it.each([
    { name: 'ASCII', value: 'hello' },
    { name: 'multibyte Unicode', value: '🙂' },
  ])('hides byte feedback for valid $name content', ({ value }) => {
    render(<CreateDocumentForm />)

    const input = getContentInput()
    fireEvent.change(input, { target: { value } })

    expect(input.value).toBe(value)
    expect(getAccessibleDescription(input)).not.toContain('UTF-8 bytes used.')
  })

  it('preserves plain text and line breaks exactly', () => {
    render(<CreateDocumentForm />)

    const content = 'First line\n\nSecond line  \n'
    const input = getContentInput()
    fireEvent.change(input, { target: { value: content } })
    fireEvent.blur(input)

    expect(input.value).toBe(content)
    expect(input.getAttribute('aria-invalid')).toBeNull()
  })

  it('exposes the empty-content error to assistive technology', () => {
    render(<CreateDocumentForm />)

    const input = getContentInput()
    fireEvent.blur(input)

    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(getAccessibleDescription(input)).toContain(
      'Content must not be empty',
    )
  })

  it('shows an accessible error when content exceeds the UTF-8 byte limit', () => {
    render(<CreateDocumentForm />)

    const input = getContentInput()
    const content = `${'🙂'.repeat(CREATE_DOCUMENT_CONTENT_MAX_BYTES / 4)}a`
    fireEvent.change(input, { target: { value: content } })

    const description = getAccessibleDescription(input)
    expect(input.value).toBe(content)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(description).toContain('262,145 of 262,144 UTF-8 bytes used.')
    expect(description).toContain(
      `Content must be ${CREATE_DOCUMENT_CONTENT_MAX_BYTES} UTF-8 bytes or fewer`,
    )
  })
})

describe('create document validation', () => {
  it('does not display validation before the user interacts with the form', () => {
    render(<CreateDocumentForm />)

    expect(screen.queryByText('Title must not be empty')).toBeNull()
    expect(screen.queryByText('Content must not be empty')).toBeNull()
    expect(screen.queryByText('The document could not be created')).toBeNull()
  })

  it('shows a summary and focuses the first invalid field on submit', async () => {
    const user = userEvent.setup()
    render(<CreateDocumentForm />)

    await user.click(screen.getByRole('button', { name: 'Create document' }))

    await screen.findByText('The document could not be created')
    expect(screen.getByText('Title must not be empty')).toBeTruthy()
    expect(
      screen.getAllByText('Content must not be empty').length,
    ).toBeGreaterThan(0)
    expect(document.activeElement).toBe(getTitleInput())
  })

  it('focuses content when it is the first invalid field', async () => {
    const user = userEvent.setup()
    render(<CreateDocumentForm />)

    await user.type(getTitleInput(), 'Architecture notes')
    await user.click(screen.getByRole('button', { name: 'Create document' }))

    await screen.findByText('Content must not be empty')
    expect(document.activeElement).toBe(getContentInput())
  })

  it('clears field errors and the summary as the submitted values are corrected', async () => {
    const user = userEvent.setup()
    render(<CreateDocumentForm />)
    await user.click(screen.getByRole('button', { name: 'Create document' }))
    await screen.findByText('The document could not be created')
    await waitFor(() => {
      expect(document.activeElement).toBe(getTitleInput())
    })

    await user.type(getTitleInput(), 'Architecture notes')
    await user.type(getContentInput(), '# Architecture')

    await waitFor(() => {
      expect(getTitleInput().getAttribute('aria-invalid')).toBeNull()
      expect(getContentInput().getAttribute('aria-invalid')).toBeNull()
      expect(screen.queryByText('The document could not be created')).toBeNull()
    })
  })

  it('never invokes valid submission for invalid input', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CreateDocumentForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Create document' }))

    await screen.findByText('The document could not be created')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid values through the native form element', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CreateDocumentForm onSubmit={onSubmit} />)

    await user.type(getTitleInput(), 'Architecture notes')
    await user.type(getContentInput(), '# Architecture')
    await user.click(screen.getByRole('button', { name: 'Create document' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Architecture notes',
        content: '# Architecture',
      })
    })
  })
})
