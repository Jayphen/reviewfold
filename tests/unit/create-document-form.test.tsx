// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CREATE_DOCUMENT_TITLE_MAX_LENGTH } from '#/contracts/documents/create-document'
import { CreateDocumentForm } from '#/ui/modules/document-editor/create-document-form'

afterEach(cleanup)

function getTitleInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement
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
