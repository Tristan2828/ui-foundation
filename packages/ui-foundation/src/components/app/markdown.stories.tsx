import type { Meta, StoryObj } from '@storybook/react-vite'
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
