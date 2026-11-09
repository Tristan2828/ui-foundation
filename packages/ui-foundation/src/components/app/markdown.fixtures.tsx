import type { Meta, StoryObj } from '@/fixtures/types'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { useState } from 'react'
import { DataTable } from './data-table'
import { FOLDING_SAMPLE, startFolded } from './folding.fixtures'
import { SAVED_PHOTO, WIDE_PHOTO } from './image-upload.fixtures'
import { countTasks } from '@/lib/markdown-tasks'
import { Markdown } from './markdown'
import { NotesOutline } from './notes-outline'

// Every element <Markdown> styles, on screen at once, so axe checks each
// one's contrast and the token check each colour, in both themes. The raw
// HTML line proves it renders as text.
const SAMPLE = `# Plan

Notes with **bold**, *emphasis*, ~~struck~~ and \`inline code\`, and a
[link to the docs](https://example.com/docs).

## Steps

1. Measure the desk
2. Order the frame

- Fragile parts
- Bulky parts

- [x] Booked the van
- [ ] Told the neighbours

### Sizes

| Part | Width | Depth |
| --- | --- | --- |
| Top | 120cm | 60cm |
| Frame | 110cm | 55cm |

> Measure twice, cut once.

> [!NOTE]
> The frame ships in two boxes.

> [!TIP]
> Assemble it where it will stand.

> [!IMPORTANT]
> Keep the receipt for the warranty.

> [!WARNING]
> Two people to lift the top.

> [!CAUTION]
> Unplug the motor before cleaning.

\`\`\`
height = 72cm
\`\`\`

---

![A desk frame, assembled](${SAVED_PHOTO})

<b>Raw HTML shows as text</b>
`

const meta: Meta<typeof Markdown> = {
  title: 'app/Markdown',
  component: Markdown,
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj<typeof Markdown> = {
  render: () => (
    <div className="max-w-xl">
      <Markdown>{SAMPLE}</Markdown>
    </div>
  ),
}

// Images in the text, in a narrow column: one far wider than it, inline
// in a sentence, and one with no alt text (decorative). Each stays inside
// the column, loads lazily and keeps its alt text (e2e/images.spec.ts).
export const Images: StoryObj<typeof Markdown> = {
  render: () => (
    <div className="w-80 border border-border p-3">
      <Markdown>
        {`A view of the yard:\n\n![The yard in October](${WIDE_PHOTO})\n\nA sketch ![of the bed](${SAVED_PHOTO}) inline.\n\n![](${SAVED_PHOTO})\n`}
      </Markdown>
    </div>
  ),
}

// The same note where a page would put it: straight under the page's
// title (`headingLevel={2}`), under a section's <h2> (the default, from
// <h3>), and deeper still (`headingLevel={5}`, capped at <h6>), and two
// notes that start below `#` (`headingFrom="text"`). The page's outline never skips a level (axe's heading-order); each level
// looks the same wherever it sits (e2e/rich-text-editor.spec.ts "heading
// levels").
const LEVELS_NOTE = `# Overview

An opening paragraph.

## Details

Some words under the second level.

### Small print

The last words.
`

// Notes with no `#`, as pasted or imported (`headingFrom="text"`): the
// text's own highest heading takes `headingLevel`, so `##` is the <h2>
// under the page's title, and a note starting at `###` starts there too.
const FROM_TEXT_NOTE = `## Imported details

Words from another tool.

### Imported small print

More words.
`

const FROM_TEXT_DEEP_NOTE = `### Deep small print

The deepest words.
`

export const HeadingLevels: StoryObj<typeof Markdown> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="type-page-title text-foreground">A page of notes</h1>
      <Markdown data-testid="underPage" headingLevel={2}>
        {LEVELS_NOTE}
      </Markdown>
      <Markdown data-testid="fromText" headingLevel={2} headingFrom="text">
        {FROM_TEXT_NOTE}
      </Markdown>
      <Markdown data-testid="fromTextDeep" headingLevel={2} headingFrom="text">
        {FROM_TEXT_DEEP_NOTE}
      </Markdown>
      <section aria-labelledby="levels-section" className="flex flex-col gap-6">
        <h2 id="levels-section" className="type-section-title text-foreground">
          A section of notes
        </h2>
        <Markdown data-testid="underSection">{LEVELS_NOTE}</Markdown>
        <Markdown data-testid="capped" headingLevel={5}>
          {LEVELS_NOTE}
        </Markdown>
      </section>
    </div>
  ),
}

// In a narrow column, a table with more columns than fit, even with its
// cells wrapping: its box scrolls sideways, so it's a tab stop and a
// region named for its columns. The table under it fits, and is neither
// (e2e/rich-text-editor.spec.ts "table scroll").
export const WideTable: StoryObj<typeof Markdown> = {
  render: () => (
    <div className="flex w-80 flex-col gap-6 border border-border p-3">
      <Markdown data-testid="wideTable">
        {`A table that scrolls sideways:

| Item | Size | Colour | Material | Weight | Supplier | Ordered | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shelf | Large | Grey | Pine | 12kg | Northwind | March | Two boxes |
`}
      </Markdown>
      <Markdown data-testid="narrowTable">{'| Item | Count |\n| --- | --- |\n| Shelf | 2 |\n'}</Markdown>
    </div>
  ),
}

// Folding by headings (`foldKey`), with the outline beside the text: it
// opens with Watering folded (e2e/folding.spec.ts).
function FoldingStory() {
  const foldKey = 'story:markdown:folding'
  useState(() => startFolded(foldKey))
  return (
    <div className="flex max-w-3xl flex-col gap-6 md:flex-row">
      <NotesOutline markdown={FOLDING_SAMPLE} foldKey={foldKey} className="md:w-56 md:shrink-0" />
      <Markdown foldKey={foldKey} className="min-w-0 flex-1">
        {FOLDING_SAMPLE}
      </Markdown>
    </div>
  )
}

export const Folding: StoryObj<typeof Markdown> = { render: () => <FoldingStory /> }

// `foldable={false}`: the same key and text, headings plain (e2e/folding.spec.ts).
export const FoldingOff: StoryObj<typeof Markdown> = {
  render: () => (
    <Markdown foldKey="story:markdown:folding-off" foldable={false} className="max-w-3xl">
      {FOLDING_SAMPLE}
    </Markdown>
  ),
}

// Task items ticked where they're read (`onTasksChange`): each box a
// checkbox named for its item, nested items, an item in a loose list, a
// numbered one and one in a callout among them; a `- [ ]` in a code block
// stays text. Under it, what would be saved and the count a table's
// column would show (countTasks). Contrast-checked in both themes
// (e2e/fixtures-visual.spec.ts); ticking is e2e/markdown-tasks.spec.ts's.
const TASKS_SAMPLE = `Packing for the move:

- [ ] Book the van
- [x] Order boxes
  - [ ] Small boxes
  - [x] Wardrobe boxes
- A plain bullet

1. [ ] Read the meters

- [ ] Label every box

  Kitchen first, then the bedrooms.

> [!NOTE]
> - [ ] Keep the receipt

\`\`\`
- [ ] not a task, just text
\`\`\`
`

function TickableTasksStory() {
  const [text, setText] = useState(TASKS_SAMPLE)
  const { done, total } = countTasks(text)
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Markdown onTasksChange={setText}>{text}</Markdown>
      <p className="type-caption text-muted-foreground" data-testid="task-count">
        {done}/{total} done
      </p>
      {/* What would be saved, for the spec. */}
      <pre data-testid="saved-tasks" className="sr-only">
        {text}
      </pre>
    </div>
  )
}

export const TickableTasks: StoryObj<typeof Markdown> = { render: () => <TickableTasksStory /> }

// Ticks saved over a network: one save that lands after 600ms (two quick
// ticks both show at once, and both are saved), one that always fails
// (the box goes back). e2e/markdown-tasks.spec.ts.
const SLOW_SAMPLE = '- [ ] Water the ferns\n- [ ] Feed the fish\n'

function SlowSave({ label, fails }: { label: string; fails?: boolean }) {
  const [text, setText] = useState(SLOW_SAMPLE)
  const save = (next: string) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        if (fails) return reject(new Error('Could not save'))
        setText(next)
        resolve()
      }, 600),
    )
  return (
    <div className="flex flex-col gap-2" data-fixture={label}>
      <span className="type-label text-foreground">{label}</span>
      <Markdown onTasksChange={save}>{text}</Markdown>
      <pre data-testid={`saved-${label}`} className="sr-only">
        {text}
      </pre>
    </div>
  )
}

export const TasksSavedSlowly: StoryObj<typeof Markdown> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <SlowSave label="slow" />
      <SlowSave label="failing" fails />
    </div>
  ),
}

// `inline`: one-line values in a table's cells, each row as tall as the
// plain one (Chores), in the cell's own font and colour (Notes is muted).
// A list, a table and two paragraphs written in a value still read. A
// row click opens it ("Opened: …"), as does a click on the card of the
// app's own below; a link in either opens only the link.
// e2e/markdown-inline.spec.ts.
type Chore = { id: number; chore: string; notes: string }
const CHORES: Chore[] = [
  { id: 1, chore: 'Plain', notes: 'Waiting on the landlord' },
  { id: 2, chore: 'Marks', notes: '**Due Friday**, *maybe sooner*: see [the lease](https://example.com/lease), clause `4.2`' },
  { id: 3, chore: 'A list', notes: '- milk\n- eggs\n- [x] bread' },
  { id: 4, chore: 'A table', notes: '| Size | Price |\n| --- | ---: |\n| S | $4 |\n| L | $6 |' },
  { id: 5, chore: 'Paragraphs', notes: '# Heading\n\nFirst thought.\n\nSecond, with *emphasis*.' },
]
const CHORE_COLUMNS: LegacyColumnDef<Chore, unknown>[] = [
  { accessorKey: 'chore', header: 'Chore' },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        <Markdown inline>{row.original.notes}</Markdown>
      </span>
    ),
  },
]
const noop = () => {}

function InlineStory() {
  const [opened, setOpened] = useState('nothing yet')
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <DataTable<Chore>
        columns={CHORE_COLUMNS}
        data={CHORES}
        total={CHORES.length}
        page={1}
        pageSize={CHORES.length}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={false}
        getRowId={(row) => String(row.id)}
        onRowClick={(row) => setOpened(row.chore)}
        emptyTitle="No chores"
      />
      <p className="type-body text-foreground" data-testid="opened">
        Opened: {opened}
      </p>
      {/* A card of the app's own that opens on a click anywhere in it (its
          keyboard way in would be a link of its own, as a row's title is). */}
      <div
        data-testid="clickable-card"
        onClick={() => setOpened('the card')}
        className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-card p-4 text-card-foreground"
      >
        <span className="type-section-title">
          <Markdown inline>{'A card title with **bold** and `code`'}</Markdown>
        </span>
        <span className="type-caption text-muted-foreground">
          <Markdown inline>{'A caption line, *muted*, with a [link](https://example.com)'}</Markdown>
        </span>
      </div>
    </div>
  )
}

export const Inline: StoryObj<typeof Markdown> = { render: () => <InlineStory /> }
