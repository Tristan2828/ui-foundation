import type { Meta, StoryObj } from '@storybook/react-vite'
import { useId, useState } from 'react'
import { RichTextEditor } from './rich-text-editor'
import { MARKDOWN_FIXTURES } from './rich-text-editor.fixtures'

// Every element the editor styles, on screen at once, so axe checks each
// one's contrast and the token check each colour, in both themes.
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

| Part | Width |
| --- | --- |
| Top | 120cm |

> Measure twice, cut once.

\`\`\`
height = 72cm
\`\`\`

---

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
}: {
  label: string
  markdown: string
  placeholder?: string
  maxLength?: number
  readOnly?: boolean
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
// (e2e/storybook-visual.spec.ts "rich-text round trip").
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
// tick, three lines for the toolbars to format, and a read-only editor
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
      <Labelled label="readOnly" markdown={'Saving, so nothing can change.\n'} readOnly />
    </div>
  ),
}
