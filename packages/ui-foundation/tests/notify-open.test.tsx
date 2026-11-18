// notify.done's Open link: what it hands sonner. The link
// clicked in a real browser, at desktop and phone widths, is
// e2e/notify-open.spec.ts's.
import { isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const success = vi.fn<(message: string, options?: unknown) => string>(() => 'toast-1')
const dismiss = vi.fn()
vi.mock('sonner', () => ({ toast: { success: (message: string, options?: unknown) => success(message, options), dismiss, error: vi.fn() } }))

const { notify, openTarget } = await import('../src/components/app/notify')

type Options = { action?: unknown; cancel?: unknown; duration?: number }
const lastOptions = () => success.mock.calls.at(-1)?.[1] as Options
const markup = (node: unknown) => renderToStaticMarkup(<MemoryRouter>{node as ReactElement}</MemoryRouter>)

afterEach(() => {
  success.mockClear()
  dismiss.mockClear()
})

describe('notify.done with open', () => {
  it('without open (or undo) it is the toast it always was: no action, the standard duration', () => {
    notify.done('Added', 'The Long Walk')
    expect(success).toHaveBeenCalledWith('Added The Long Walk', { action: undefined, cancel: undefined })
  })

  it('with undo alone, Undo is the action as before, and nothing else', () => {
    notify.done('Deleted', 'The Long Walk', { undo: () => {} })
    const options = lastOptions()
    expect(options.action).toMatchObject({ label: 'Undo' })
    expect(options.cancel).toBeUndefined()
  })

  it('a path: an Open link to it, named after the record, without its own duration', () => {
    notify.done('Added', 'The Long Walk', { open: '/books/7' })
    const options = lastOptions()
    expect(options.duration).toBeUndefined()
    expect(isValidElement(options.action)).toBe(true)
    const html = markup(options.action)
    expect(html).toContain('href="/books/7"')
    expect(html).toContain('aria-label="Open The Long Walk"')
    expect(html).toContain('>Open</a>')
    expect(html).toContain('data-button=""')
  })

  it('{ to, label } changes the word, and the name follows it', () => {
    notify.done('Added', 'Paper Atlas', { open: { to: { pathname: '/books/9', search: '?tab=notes' }, label: 'View' } })
    const html = markup(lastOptions().action)
    expect(html).toContain('href="/books/9?tab=notes"')
    expect(html).toContain('aria-label="View Paper Atlas"')
    expect(html).toContain('>View</a>')
  })

  it('with undo too, both show: Open in the slot before Undo', () => {
    notify.done('Added', 'Paper Atlas', { open: '/books/9', undo: () => {} })
    const options = lastOptions()
    expect(options.action).toMatchObject({ label: 'Undo' })
    expect(markup(options.cancel)).toContain('href="/books/9"')
  })

  it('clicking Open closes its own toast', () => {
    notify.done('Added', 'The Long Walk', { open: '/books/7' })
    const link = lastOptions().action as ReactElement<{ onClick: () => void }>
    link.props.onClick()
    expect(dismiss).toHaveBeenCalledWith('toast-1')
  })
})

describe('openTarget', () => {
  it('reads a path, a path object and { to, label }', () => {
    expect(openTarget('/books/7')).toEqual({ to: '/books/7', label: 'Open' })
    expect(openTarget({ pathname: '/books/7' })).toEqual({ to: { pathname: '/books/7' }, label: 'Open' })
    expect(openTarget({ to: '/books/7' })).toEqual({ to: '/books/7', label: 'Open' })
    expect(openTarget({ to: '/books/7', label: 'View' })).toEqual({ to: '/books/7', label: 'View' })
  })
})
