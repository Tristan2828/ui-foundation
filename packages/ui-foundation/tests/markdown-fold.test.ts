// Folding by toggle headings (src/lib/markdown-fold.ts): which headings fold,
// their ids, what a folded one hides, and rehypeFold's marks on what
// <Markdown> renders. The editor's side is e2e/folding.spec.ts's.
import { describe, expect, it } from 'vitest'
import { allFoldable, foldPlan, markdownFoldPlan, openAt, openTo, rehypeFold, toggleFold } from '../src/lib/markdown-fold'

const T = ' {toggle="true"}'

// Every heading a toggle heading.
const TEXT = `# Plan${T}

Intro.

## Beds${T}

Three beds.

### Soil${T}

Compost.

## Watering${T}

Mornings.

## Empty${T}

# Shopping${T}

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

  it('folds only toggle headings: a plain one has no fold, folded or not, but still ends the sections above it', () => {
    const text = `## Beds${T}\n\nThree beds.\n\n### Soil\n\nCompost.\n\n## Watering\n\nMornings.\n`
    const plan = markdownFoldPlan(text)
    const byId = new Map(plan.headings.map((heading) => [heading.id, heading]))
    expect(byId.get('2:Beds')).toMatchObject({ toggle: true, foldable: true, end: 4 })
    expect(byId.get('3:Soil')).toMatchObject({ toggle: false, foldable: false })
    expect(byId.get('2:Watering')).toMatchObject({ toggle: false, foldable: false })
    expect([...allFoldable(plan)]).toEqual(['2:Beds'])
    // Stored folds of headings that are plain now (or always were) hide nothing.
    expect(markdownFoldPlan(text, new Set(['3:Soil', '2:Watering'])).hidden.size).toBe(0)
    expect([...markdownFoldPlan(text, new Set(['2:Beds'])).hidden]).toEqual([1, 2, 3])
  })

  it("a toggle heading's marker isn't in its words, so its id is the same plain or toggle", () => {
    const plan = markdownFoldPlan(`## Safety first${T}\n\nx\n\n## Also {toggle='true'}\n\ny\n\n## Not {toggle="false"}\n\nz\n`)
    expect(plan.headings.map((heading) => [heading.id, heading.toggle])).toEqual([
      ['2:Safety first', true],
      ['2:Also', true],
      ['2:Not {toggle="false"}', false],
    ])
  })

  it('only folds top-level headings: one in a quote is part of its block', () => {
    const plan = markdownFoldPlan(`## A${T}\n\n> ## Quoted${T}\n>\n> text\n\n## B${T}\n`)
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

// A toggle heading as remarkToggleHeadings leaves it (`plain` for a plain one), or any other element.
const el = (tagName: string, text: string, plain = false): Hast => ({
  type: 'element',
  tagName,
  properties: /^h\d$/.test(tagName) && !plain ? { dataToggle: 'true' } : {},
  children: [{ type: 'text', value: text }],
})
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
    expect(blocks[2].properties).toEqual({
      dataToggle: 'true',
      dataFoldId: '2:Beds',
      dataFoldLabel: 'Beds',
      dataFoldable: 'true',
      dataFolded: 'true',
    })
    // A heading with nothing to fold is never folded, whatever is stored.
    expect(blocks[8].properties).toMatchObject({ dataFoldable: 'false', dataFolded: 'false' })
  })

  it('hides the blocks of a folded section, and nothing else', () => {
    const blocks = folded(sample(), ['2:Beds'])
    expect(blocks.filter((node) => node.properties?.hidden).map((node) => node.children?.[0].value)).toEqual(['Three beds.', 'Soil', 'Compost.'])
  })

  it('marks a plain heading not a toggle, never foldable, and hides nothing for it', () => {
    const blocks = folded(tree(el('h2', 'A', true), el('p', 'x')), ['2:A'])
    expect(blocks[0].properties).toMatchObject({ dataFoldId: '2:A', dataToggle: 'false', dataFoldable: 'false', dataFolded: 'false' })
    expect(blocks[1].properties?.hidden).toBeUndefined()
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

