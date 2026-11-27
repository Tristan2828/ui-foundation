// The editor's code, loaded apart from the page: RichTextEditor's lazy
// load and preloadRichTextEditor() ask for the same module, and a preload
// never throws or leaves anything for the caller to catch. A failed load
// is tests/rich-text-load-failed.test.ts (its own file: it mocks the
// editor's module).
import { describe, expect, it } from 'vitest'
import { loadedRichTextEditor, loadRichTextEditor, preloadRichTextEditor } from '../src/components/app/rich-text-load'

describe('loadRichTextEditor', () => {
  it("resolves to the editor's module, its component the default export", async () => {
    const loaded = await loadRichTextEditor()
    const direct = await import('../src/components/app/milkdown-editor')
    expect(typeof loaded.default).toBe('function')
    expect(loaded.default).toBe(direct.default)
  })

  it('gives the same module on every call', async () => {
    const [first, second] = await Promise.all([loadRichTextEditor(), loadRichTextEditor()])
    expect(first.default).toBe(second.default)
  })

  it('keeps the module once loaded, for an editor to draw at once', async () => {
    const loaded = await loadRichTextEditor()
    expect(loadedRichTextEditor()).toBe(loaded)
  })
})

describe('preloadRichTextEditor', () => {
  it('returns nothing and does not throw, however often it is called', () => {
    expect(preloadRichTextEditor()).toBeUndefined()
    expect(() => {
      preloadRichTextEditor()
      preloadRichTextEditor()
    }).not.toThrow()
  })
})
