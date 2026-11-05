import type { Meta, StoryObj } from '@/fixtures/types'
import { useId, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import type { ImageUpload } from '@/lib/image-file'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewSection } from './entity-view'
import { FOLDING_SAMPLE, startFolded } from './folding.fixtures'
import { Markdown } from './markdown'
import { NotesOutline } from './notes-outline'
import { RichTextEditor, type RichTextEditorProps } from './rich-text-editor'
import { MARKDOWN_FIXTURES } from './rich-text-editor.fixtures'
import { delayedUpload, failingUpload, SAVED_PHOTO } from './image-upload.fixtures'

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
}) {
  const labelId = useId()
  const [saved, setSaved] = useState(markdown)
  const [problem, setProblem] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2" data-fixture={label}>
      <span id={labelId} className="type-label text-foreground">
        {label}
      </span>
      <RichTextEditor
        aria-labelledby={labelId}
        defaultValue={markdown}
        onChange={setSaved}
        onProblem={setProblem}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={readOnly}
        toolbar={toolbar}
        upload={upload}
        imageMaxSize={imageMaxSize}
        headingLevel={headingLevel}
        headingFrom={headingFrom}
        foldKey={foldKey}
      />
      {/* What would be saved, for the round-trip spec. */}
      <pre data-testid={`saved-${label}`} className="sr-only">
        {saved}
      </pre>
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
    </div>
  ),
}

// Images uploaded into the text, each editor with a fake upload: one
// that stores the file after 1.2s (paste, drop or the toolbar's Image
// button; a placeholder shows meanwhile), one whose uploads all fail, one
// that takes files up to 1 MB, one with the floating toolbar only (paste
// and drop, no button), and one without `upload`, which handles no files.
// A refusal is a toast (e2e/rich-text-editor.spec.ts "image upload").
export const ImageUploads: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <Labelled label="uploads" markdown={'Paste or drop a photo here.\n'} upload={delayedUpload()} />
      <Labelled label="failing" markdown={'Every upload fails here.\n'} upload={failingUpload()} />
      <Labelled label="sizeLimit" markdown={'Images up to 1 MB.\n'} upload={delayedUpload(300)} imageMaxSize={1024 * 1024} />
      <Labelled label="floating" markdown={'No bar above, paste or drop still upload.\n'} upload={delayedUpload(300)} toolbar="floating" />
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
const WIDE_TABLE = `| Item | Size | Colour | Material | Weight | Supplier | Ordered | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shelf | Large | Grey | Pine | 12kg | Northwind | March | Two boxes |
| Lamp | Small | White | Steel | 2kg | Southgate | April | Bulb extra |

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
        { label: 'Saved notes', value: <pre data-testid="saved-notes" className="font-sans whitespace-pre-wrap">{saved.notes}</pre> },
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
