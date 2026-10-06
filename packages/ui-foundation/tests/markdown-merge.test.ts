// mergeMarkdown (src/lib/markdown-merge.ts): a rich-text edit saved back
// to Markdown keeps every block the person didn't touch exactly as it was
// written. Runs on what the real editor serializes each fixture to
// (rich-text-editor.fixtures.ts); the browser round-trip lives in the
// Storybook spec.
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { MARKDOWN_FIXTURES } from '../src/components/app/rich-text-editor.fixtures'
import { MarkdownMergeError, markdownStyle, mergeMarkdown } from '../src/lib/markdown-merge'

const processor = unified().use(remarkParse).use(remarkGfm)

// Each top-level block's [start, end) in the source.
function blockRanges(markdown: string) {
  const tree = processor.parse(markdown)
  return tree.children.map((node) => [node.position!.start.offset!, node.position!.end.offset!] as const)
}

// What the editor would serialize after the person changed the last word
// of the document's last block.
function editLastBlock(serialized: string) {
  const [start, end] = blockRanges(serialized).at(-1)!
  const block = serialized.slice(start, end)
  const edited = block.replace(/([A-Za-z]+)([^A-Za-z]*)$/, '$1Edited$2')
  return serialized.slice(0, start) + edited + serialized.slice(end)
}

describe('mergeMarkdown', () => {
  for (const [name, { markdown, editorWrites }] of Object.entries(MARKDOWN_FIXTURES)) {
    it(`${name}: untouched, it saves back byte for byte`, () => {
      expect(mergeMarkdown(markdown, editorWrites, editorWrites)).toBe(markdown)
    })

    it(`${name}: one block edited, every other block keeps its source`, () => {
      const merged = mergeMarkdown(markdown, editorWrites, editLastBlock(editorWrites))
      const [lastStart] = blockRanges(markdown).at(-1)!
      // Everything before the edited block is the original, byte for byte.
      expect(merged.slice(0, lastStart)).toBe(markdown.slice(0, lastStart))
      expect(merged).toContain('Edited')
    })
  }

  it('keeps an untouched table as written (the editor pads its cells)', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.table
    expect(editorWrites).not.toBe(markdown)
    const merged = mergeMarkdown(markdown, editorWrites, editLastBlock(editorWrites))
    expect(merged).toBe('| Part | Count | Note |\n| :--- | ---: | :---: |\n| Receiver | 1 | small |\n| Battery | 2 | AA |\n\nAfter the tableEdited.\n')
  })

  it("keeps a reference link and its definition when another block is edited", () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.referenceLinks
    const merged = mergeMarkdown(markdown, editorWrites, editLastBlock(editorWrites))
    expect(merged).toBe('A [reference link][ref] here.\n\n[ref]: https://example.com/ref\n\nA closing paragraphEdited.\n')
  })

  it('keeps the definition after the paragraph using it when that paragraph is edited', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.referenceLinks
    const current = editorWrites.replace('here.', 'right here.')
    const merged = mergeMarkdown(markdown, editorWrites, current)
    expect(merged).toBe(
      'A [reference link](https://example.com/ref) right here.\n\n[ref]: https://example.com/ref\n\nA closing paragraph.\n',
    )
  })

  it('keeps raw HTML as the characters written', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.rawHtml
    const merged = mergeMarkdown(markdown, editorWrites, editLastBlock(editorWrites))
    expect(merged).toContain('Before <b>not bold</b> after.\n\n<div>block html</div>\n\n<script>alert(1)</script>')
  })

  it('drops a deleted block and keeps the rest', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.headings
    const current = editorWrites.replace('Text under it.\n\n', '')
    expect(mergeMarkdown(markdown, editorWrites, current)).toBe(
      '# Title\n\nIntro paragraph.\n\n## Second level\n\n### Third level\n\nMore text.\n',
    )
  })

  it('adds a new block among untouched ones', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.table
    const current = `New first line.\n\n${editorWrites}`
    expect(mergeMarkdown(markdown, editorWrites, current)).toBe(`New first line.\n\n${markdown}`)
  })

  it('writes from scratch when there was nothing before', () => {
    expect(mergeMarkdown('', '', '# New\n\nText.\n')).toBe('# New\n\nText.\n')
  })

  it("refuses, rather than save something that means other than what's on screen", () => {
    // The edited first block, written with the same bullet as the
    // untouched list after it, would fuse the two lists into one.
    const original = 'Para one.\n\n- b\n'
    const baseline = 'Para one.\n\n* b\n'
    const current = '- a\n\n* b\n'
    expect(() => mergeMarkdown(original, baseline, current)).toThrow(MarkdownMergeError)
  })
})

describe('markdownStyle', () => {
  it("reads the document's own bullet and rule marks", () => {
    expect(markdownStyle('* a\n\n***\n')).toEqual({ bullet: '*', rule: '*' })
    expect(markdownStyle('- a\n\n___\n')).toEqual({ bullet: '-', rule: '_' })
    expect(markdownStyle('Just text.\n')).toEqual({ bullet: '-', rule: '-' })
  })
})
