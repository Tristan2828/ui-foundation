import { renderToStaticMarkup } from 'react-dom/server'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../src/components/app/markdown'
import { mergeMarkdown } from '../src/lib/markdown-merge'
import {
  catchColumnWidth,
  clampColumnWidth,
  formatTableWidths,
  parseTableWidths,
  remarkTableWidths,
  resolveTableWidths,
  tableHeaders,
} from '../src/lib/markdown-table-widths'

const roundTrip = (headers: string[], widths: (number | null)[]) => {
  const comment = formatTableWidths(headers, widths)!
  return resolveTableWidths(parseTableWidths(comment)!, headers)
}

describe('formatTableWidths and parseTableWidths', () => {
  it('names the columns that have a width, and writes nothing when none do', () => {
    expect(formatTableWidths(['Item', 'Room', 'Cost'], [140, null, 72])).toBe('<!-- table widths: Item=140, Cost=72 -->')
    expect(formatTableWidths(['Item', 'Room'], [null, null])).toBeNull()
  })

  it('round-trips headers that need quoting, and they cannot end the comment', () => {
    const headers = ['Cost, each', 'a=b', 'say "hi"', 'x --> y', '#3']
    const widths = [100, 110, 120, 130, 140]
    const comment = formatTableWidths(headers, widths)!
    expect(comment.indexOf('-->')).toBe(comment.length - 3)
    expect(roundTrip(headers, widths)).toEqual(widths)
  })

  it('uses a place for a blank or repeated header', () => {
    expect(formatTableWidths(['Name', '', 'Name'], [100, 110, 120])).toBe('<!-- table widths: #1=100, #2=110, #3=120 -->')
    expect(roundTrip(['Name', '', 'Name'], [100, 110, 120])).toEqual([100, 110, 120])
  })

  it('reads only its own comment', () => {
    expect(parseTableWidths('<!-- a note -->')).toBeNull()
    expect(parseTableWidths('<div>table widths: a=1</div>')).toBeNull()
    expect(parseTableWidths('<!-- table widths: -->')).toBeNull()
    expect(parseTableWidths('<!-- table widths: Item=wide -->')).toBeNull()
    expect(parseTableWidths('<!-- table widths: Item=100, -->')).toBeNull()
  })
})

describe('resolveTableWidths, when the text changed outside the editor', () => {
  const entries = parseTableWidths('<!-- table widths: Item=140, Cost=72 -->')!

  it('a moved column keeps its width', () => {
    expect(resolveTableWidths(entries, ['Cost', 'Room', 'Item'])).toEqual([72, null, 140])
  })
  it('a new column is automatic, and a deleted one is ignored', () => {
    expect(resolveTableWidths(entries, ['Item', 'New', 'Room', 'Cost'])).toEqual([140, null, null, 72])
    expect(resolveTableWidths(entries, ['Item', 'Room'])).toEqual([140, null])
  })
  it('a renamed column is automatic', () => {
    expect(resolveTableWidths(entries, ['Thing', 'Room', 'Cost'])).toEqual([null, null, 72])
  })
  it('keeps a width within the limits, and ignores a place past the end', () => {
    expect(resolveTableWidths(parseTableWidths('<!-- table widths: A=1, B=9999, #9=100 -->')!, ['A', 'B'])).toEqual([56, 1200])
  })
})

describe('catchColumnWidth', () => {
  it('catches on the four sizes within 10 pixels, and is free elsewhere', () => {
    expect(catchColumnWidth(150)).toEqual({ width: 160, size: 'M' })
    expect(catchColumnWidth(170)).toEqual({ width: 160, size: 'M' })
    expect(catchColumnWidth(171)).toEqual({ width: 171, size: null })
    expect(catchColumnWidth(390)).toEqual({ width: 384, size: 'XL' })
  })
  it('holds to the minimum', () => {
    expect(catchColumnWidth(10)).toEqual({ width: 56, size: null })
    expect(clampColumnWidth(55.4)).toBe(56)
  })
})

describe('remarkTableWidths', () => {
  const tree = (markdown: string) => {
    const processor = unified().use(remarkParse).use(remarkGfm).use(remarkTableWidths)
    return processor.runSync(processor.parse(markdown)) as unknown as { children: { type: string; children: { children: { columnWidth?: number }[] }[] }[] }
  }
  const TABLE = '| Item | Cost |\n| --- | ---: |\n| Paint | $42 |\n'

  it('takes the comment off the tree and puts each width on every cell of its column', () => {
    const root = tree(`${TABLE}\n<!-- table widths: Cost=72 -->\n\nAfter.\n`)
    expect(root.children.map((node) => node.type)).toEqual(['table', 'paragraph'])
    for (const row of root.children[0].children) {
      expect(row.children[0].columnWidth).toBeUndefined()
      expect(row.children[1].columnWidth).toBe(72)
    }
  })
  it('works with no blank line before the comment', () => {
    expect(tree(`${TABLE}<!-- table widths: Cost=72 -->\n`).children.map((node) => node.type)).toEqual(['table'])
  })
  it('leaves any other comment, or one away from a table', () => {
    expect(tree(`${TABLE}\n<!-- a note -->\n`).children.map((node) => node.type)).toEqual(['table', 'html'])
    expect(tree('Words.\n\n<!-- table widths: Cost=72 -->\n').children.map((node) => node.type)).toEqual(['paragraph', 'html'])
  })
  it('reads a header past its bold and highlight', () => {
    const processor = unified().use(remarkParse).use(remarkGfm)
    const root = processor.parse('| **Item** | =={green}Cost== |\n| --- | --- |\n| a | b |\n') as unknown as { children: Parameters<typeof tableHeaders>[0][] }
    expect(tableHeaders(root.children[0])).toEqual(['Item', 'Cost'])
  })
})

describe('Markdown', () => {
  const TEXT = '| Item | Cost |\n| --- | ---: |\n| Paint | $42 |\n\n<!-- table widths: Item=140 -->\n'

  it("shows a column's width on its cells, and never the comment", () => {
    const html = renderToStaticMarkup(<Markdown>{TEXT}</Markdown>)
    expect(html).not.toContain('table widths')
    expect(html.match(/data-column-width="140"/g)).toHaveLength(2)
    expect(html.match(/--column-width:\s*140px/g)).toHaveLength(2)
  })
  it('on one line too, the comment never shows', () => {
    expect(renderToStaticMarkup(<Markdown inline>{TEXT}</Markdown>)).not.toContain('table widths')
  })
  it('still shows other raw HTML as its characters', () => {
    expect(renderToStaticMarkup(<Markdown>{'<!-- a note -->\n'}</Markdown>)).toContain('&lt;!-- a note --&gt;')
  })
})

describe('mergeMarkdown, a table with widths', () => {
  const table = (comment: string, padded = false) =>
    `${padded ? '| Item  | Cost |\n| ----- | ---: |\n| Paint | $42  |' : '| Item | Cost |\n| - | -: |\n| Paint | $42 |'}\n\n${comment}\n`
  const original = `Before.\n\n${table('<!--  table widths:   Item=140  -->', true)}\nAfter.\n`
  const baseline = `Before.\n\n${table('<!-- table widths: Item=140 -->')}\nAfter.\n`

  it('an edit elsewhere keeps the table and its comment as written', () => {
    const current = `Before, edited.\n\n${table('<!-- table widths: Item=140 -->')}\nAfter.\n`
    expect(mergeMarkdown(original, baseline, current)).toBe(`Before, edited.\n\n${table('<!--  table widths:   Item=140  -->', true)}\nAfter.\n`)
  })
  it('a changed width is an edit to the table', () => {
    const current = `Before.\n\n${table('<!-- table widths: Item=200 -->')}\nAfter.\n`
    expect(mergeMarkdown(original, baseline, current)).toBe(current)
  })
  it('a width set on a table with none adds the comment', () => {
    const plain = 'Before.\n\n| Item | Cost |\n| - | -: |\n| Paint | $42 |\n\nAfter.\n'
    expect(mergeMarkdown(plain, plain, baseline)).toBe(baseline)
  })
  it('the last width taken off removes the comment', () => {
    const plain = 'Before.\n\n| Item | Cost |\n| - | -: |\n| Paint | $42 |\n\nAfter.\n'
    expect(mergeMarkdown(baseline, baseline, plain)).toBe(plain)
  })
  it("a width's change is seen in a highlighted header, where the merge reads the marks as text", () => {
    const withHeader = (width: number) => `| ==Item== | Cost |\n| - | -: |\n| Paint | $42 |\n\n<!-- table widths: Item=${width} -->\n`
    expect(mergeMarkdown(withHeader(140), withHeader(140), withHeader(200))).toBe(withHeader(200))
  })
  it('a comment naming no column stays as written until the table is changed', () => {
    const stale = '| Item | Cost |\n| - | -: |\n| Paint | $42 |\n\n<!-- table widths: Gone=140 -->\n\nAfter.\n'
    const shown = '| Item | Cost |\n| - | -: |\n| Paint | $42 |\n\nAfter.\n'
    const current = '| Item | Cost |\n| - | -: |\n| Paint | $42 |\n\nAfter, edited.\n'
    expect(mergeMarkdown(stale, shown, current)).toBe('| Item | Cost |\n| - | -: |\n| Paint | $42 |\n\n<!-- table widths: Gone=140 -->\n\nAfter, edited.\n')
  })
})
