// <Markdown>'s task boxes rendered to markup: pictures by default, so
// read-only stays read-only, and checkboxes named for their items with
// `onTasksChange`. Ticking is e2e/markdown-tasks.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../src/components/app/markdown'

const TEXT = '- [ ] Book the van\n- [x] Order boxes\n'

describe('<Markdown> task items', () => {
  it('draws each box as a picture without onTasksChange', () => {
    const html = renderToStaticMarkup(<Markdown>{TEXT}</Markdown>)
    expect(html).not.toContain('role="checkbox"')
    expect(html).toContain('aria-label="Not done"')
    expect(html).toContain('aria-label="Done"')
  })

  it('draws each box as a checkbox named for its item with onTasksChange', () => {
    const html = renderToStaticMarkup(<Markdown onTasksChange={() => {}}>{TEXT}</Markdown>)
    expect(html.match(/role="checkbox"/g)).toHaveLength(2)
    expect(html).toContain('aria-label="Book the van"')
    expect(html).toContain('aria-label="Order boxes"')
  })
})
