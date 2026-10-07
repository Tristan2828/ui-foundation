// Callouts in Markdown (src/lib/markdown-callout.ts): which quotes are
// callouts, what's left of them once the marker is read, and the marker
// they're written back with. The editor's own round trip of the same
// Markdown is the `callouts` fixture (markdown-merge.test.ts here, and the
// Storybook spec in a browser).
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { calloutMarker, remarkCalloutNodes, remarkCallouts } from '../src/lib/markdown-callout'

type Node = { type: string; children?: Node[]; value?: string; kind?: string; marker?: string; data?: unknown }

function nodes(markdown: string): Node[] {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkCalloutNodes)
  return (processor.runSync(processor.parse(markdown)) as unknown as Node).children!
}

function rendered(markdown: string): Node[] {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkCallouts)
  return (processor.runSync(processor.parse(markdown)) as unknown as Node).children!
}

// A node's text, everything under it joined.
function text(node: Node): string {
  return node.value ?? (node.children ?? []).map(text).join('')
}

describe('callouts', () => {
  it('reads each kind, in any case, and keeps the marker as written', () => {
    for (const marker of ['[!NOTE]', '[!tip]', '[!Important]', '[!WARNING]', '[!caution]']) {
      const [callout] = nodes(`> ${marker}\n> Body text.\n`)
      expect(callout.type).toBe('callout')
      expect(callout.kind).toBe(marker.slice(2, -1).toLowerCase())
      expect(callout.marker).toBe(marker)
      expect(text(callout)).toBe('Body text.')
    }
  })

  it('takes the marker paragraph away when the marker was all of it', () => {
    const [callout] = nodes('> [!TIP]\n>\n> - a list first\n')
    expect(callout.children!.map((child) => child.type)).toEqual(['list'])
  })

  it('leaves a quote alone: an unknown kind, words after the marker, or no marker', () => {
    for (const markdown of ['> [!DANGER]\n> x\n', '> [!NOTE] Title\n> x\n', '> A plain quote.\n', '> Text [!NOTE]\n']) {
      expect(nodes(markdown)[0].type).toBe('blockquote')
    }
  })

  it('finds a callout inside a list too', () => {
    const [list] = nodes('- item\n\n  > [!NOTE]\n  > inside\n')
    expect(list.children![0].children![1].type).toBe('callout')
  })

  it('marks one for <Markdown> as a div with its kind', () => {
    const [callout] = rendered('> [!WARNING]\n> Careful.\n')
    expect(callout.data).toEqual({ hName: 'div', hProperties: { dataCallout: 'warning' } })
    expect(text(callout)).toBe('Careful.')
  })

  it('writes the marker as it was written unless the kind changed', () => {
    expect(calloutMarker('note', '[!note]')).toBe('[!note]')
    expect(calloutMarker('warning', '[!note]')).toBe('[!WARNING]')
    expect(calloutMarker('tip', null)).toBe('[!TIP]')
  })
})
