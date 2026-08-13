import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Route } from '#/routes/documents/new'

describe('new document route', () => {
  it('renders the document creation page frame', () => {
    const RouteComponent = Route.options.component

    expect(RouteComponent).toBeTypeOf('function')

    if (RouteComponent == null) {
      throw new Error('The new document route does not have a component')
    }

    const markup = renderToStaticMarkup(createElement(RouteComponent))

    expect(markup).toContain('<h1')
    expect(markup).toContain('Create a document')
    expect(markup).toContain('Start with a clear title and Markdown content')
    expect(markup).toContain('astryx-form-layout')
  })
})
