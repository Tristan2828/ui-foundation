// Highlighted words in Markdown (src/lib/markdown-highlight.ts): which
// `==` marks pair, the colour they carry, and what they're written back as.
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { highlightHandler, remarkHighlightNodes, remarkHighlights } from '../src/lib/markdown-highlight'

type Node = { type: string; children?: Node[]; value?: string; color?: string; data?: { hName?: string; hProperties?: Record<string, string> } }

function paragraph(markdown: string, plugin: () => (tree: unknown) => void): Node[] {
  const processor = unified().use(remarkParse).use(plugin)
  return (processor.runSync(processor.parse(markdown)) as unknown as Node).children![0].children!
}

function roundTrip(markdown: string): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkHighlightNodes)
    .use(remarkStringify, { handlers: { highlight: highlightHandler } } as never)
  return String(processor.processSync(markdown)).trimEnd()
}

describe('highlights', () => {
  it('reads each colour, amber when none is named', () => {
    const [plain, yellow, green, red] = ['==a==', '=={yellow}b==', '=={green}c==', '=={red}d=='].map((md) => paragraph(md, remarkHighlightNodes)[0])
    expect([plain, yellow, green, red].map((n) => [n.type, n.color])).toEqual([
      ['highlight', 'amber'],
      ['highlight', 'yellow'],
      ['highlight', 'green'],
      ['highlight', 'red'],
    ])
  })

  it('wraps words around other marks, and keeps the text around it', () => {
    const [before, mark] = paragraph('Pack ==the **shared** shelves== first.', remarkHighlightNodes)
    expect(before.value).toBe('Pack ')
    expect(mark.type).toBe('highlight')
    expect(mark.children!.map((n) => n.type)).toEqual(['text', 'strong', 'text'])
  })

  it('leaves a lone mark, spaced marks and code as text', () => {
    for (const md of ['a == b', '== a ==', 'one ==open', '`==x==`']) {
      expect(paragraph(md, remarkHighlightNodes).some((n) => n.type === 'highlight')).toBe(false)
    }
  })

  it('draws a mark element with the colour for <Markdown>', () => {
    const [mark] = paragraph('=={red}careful==', remarkHighlights)
    expect(mark.data).toEqual({ hName: 'mark', hProperties: { dataColor: 'red' } })
  })

  it('writes back what it read', () => {
    for (const md of ['==amber==', '=={green}go== and =={red}stop==', 'a ==b **c** d== e']) expect(roundTrip(md)).toBe(md)
  })
})
