// Folding by headings (src/lib/markdown-fold.ts): which headings fold,
// their ids, what a folded one hides, and rehypeFold's marks on what
// <Markdown> renders. The editor's side is e2e/folding.spec.ts's.
import { describe, expect, it } from 'vitest'
import { allFoldable, foldPlan, markdownFoldPlan, openAt, openTo, rehypeFold, toggleFold } from '../src/lib/markdown-fold'

const TEXT = `# Plan

Intro.

## Beds

Three beds.

### Soil

Compost.

## Watering

Mornings.

## Empty

# Shopping

- Seeds
`

describe('foldPlan', () => {
  it('ids each top-level heading by level and words, numbering repeats', () => {
    const plan = foldPlan([{ level: 2, text: ' Notes  here ' }, null, { level: 2, text: 'Notes here' }, null, { level: 3, text: 'Notes here' }])
    expect(plan.headings.map((heading) => heading.id)).toEqual(['2:Notes here', '2:Notes here#2', '3:Notes here'])
  })

  it('gives each heading its section: to the next heading of its level or higher', () => {
    const plan = markdownFoldPlan(TEXT)
    const byId = new Map(plan.headings.map((heading) => [heading.id, heading]))
    expect(byId.get('1:Plan')).toMatchObject({ index: 0, end: 9, foldable: true, parents: [] })
    expect(byId.get('2:Beds')).toMatchObject({ index: 2, end: 6, foldable: true, parents: ['1:Plan'] })
    expect(byId.get('3:Soil')).toMatchObject({ index: 4, end: 6, foldable: true, parents: ['1:Plan', '2:Beds'] })
    // A heading with nothing under it has nothing to fold.
    expect(byId.get('2:Empty')).toMatchObject({ foldable: false })
    expect(byId.get('1:Shopping')).toMatchObject({ index: 9, end: 11, foldable: true })
  })

  it('hides the section of a folded heading, sub-headings included, but not the heading', () => {
    expect([...markdownFoldPlan(TEXT, new Set(['2:Beds'])).hidden]).toEqual([3, 4, 5])
    expect([...markdownFoldPlan(TEXT, new Set(['1:Plan'])).hidden]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(markdownFoldPlan(TEXT, new Set(['1:Gone'])).hidden.size).toBe(0)
  })

  it('only folds top-level headings: one in a quote is part of its block', () => {
    const plan = markdownFoldPlan('## A\n\n> ## Quoted\n>\n> text\n\n## B\n')
    expect(plan.headings.map((heading) => heading.id)).toEqual(['2:A', '2:B'])
  })

  it('reads a heading as its words: inline code and formatting, not raw HTML or image text', () => {
    const plan = markdownFoldPlan('## **Bold** `code` <b>x</b> ![alt](/a.png) end\n\ntext\n')
    expect(plan.headings[0].text).toBe('Bold code x end')
  })
})

describe('changing what is folded', () => {
  const plan = markdownFoldPlan(TEXT)

  it('Fold all is every heading with something under it', () => {
    expect([...allFoldable(plan)].sort()).toEqual(['1:Plan', '1:Shopping', '2:Beds', '2:Watering', '3:Soil'])
  })

  it('a jump opens the headings the target sits under, and leaves it as it was', () => {
    expect([...openTo(plan, new Set(['1:Plan', '2:Beds', '3:Soil', '1:Shopping']), '3:Soil')].sort()).toEqual(['1:Shopping', '3:Soil'])
  })

  it('the caret in a block opens every section holding it', () => {
    // Block 5 is Soil's paragraph.
    expect([...openAt(plan, new Set(['1:Plan', '2:Beds', '3:Soil', '2:Watering']), 5)]).toEqual(['2:Watering'])
  })

  it('toggles one heading', () => {
    expect([...toggleFold(new Set(['a']), 'b')]).toEqual(['a', 'b'])
    expect([...toggleFold(new Set(['a', 'b']), 'a')]).toEqual(['b'])
  })
})

type Hast = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Hast[] }

const el = (tagName: string, text: string): Hast => ({ type: 'element', tagName, properties: {}, children: [{ type: 'text', value: text }] })
const newline: Hast = { type: 'text', value: '\n' }

// A tree as remark-rehype hands it over: the blocks with line breaks between them.
function tree(...blocks: Hast[]): Hast {
  return { type: 'root', children: blocks.flatMap((block) => [block, newline]) }
}

function folded(root: Hast, ids: string[]) {
  rehypeFold({ folded: new Set(ids) })(root)
  return (root.children ?? []).filter((node) => node !== newline)
}

describe('rehypeFold', () => {
  const sample = () =>
    tree(el('h1', 'Plan'), el('p', 'Intro.'), el('h2', 'Beds'), el('p', 'Three beds.'), el('h3', 'Soil'), el('p', 'Compost.'), el('h2', 'Watering'), el('p', 'Mornings.'), el('h2', 'Empty'))

  it('marks each top-level heading with its id, label and state', () => {
    const blocks = folded(sample(), ['2:Beds', '2:Empty'])
    expect(blocks[2].properties).toEqual({ dataFoldId: '2:Beds', dataFoldLabel: 'Beds', dataFoldable: 'true', dataFolded: 'true' })
    // A heading with nothing to fold is never folded, whatever is stored.
    expect(blocks[8].properties).toMatchObject({ dataFoldable: 'false', dataFolded: 'false' })
  })

  it('hides the blocks of a folded section, and nothing else', () => {
    const blocks = folded(sample(), ['2:Beds'])
    expect(blocks.filter((node) => node.properties?.hidden).map((node) => node.children?.[0].value)).toEqual(['Three beds.', 'Soil', 'Compost.'])
  })

  it('hides raw HTML at the top level as a paragraph of its characters', () => {
    const blocks = folded(tree(el('h2', 'A'), { type: 'raw', value: '<b>raw</b>' }), ['2:A'])
    expect(blocks[1]).toEqual({ type: 'element', tagName: 'p', properties: { hidden: true }, children: [{ type: 'text', value: '<b>raw</b>' }] })
  })

  it('never hides the footnotes', () => {
    const footnotes: Hast = { type: 'element', tagName: 'section', properties: { dataFootnotes: true }, children: [] }
    const blocks = folded(tree(el('h2', 'A'), el('p', 'x'), footnotes), ['2:A'])
    expect(blocks[2].properties?.hidden).toBeUndefined()
  })
})

