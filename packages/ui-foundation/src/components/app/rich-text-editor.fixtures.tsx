import type { Meta, StoryObj } from '@/fixtures/types'
import { Component, useId, useLayoutEffect, useState, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { foldStore } from '@/hooks/fold-store'
import type { ImageUpload } from '@/lib/image-file'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewSection } from './entity-view'
import { FOLDING_SAMPLE, startFolded } from './folding.fixtures'
import { Markdown } from './markdown'
import { NotesOutline } from './notes-outline'
import { RichTextEditor, type RichTextEditorProps } from './rich-text-editor'
import { holdKeysForNextEditor } from './rich-text-hold-keys'
import { MARKDOWN_FIXTURES } from './rich-text-editor.fixtures'
import { delayedUpload, failingUpload, SAVED_PHOTO } from './image-upload.fixtures'
import { longNote } from './rich-text-long-note.fixtures'

const LONG_NOTE = longNote()

// Every element the editor styles, on screen at once, so axe checks each
// one's contrast and the token check each colour, in both themes.
const SAMPLE = `# Plan

Notes with **bold**, *emphasis*, ~~struck~~ and \`inline code\`, and a
[link to the docs](https://example.com/docs).

Highlights: ==amber==, =={yellow}yellow==, =={green}green== and =={red}red==.

## Steps

1. Measure the desk
2. Order the frame

### Parts

- Fragile parts
- Bulky parts

- [x] Booked the van
- [ ] Told the neighbours

| Part | Width |
| --- | --- |
| Top | 120cm |

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

// A note in which an edit to the first list can't be saved without
// rewriting the second (a `1)` list right before a `10.` one).
const REFUSED_NOTE = '1) a\n2) b\n10. ten\n11. eleven\n\nTail paragraph.\n'

const meta: Meta<typeof RichTextEditor> = {
  title: 'app/RichTextEditor',
  component: RichTextEditor,
  parameters: { controls: { disable: true } },
}

export default meta

function Labelled({
  label,
  markdown,
  placeholder,
  maxLength,
  readOnly,
  toolbar,
  upload,
  imageMaxSize,
  headingLevel,
  headingFrom,
  foldKey,
  tableLook,
  noProblem,
  autoFocus,
  tabStaysInText,
  inline,
  focusKey,
}: {
  label: string
  markdown: string
  placeholder?: string
  maxLength?: number
  readOnly?: boolean
  toolbar?: boolean | 'floating'
  upload?: ImageUpload
  imageMaxSize?: number
  headingLevel?: RichTextEditorProps['headingLevel']
  headingFrom?: RichTextEditorProps['headingFrom']
  foldKey?: string
  tableLook?: RichTextEditorProps['tableLook']
  /** No `onProblem`: the editor says a refusal itself. */
  noProblem?: boolean
  autoFocus?: RichTextEditorProps['autoFocus']
  tabStaysInText?: boolean
  inline?: boolean
  focusKey?: number
}) {
  const labelId = useId()
  const [saved, setSaved] = useState(markdown)
  // How many times it reported a change: opening must report none.
  const [changes, setChanges] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2" data-fixture={label}>
      <span id={labelId} className="type-label text-foreground">
        {label}
      </span>
      <RichTextEditor
        aria-labelledby={labelId}
        defaultValue={markdown}
        onChange={(next) => {
          setSaved(next)
          setChanges((count) => count + 1)
        }}
        onProblem={noProblem ? undefined : setProblem}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={readOnly}
        toolbar={toolbar}
        upload={upload}
        imageMaxSize={imageMaxSize}
        headingLevel={headingLevel}
        headingFrom={headingFrom}
        foldKey={foldKey}
        tableLook={tableLook}
        autoFocus={autoFocus}
        tabStaysInText={tabStaysInText}
        inline={inline}
        focusKey={focusKey}
      />
      {/* What would be saved, for the round-trip spec. */}
      <pre data-testid={`saved-${label}`} className="sr-only">
        {saved}
      </pre>
      <span data-testid={`changes-${label}`} className="sr-only">
        {changes}
      </span>
      {problem && <p className="type-caption text-destructive">{problem}</p>}
    </div>
  )
}

export const Default: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="max-w-xl">
      <Labelled label="Notes" markdown={SAMPLE} />
    </div>
  ),
}

// A 5,000-word note with 13 tables, for the typing-lag budget
// (e2e/rich-text-perf.spec.ts).
export const LongNote: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="max-w-3xl">
      <Labelled label="long note" markdown={LONG_NOTE} />
    </div>
  ),
}

// One editor per fixture, each showing the Markdown it would save
// (e2e/fixtures-visual.spec.ts "rich-text round trip").
export const RoundTrip: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      {Object.entries(MARKDOWN_FIXTURES).map(([name, { markdown }]) => (
        <Labelled key={name} label={name} markdown={markdown} />
      ))}
    </div>
  ),
}

// The editing features, each in its own editor: the placeholder, the
// length count near and over a limit, a link to edit, a task list to
// tick, three lines for the toolbars to format, a table, a callout, and a
// read-only editor
// (e2e/rich-text-editor.spec.ts "editing features", "toolbar").
// Also contrast-checked in both themes, the count's over-the-limit tone
// included.
export const Features: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <Labelled label="empty" markdown="" placeholder="Write a description" />
      <Labelled label="nearLimit" markdown={'Fifty characters of notes, give or take a few.\n'} maxLength={55} />
      <Labelled label="overLimit" markdown={'Thirty characters, and more.\n'} maxLength={20} />
      <Labelled label="links" markdown={'See the [setup guide](https://example.com/setup) for details.\n\nPlain words here.\n'} />
      <Labelled label="tasks" markdown={'- [ ] Open item\n- [x] Done item\n'} />
      <Labelled label="formats" markdown={'Format me here.\n\nSecond line.\n\nThird line.\n'} />
      <Labelled label="table" markdown={'| Part | Count |\n| --- | --- |\n| Top | 1 |\n| Leg | 4 |\n\nAfter the table.\n'} />
      <Labelled label="callout" markdown={'> [!NOTE]\n> Measure twice.\n\nAfter the callout.\n'} />
      <Labelled label="readOnly" markdown={'Saving, so nothing can change.\n'} readOnly />
      {/* No onProblem: an edit the merge refuses is said in the field itself. */}
      <Labelled label="refused" markdown={REFUSED_NOTE} noProblem />
    </div>
  ),
}

// Images uploaded into the text, each editor with a fake upload: one
// that stores the file after 1.2s (paste, drop or the toolbar's Image
// button; a placeholder shows meanwhile), one whose uploads all fail, one
// that takes files up to 1 MB, one with the floating toolbar only (its
// Image button on the "Editor Tools" strip while it has focus), and one without `upload`, which handles no files.
// A refusal is a toast (e2e/rich-text-editor.spec.ts "image upload").
export const ImageUploads: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <Labelled label="uploads" markdown={'Paste or drop a photo here.\n'} upload={delayedUpload()} />
      <Labelled label="failing" markdown={'Every upload fails here.\n'} upload={failingUpload()} />
      <Labelled label="sizeLimit" markdown={'Images up to 1 MB.\n'} upload={delayedUpload(300)} imageMaxSize={1024 * 1024} />
      <Labelled label="floating" markdown={'No bar above: paste, drop or the Image button upload.\n'} upload={delayedUpload(300)} toolbar="floating" />
      <Labelled label="noUpload" markdown={'No upload: files are ignored.\n'} />
      <Toaster />
    </div>
  ),
}

// A note with all three heading levels, in three editors where a page
// would put them: straight under a form's title (`headingLevel={2}`: `#`
// is an <h2>), under a section's <h2> (the default, from <h3>), and deeper
// still (`headingLevel={5}`, `##` and `###` both capped at <h6>), and two
// notes that start below `#` (`headingFrom="text"`). The page's outline never skips a level (axe's heading-order), and each saves
// the Markdown it opened with (e2e/rich-text-editor.spec.ts "heading levels").
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

export const HeadingLevels: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="type-page-title text-foreground">A form with notes</h1>
      <Labelled label="underPage" markdown={LEVELS_NOTE} headingLevel={2} />
      <Labelled label="fromText" markdown={FROM_TEXT_NOTE} headingLevel={2} headingFrom="text" />
      <Labelled label="fromTextDeep" markdown={FROM_TEXT_DEEP_NOTE} headingLevel={2} headingFrom="text" />
      <section aria-labelledby="levels-section" className="flex flex-col gap-6">
        <h2 id="levels-section" className="type-section-title text-foreground">
          A section with notes
        </h2>
        <Labelled label="underSection" markdown={LEVELS_NOTE} />
        <Labelled label="capped" markdown={LEVELS_NOTE} headingLevel={5} />
      </section>
    </div>
  ),
}

// A table wider than the field, which scrolls sideways: its box is a tab
// stop, a region named for its columns, and the arrow keys scroll it. The
// one under it fits, so its box is neither, until enough columns are
// added that it scrolls too (e2e/rich-text-editor.spec.ts "table scroll").
const WIDE_TABLE = `| Item | Size | Colour | Material | Weight | Supplier | Ordered | Warehouse | Condition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shelf | Large | Grey | Pine | 12kg | Northwind | March | Riverside | Unopened | Two boxes |
| Lamp | Small | White | Steel | 2kg | Southgate | April | Hillcrest | Assembled | Bulb extra |

After the wide table.
`

export const WideTable: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <Labelled label="wideTable" markdown={WIDE_TABLE} />
      <Labelled label="narrowTable" markdown={'| Item | Count |\n| --- | --- |\n| Shelf | 2 |\n\nAfter the narrow table.\n'} />
    </div>
  ),
}

// Notes edited where they're read (`editInPlace`'s `inline`, Notion-style):
// the editor from the start, drawn as the text, with the toolbar over a
// selection and the slash menu but no bar above (`toolbar="floating"`).
// Next steps is empty, so it shows the editor's placeholder. Each save
// takes 300ms; Saves counts the requests a server would get
// (e2e/rich-text-inline.spec.ts, axe in both themes there).
function InlineRecord() {
  const [saved, setSaved] = useState({ notes: 'Pack the **shared** shelves first.\n\nThen the desks.\n', next: '' })
  const [saves, setSaves] = useState(0)
  const notes = (field: 'notes' | 'next') =>
    editInPlace<string>({
      kind: 'long-text',
      inline: true,
      value: saved[field],
      save: (text) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            setSaves((count) => count + 1)
            setSaved((current) => ({ ...current, [field]: text }))
            resolve()
          }, 300),
        ),
      control: (props) => (
        <RichTextEditor
          id={props.id}
          defaultValue={props.value}
          onChange={props.onChange}
          onProblem={props.onProblem}
          readOnly={props.disabled}
          inline={props.inline}
          toolbar={props.inline ? 'floating' : true}
          placeholder="Write something, or type / for blocks"
          aria-invalid={props.invalid || undefined}
          aria-label={props.label}
          aria-describedby={props.describedBy}
        />
      ),
    })
  const sections: EntityViewSection[] = [
    {
      title: 'Saved',
      fields: [
        { label: 'Saves', value: <span data-testid="saves">{saves}</span> },
        { label: 'Saved Notes', value: <pre data-testid="saved-notes" className="font-sans whitespace-pre-wrap">{saved.notes}</pre> },
      ],
    },
    { title: 'Notes', content: <Markdown>{saved.notes}</Markdown>, edit: notes('notes') },
    { title: 'Next steps', content: <Markdown>{saved.next}</Markdown>, edit: notes('next') },
  ]
  return <EntityView isLoading={false} back={{ to: '/projects', label: 'Projects' }} title="Office move" sections={sections} />
}

function InlineInRouter() {
  const [router] = useState(() =>
    createMemoryRouter([
      { path: '/', element: <InlineRecord /> },
      { path: '/projects', element: <p>Projects</p> },
    ]),
  )
  return <RouterProvider router={router} />
}

export const Inline: StoryObj<typeof RichTextEditor> = { render: () => <InlineInRouter /> }

// Folding by headings (`foldKey`) while editing, the outline beside: it
// opens with Watering folded (e2e/folding.spec.ts).
function FoldingStory() {
  const foldKey = 'story:editor:folding'
  useState(() => startFolded(foldKey))
  return (
    <div className="flex max-w-3xl flex-col gap-6 md:flex-row">
      <NotesOutline markdown={FOLDING_SAMPLE} foldKey={foldKey} className="md:w-56 md:shrink-0" />
      <div className="min-w-0 flex-1">
        <Labelled label="folding" markdown={FOLDING_SAMPLE} foldKey={foldKey} />
      </div>
    </div>
  )
}

export const Folding: StoryObj<typeof RichTextEditor> = { render: () => <FoldingStory /> }

// Tables (e2e/rich-text-tables.spec.ts): one to edit through its grips in
// each look, and the same text as <Markdown> reads it, a coloured cell
// (its whole text one highlight) and a header column (its first cells
// bold) included. Contrast-checked in both themes there.
const PRICE_TABLE = `| Item | Store | Size | Price |
| --- | --- | --- | ---: |
| Olive oil | Corner shop | 1 L | $12.49 |
| Rice | Market | 2 kg | $8.99 |
| Oats | Corner shop | 1 kg | $4.29 |

After the table.
`

const MARKED_TABLE = `| Item | Size | Price | Note |
| --- | --- | ---: | --- |
| **Olive oil** | 1 L | =={green}$12.49== | Store brand tastes the same, and it keeps for months in a cool cupboard |
| **Rice** | 2 kg | =={red}$8.99== | Only ==partly highlighted== words |
| **Oats** | 1 kg | $4.29 | =={amber}Buy two== |
`

export const Tables: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-6">
      <Labelled label="compactTable" markdown={PRICE_TABLE} />
      <Labelled label="boxedTable" markdown={PRICE_TABLE} tableLook="boxed" />
      <Labelled label="markedTable" markdown={MARKED_TABLE} />
      <section className="flex flex-col gap-2" data-fixture="markdownCompact">
        <h2 className="type-label">markdownCompact</h2>
        <Markdown>{MARKED_TABLE}</Markdown>
      </section>
      <section className="flex flex-col gap-2" data-fixture="markdownBoxed">
        <h2 className="type-label">markdownBoxed</h2>
        <Markdown tableLook="boxed">{MARKED_TABLE}</Markdown>
      </section>
    </div>
  ),
}

// Column widths (e2e/rich-text-table-widths.spec.ts): a table to drag in each
// look, one that already has widths, and those widths as <Markdown> reads
// them, in a note narrower than they add up to in the last.
const PLAIN_WIDTHS = `| Item | Store | Size | Note |
| --- | --- | --- | --- |
| Olive oil | Corner shop | 1 L | Keeps for months in a cool cupboard |
| Rice | Market | 2 kg | Store brand |
`

const SIZED_WIDTHS = `| Item | Cost | Note |
| --- | ---: | --- |
| Olive oil | $12.49 | Keeps for months in a cool cupboard, and the store brand tastes the same |
| Rice | $8.99 | Rinse it first |

<!-- table widths: Item=200, Note=320 -->
`

const WIDE_WIDTHS = `| Item | Note | Where |
| --- | --- | --- |
| Olive oil | Notes that run on across the whole column | Corner shop |

<!-- table widths: Item=300, Note=420, Where=300 -->
`

export const TableWidths: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-6">
      <Labelled label="plain" markdown={PLAIN_WIDTHS} />
      <Labelled label="boxed" markdown={PLAIN_WIDTHS} tableLook="boxed" />
      <Labelled label="sized" markdown={SIZED_WIDTHS} />
      <section className="flex flex-col gap-2" data-fixture="reading">
        <h2 className="type-label">reading</h2>
        <Markdown>{SIZED_WIDTHS}</Markdown>
      </section>
      <section className="flex max-w-md flex-col gap-2" data-fixture="wide" data-print-notes="">
        <h2 className="type-label">wide</h2>
        <Markdown>{WIDE_WIDTHS}</Markdown>
      </section>
    </div>
  ),
}

// An edit form's field: the value held by the form and passed back as
// `defaultValue`, the record loaded only after the editor has mounted
// (the Load button), then reset (e2e/rich-text-editor.spec.ts "a value
// that arrives later").
function LateValueStory() {
  const labelId = useId()
  const [value, setValue] = useState('')
  return (
    <div className="flex max-w-xl flex-col gap-2" data-fixture="lateValue">
      <span id={labelId} className="type-label text-foreground">
        lateValue
      </span>
      <RichTextEditor aria-labelledby={labelId} defaultValue={value} onChange={setValue} />
      <div className="flex gap-2">
        <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => setValue('Loaded **notes**.\n')}>
          Load
        </button>
        <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => setValue('')}>
          Reset
        </button>
      </div>
      <pre data-testid="saved-lateValue" className="sr-only">
        {value}
      </pre>
    </div>
  )
}

export const LateValue: StoryObj<typeof RichTextEditor> = { render: () => <LateValueStory /> }

// Starting to type before the editor is up (e2e/rich-text-editor.spec.ts
// "starting"): Write a Note mounts an empty editor with `autoFocus`, as a
// notes app opens on a new note; Close takes it away again. A load that
// fails shows here, with Try Again, which mounts it afresh. Below, an
// inline note there from the start, whose height the spec watches while
// the editor takes the place of the text.
class LoadFailed extends Component<{ name: string; children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return <div key={this.state.attempt}>{this.props.children}</div>
    return (
      <div role="alert" data-load-failed={this.props.name} className="flex flex-col items-start gap-2 type-body text-foreground">
        The editor couldn&apos;t load.
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1"
          onClick={() => this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }))}
        >
          Try Again
        </button>
      </div>
    )
  }
}

function StartingStory() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex gap-2">
        <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => setOpen(true)}>
          Write a Note
        </button>
        <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {open && (
        <LoadFailed name="jot">
          <Labelled label="jot" markdown="" placeholder="Write something" autoFocus />
        </LoadFailed>
      )}
      <LoadFailed name="inlineNote">
        <Labelled label="inlineNote" markdown={'Pack the shared shelves first.\n\nThen the desks, then the chairs.\n'} inline toolbar="floating" />
      </LoadFailed>
    </div>
  )
}

export const Starting: StoryObj<typeof RichTextEditor> = { render: () => <StartingStory /> }

// `autoFocus="end"`: a long note opened with the caret after its last
// words, in view, though a divider ends it (e2e/rich-text-editor.spec.ts
// "caret at the end").
const LONG_ENDING = `${Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1} of the note.`).join('\n\n')}\n\nLast words.\n\n---\n`

export const AutoFocusEnd: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="max-w-xl">
      <Labelled label="ending" markdown={LONG_ENDING} autoFocus="end" />
    </div>
  ),
}

// `autoFocus="end"` on a note whose last section is folded: the caret goes
// to the end of that section's heading, and the section stays folded.
const FOLDED_ENDING = 'Intro words.\n\n## Later {toggle="true"}\n\nFolded words.\n'
const FOLDED_KEY = 'story:editor:folded-ending'

function FoldedEndingStory() {
  useState(() => foldStore.set(FOLDED_KEY, new Set(['2:Later'])))
  return (
    <div className="max-w-xl">
      <Labelled label="foldedEnding" markdown={FOLDED_ENDING} foldKey={FOLDED_KEY} autoFocus="end" />
    </div>
  )
}

export const AutoFocusFoldedEnd: StoryObj<typeof RichTextEditor> = { render: () => <FoldedEndingStory /> }

// `tabStaysInText`, for an editor that is the page: Tab on a plain line
// stays in the text; Esc, then Tab, moves on (e2e/rich-text-editor.spec.ts
// "Tab stays in the text"). Inline, with the floating toolbar, as a notes
// app has it: its tools strip, and Full Screen, come after the text.
export const TabStays: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <button type="button" className="self-start rounded-md border border-border px-2 py-1">
        Before
      </button>
      <Labelled label="page" markdown={'First line.\n\n- An item\n- Another\n'} inline toolbar="floating" tabStaysInText />
      <button type="button" className="self-start rounded-md border border-border px-2 py-1">
        After
      </button>
    </div>
  ),
}

// Spaces at a line's start (e2e/rich-text-editor.spec.ts "spaces"): a
// paragraph and a heading to type them into, inline code that keeps its
// own, and a note that already holds an escaped space.
export const Spaces: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <Labelled label="paragraph" markdown={'First words.\n'} />
      <Labelled label="heading" markdown={'## Title\n\nUnder it.\n'} />
      <Labelled label="code" markdown={'`  spaced` code first.\n'} />
      <Labelled label="escaped" markdown={'&#x20; escaped start.\n\nSecond.\n'} />
    </div>
  ),
}

// `focusKey`: a note kept mounted behind another tab, hidden, and focused
// again as it comes back to the front (e2e/rich-text-editor.spec.ts "focus
// again"). Show Note bumps `focusKey`; Show Note, Page Focus focuses the
// editable element itself, as an app without `focusKey` would.
function FocusAgainStory() {
  const [front, setFront] = useState<'note' | 'other'>('note')
  const [focusKey, setFocusKey] = useState(0)
  const [pageFocus, setPageFocus] = useState(0)
  useLayoutEffect(() => {
    if (pageFocus) document.querySelector<HTMLElement>('[data-fixture="tabNote"] [contenteditable]')?.focus()
  }, [pageFocus])
  const button = 'rounded-md border border-border px-2 py-1'
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          className={button}
          onClick={() => {
            setFront('note')
            setFocusKey((key) => key + 1)
          }}
        >
          Show Note
        </button>
        <button
          type="button"
          className={button}
          onClick={() => {
            setFront('note')
            setPageFocus((count) => count + 1)
          }}
        >
          Show Note, Page Focus
        </button>
        <button type="button" className={button} onClick={() => setFront('other')}>
          Show Other
        </button>
      </div>
      <div hidden={front !== 'note'}>
        <Labelled label="tabNote" markdown={'First line here.\n\nSecond line.\n'} focusKey={focusKey} />
      </div>
      <div hidden={front !== 'other'}>
        <input aria-label="Other field" className="rounded-md border border-input px-2 py-1" />
      </div>
    </div>
  )
}

export const FocusAgain: StoryObj<typeof RichTextEditor> = { render: () => <FocusAgainStory /> }

// `holdKeysForNextEditor()`: keys typed before the note's editor exists
// (e2e/rich-text-editor.spec.ts "keys before the editor"). New Note holds
// the keys, then mounts an `autoFocus` editor 600 ms later, as a notes
// app's request does; New Note, Short Wait lets go after 300 ms, and its
// editor comes at 1.5 s; Open Note mounts one at once, holding nothing, so
// the editor holds its own keys while its code loads. How many keydowns
// reached the page from outside the fixtures (the held textarea, a button)
// is counted beside them. It's all in a <main>, as an app's page is, so axe
// can tell whether a held textarea sits inside the page's landmarks.
// With `&start` in its address it holds the keys as an app's start does,
// before anything (its <main> included) has rendered, and its note comes
// 1.5 s later.
function NextEditorStory() {
  const [note, setNote] = useState(0)
  useState(() => {
    if (!new URLSearchParams(window.location.search).has('start')) return
    holdKeysForNextEditor()
    setTimeout(() => setNote(1), 1500)
  })
  const [presses, setPresses] = useState(0)
  const [pageKeys, setPageKeys] = useState(0)
  useLayoutEffect(() => {
    const count = (event: KeyboardEvent) => {
      if (!(event.target instanceof Element && event.target.closest('[data-fixture]'))) setPageKeys((keys) => keys + 1)
    }
    document.addEventListener('keydown', count)
    return () => document.removeEventListener('keydown', count)
  }, [])
  const press = (timeout?: number) => {
    holdKeysForNextEditor({ timeout })
    setPresses((count) => count + 1)
    setTimeout(() => setNote((count) => count + 1), timeout ? 1500 : 600)
  }
  const button = 'rounded-md border border-border px-2 py-1'
  return (
    <main className="flex max-w-xl flex-col gap-4">
      <div className="flex gap-2">
        <button type="button" className={button} onClick={() => press()}>
          New Note
        </button>
        <button type="button" className={button} onClick={() => press(300)}>
          New Note, Short Wait
        </button>
        <button type="button" className={button} onClick={() => setNote((count) => count + 1)}>
          Open Note
        </button>
        <input aria-label="Search notes" className="rounded-md border border-input px-2 py-1" />
      </div>
      <p className="type-caption text-muted-foreground">
        Presses: <span data-testid="presses">{presses}</span>, keys on the page: <span data-testid="page-keys">{pageKeys}</span>
      </p>
      {note > 0 && <Labelled key={note} label="next" markdown="" placeholder="Write something" autoFocus />}
    </main>
  )
}

export const NextEditor: StoryObj<typeof RichTextEditor> = { render: () => <NextEditorStory /> }
