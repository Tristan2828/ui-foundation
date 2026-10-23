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
