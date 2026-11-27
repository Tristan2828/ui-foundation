// mergeMarkdown (src/lib/markdown-merge.ts): a rich-text edit saved back
// to Markdown keeps every block the person didn't touch exactly as it was
// written. Runs on what the real editor serializes each fixture to
// (rich-text-editor.fixtures.ts); the browser round-trip lives in the
// e2e/rich-text-editor.spec.ts.
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { MARKDOWN_FIXTURES } from '../src/components/app/rich-text-editor.fixtures'
import { MarkdownMergeError, markdownStyle, mergeMarkdown, mergeParts } from '../src/lib/markdown-merge'

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

  // Blocks the editor writes its own way on load (a short table row padded,
  // marks nested its way) still match their original, so an edit elsewhere
  // keeps them byte for byte.
  for (const name of ['shortTableRow', 'boldLink', 'nestedMarks']) {
    it(`${name}: editing the intro keeps the block the editor normalized as written`, () => {
      const { markdown, editorWrites } = MARKDOWN_FIXTURES[name]
      expect(editorWrites).not.toBe(markdown)
      const firstLine = editorWrites.slice(0, editorWrites.indexOf('\n'))
      const merged = mergeMarkdown(markdown, editorWrites, editorWrites.replace(firstLine, `${firstLine} Edited.`))
      expect(merged).toBe(markdown.replace(firstLine, `${firstLine} Edited.`))
    })
  }

  it('deletes an untouched table the editor padded, without bringing it back', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.shortTableRow
    const current = editorWrites.slice(0, editorWrites.indexOf('| a')) + editorWrites.slice(editorWrites.indexOf('Outro.'))
    expect(mergeMarkdown(markdown, editorWrites, current)).toBe('Intro line.\n\nOutro.\n')
  })

  it("writes a block the editor shows its own way, nothing lost, as the editor does when it can't match it", () => {
    // A rewrite on load that `meaning` doesn't know (here, made up) still
    // saves: the block is written the editor's way, never twice.
    const original = 'Intro.\n\nSome   text,\n*kept*.\n\nOutro.\n'
    const baseline = 'Intro.\n\n**Some text, kept.**\n\nOutro.\n'
    const current = baseline.replace('Intro.', 'Intro, edited.')
    expect(mergeMarkdown(original, baseline, current)).toBe('Intro, edited.\n\n**Some text, kept.**\n\nOutro.\n')
  })

  it('refuses, rather than save a block the editor dropped part of (an image)', () => {
    // The editor drops an image's data as it loads; writing its version would delete it. Any part dropped is refused.
    const original = 'Intro.\n\nText ![a chart](chart.png) more.\n\nOutro.\n'
    const baseline = 'Intro.\n\nText  more.\n\nOutro.\n'
    const current = baseline.replace('Intro.', 'Intro, edited.')
    expect(() => mergeMarkdown(original, baseline, current)).toThrow(MarkdownMergeError)
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

  // A save changes only what was typed: editing the last block keeps the
  // document's own ending, with or without a final newline.
  it('edits the last block of a value with no final newline and adds none', () => {
    const original = 'First line.'
    const baseline = 'First line.\n'
    expect(mergeMarkdown(original, baseline, 'First line. More.\n')).toBe('First line. More.')
  })

  for (const ending of ['\n', '\n\n']) {
    it(`edits the last block of a value ending in ${JSON.stringify(ending)} and keeps it`, () => {
      const original = `Intro.\n\n- one\n- two\n\nLast line.${ending}`
      const baseline = 'Intro.\n\n* one\n* two\n\nLast line.\n'
      expect(mergeMarkdown(original, baseline, baseline.replace('Last line.', 'Last line, edited.'))).toBe(
        `Intro.\n\n- one\n- two\n\nLast line, edited.${ending}`,
      )
    })
  }

  it('keeps the ending when a new block is added after the last', () => {
    expect(mergeMarkdown('One.', 'One.\n', 'One.\n\nTwo.\n')).toBe('One.\n\nTwo.')
  })

  it('writes from scratch when there was nothing before', () => {
    expect(mergeMarkdown('', '', '# New\n\nText.\n')).toBe('# New\n\nText.\n')
  })

  // F2: the editor loads only a fence's language; the rest of its info
  // string must survive an edit anywhere else.
  it("keeps an untouched fence's info string (title, line marks) when another block is edited", () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.fenceMeta
    expect(editorWrites).not.toContain('title=')
    expect(mergeMarkdown(markdown, editorWrites, editLastBlock(editorWrites))).toBe(
      markdown.replace('paragraph.', 'paragraphEdited.'),
    )
  })

  it("never swaps a fence for the editor's copy that lost its info string", () => {
    // Even when the code itself doesn't match (made up here), the fence the
    // editor shows without its title isn't "the same, nothing lost".
    const original = 'Intro.\n\n```js title="app.js"\nlet   a = 1\n```\n\nOutro.\n'
    const baseline = 'Intro.\n\n```js\nlet a = 1\n```\n\nOutro.\n'
    const current = baseline.replace('Intro.', 'Intro, edited.')
    expect(() => mergeMarkdown(original, baseline, current)).toThrow(MarkdownMergeError)
  })

  // F12: a Windows note's untouched blocks keep CRLF; what the editor
  // writes goes back in CRLF too, so the note doesn't end up mixed.
  it('keeps a CRLF note in CRLF when one block is edited', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.crlf
    const merged = mergeMarkdown(markdown, editorWrites, editorWrites.replace('# Packing', '# PackingZ'))
    expect(merged).toBe(markdown.replace('# Packing', '# PackingZ'))
  })

  it('writes an edited multi-line block of a CRLF note in CRLF', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.crlf
    const merged = mergeMarkdown(markdown, editorWrites, editLastBlock(editorWrites))
    expect(merged).toBe(markdown.replace('lines.', 'linesEdited.'))
    expect(merged.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('writes a new block of a CRLF note in CRLF', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.crlf
    const merged = mergeMarkdown(markdown, editorWrites, `${editorWrites}\nNew\nlines.\n`)
    expect(merged).toBe(`${markdown}\r\nNew\r\nlines.\r\n`)
  })

  // F23: select all and delete leaves no invisible definition behind.
  it('drops a definition once nothing uses it (select all, delete)', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.referenceLinks
    expect(mergeMarkdown(markdown, editorWrites, '')).toBe('')
    expect(mergeMarkdown('[r]: https://x.y\n\nSee [the site][r].\n', 'See [the site](https://x.y).\n', '')).toBe('')
  })

  it('drops a definition with the only paragraph that used it, keeping the rest', () => {
    const { markdown, editorWrites } = MARKDOWN_FIXTURES.referenceLinks
    const current = editorWrites.slice(editorWrites.indexOf('A closing'))
    expect(mergeMarkdown(markdown, editorWrites, current)).toBe('A closing paragraph.\n')
  })

  it('keeps a definition something still uses, and one nothing used to begin with', () => {
    const original = 'One [a][r].\n\nTwo [b][r].\n\n[r]: https://x.y\n\n[spare]: https://spare.example\n\nEnd.\n'
    const baseline = 'One [a](https://x.y).\n\nTwo [b](https://x.y).\n\nEnd.\n'
    const current = baseline.replace('One [a](https://x.y).\n\n', '')
    expect(mergeMarkdown(original, baseline, current)).toBe('Two [b][r].\n\n[r]: https://x.y\n\n[spare]: https://spare.example\n\nEnd.\n')
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

// `content` decides whether a block the editor shows its own way lost
// nothing. A field `meaning` compares that `content` doesn't count is a
// field the editor could drop on load with nobody told (F2: a fence's
// info string). So: change any one field of any node, and if its meaning
// changes, its content must too. A node's type is the exception by design
// (`*a*` shown as `**a**` loses nothing).
describe('mergeParts: content counts every field meaning compares', () => {
  type Node = { type: string; children?: Node[]; [key: string]: unknown }
  const { parse, meaning, content } = mergeParts
  const samples = [
    ...Object.values(MARKDOWN_FIXTURES).map((fixture) => fixture.markdown),
    '3. three\n4. four\n\n#### Deep heading\n\n![alt](https://x.y/i.png "t")\n\n[t][r]\n\n[r]: https://x.y "T"\n',
  ]
  const changed = (value: unknown): unknown => {
    if (typeof value === 'string') return `${value}x`
    if (typeof value === 'number') return value + 1
    if (typeof value === 'boolean') return !value
    if (value === null) return 'x'
    if (Array.isArray(value)) return [...value, 'x']
    return value
  }
  const cases: { name: string; block: Node; path: number[]; key: string }[] = []
  for (const markdown of samples) {
    for (const block of (parse(markdown).children ?? []) as Node[]) {
      const walk = (node: Node, path: number[]) => {
        for (const key of Object.keys(node)) {
          if (['type', 'children', 'position', 'data', 'spread', 'label', 'referenceType'].includes(key)) continue
          cases.push({ name: `${node.type}.${key} in ${JSON.stringify(markdown.slice(0, 24))}`, block, path, key })
        }
        node.children?.forEach((child, index) => walk(child, [...path, index]))
      }
      walk(block, [])
    }
  }

  it('finds fields to check', () => {
    expect(cases.length).toBeGreaterThan(50)
    expect(cases.some((c) => c.key === 'meta')).toBe(true)
    expect(cases.some((c) => c.key === 'lang')).toBe(true)
  })

  for (const { name, block, path, key } of cases) {
    it(name, () => {
      const copy = structuredClone(block)
      let node = copy
      for (const index of path) node = node.children![index]
      node[key] = changed(node[key])
      const definitions = new Map()
      if (JSON.stringify(meaning(copy, definitions)) !== JSON.stringify(meaning(block, definitions))) {
        expect(content(copy, definitions)).not.toBe(content(block, definitions))
      }
    })
  }
})

describe("spaces at a line's start", () => {
  // The editor leaves a paragraph's leading spaces out of what it writes
  // (rich-text-empty-paragraph.ts); a note that already holds one escaped
  // still matches what the editor shows.
  const original = '&#x20; escaped start.\n\nSecond.\n'
  const baseline = 'escaped start.\n\nSecond.\n'

  it('an untouched block holding an escaped space is kept as written', () => {
    expect(mergeMarkdown(original, baseline, baseline)).toBe(original)
    expect(mergeMarkdown(original, baseline, 'escaped start.\n\nSecond. Edited\n')).toBe('&#x20; escaped start.\n\nSecond. Edited\n')
  })

  it('edited, it is written as the editor writes it', () => {
    expect(mergeMarkdown(original, baseline, 'escaped start. Too\n\nSecond.\n')).toBe('escaped start. Too\n\nSecond.\n')
  })

  it('a heading likewise', () => {
    expect(mergeMarkdown('## &#x20;Title\n\nText.\n', '## Title\n\nText.\n', '## Title\n\nText. Edited\n')).toBe('## &#x20;Title\n\nText. Edited\n')
  })
})

describe('markdownStyle', () => {
  it("reads the document's own bullet and rule marks", () => {
    expect(markdownStyle('* a\n\n***\n')).toEqual({ bullet: '*', rule: '*' })
    expect(markdownStyle('- a\n\n___\n')).toEqual({ bullet: '-', rule: '_' })
    expect(markdownStyle('Just text.\n')).toEqual({ bullet: '-', rule: '-' })
  })
})
