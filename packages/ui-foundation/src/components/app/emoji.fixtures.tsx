import type { Meta, StoryObj } from '@/fixtures/types'
import { Emoji, EmojiTile } from './emoji'

// Emoji drawn as Noto's pictures: beside words (decorative), alone with a
// label, a flag and a ZWJ sequence, one with no picture (the character
// instead), and EmojiTile in to-do-like rows, with the dashed empty tile
// so the titles line up. Axe and the token check run it in both themes
// (e2e/fixtures-visual.spec.ts); e2e/emoji.spec.ts drives it.

function Sizes() {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm">
        <Emoji emoji="🐶" /> Walk the dog
      </p>
      <p className="flex items-center gap-3">
        <Emoji emoji="🧘" label="Person in lotus position" className="size-6" />
        <Emoji emoji="🇺🇸" label="Flag: United States" className="size-6" />
        <Emoji emoji="🏳️‍🌈" label="Rainbow flag" className="size-6" />
        <Emoji emoji="❤️" label="Red heart" className="size-6" />
        <Emoji emoji="1️⃣" label="Keycap: 1" className="size-6" />
        <span data-testid="no-picture">
          <Emoji emoji="👍🏽" label="Thumbs up: medium skin tone" className="size-6" />
        </span>
      </p>
    </div>
  )
}

const ROWS = [
  { emoji: '🧹', title: 'Sweep the porch' },
  { emoji: null, title: 'Call the plumber' },
  { emoji: '💊', title: 'Evening meds' },
]

function TileRows() {
  return (
    <ul className="flex max-w-sm flex-col gap-1">
      {ROWS.map((row) => (
        <li key={row.title} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
          <EmojiTile emoji={row.emoji} />
          <span data-testid="row-title">{row.title}</span>
        </li>
      ))}
    </ul>
  )
}

const meta: Meta = {
  title: 'app/Emoji',
  parameters: { controls: { disable: true } },
}

export default meta

export const Pictures: StoryObj = { render: () => <Sizes /> }

export const Tiles: StoryObj = { render: () => <TileRows /> }
