import type { Meta, StoryObj } from '@storybook/react-vite'
import { SAVED_PHOTO, WIDE_PHOTO } from './image-upload.fixtures'
import { Markdown } from './markdown'

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
