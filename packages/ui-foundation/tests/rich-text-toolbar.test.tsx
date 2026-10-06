// The rich-text toolbar never points `aria-controls` at an element that
// isn't in the page (axe's aria-valid-attr-value, critical). The editable
// element is made by the editor after its chunk loads and after it mounts,
// so the page is checked at both of those moments, rendered to HTML: no
// effect runs there, so the editor is never made.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MilkdownEditor from '../src/components/app/milkdown-editor'
import { RichTextEditor } from '../src/components/app/rich-text-editor'

// Every id an `aria-controls` names that no element in the HTML has.
function missingControls(html: string): string[] {
  const ids = new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((found) => found[1]))
  return [...html.matchAll(/\saria-controls="([^"]*)"/g)]
    .flatMap((found) => found[1].split(/\s+/))
    .filter((id) => !ids.has(id))
}

const props = { id: 'notes', defaultValue: 'Some **notes**.', onChange: () => {}, 'aria-label': 'Notes' }

describe('RichTextEditor: aria-controls', () => {
  it("names nothing missing while the editor's chunk is still loading", () => {
    const html = renderToString(<RichTextEditor {...props} />)
    expect(html).toContain('data-state="loading"')
    expect(missingControls(html)).toEqual([])
  })

  it('names nothing missing once the chunk is in but before the editor is made', () => {
    const html = renderToString(<MilkdownEditor {...props} />)
    expect(html).toContain('role="toolbar"')
    expect(html).not.toContain('id="notes"')
    expect(missingControls(html)).toEqual([])
  })
})
