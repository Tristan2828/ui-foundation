// One emoji drawn as Noto's own SVG, so it looks the same on every device
// (no Noto font draws reliably on iPhone Safari). The pictures are the
// package's emoji/ folder, served at /assets/emoji-18.0/ by the `emoji()`
// Vite plugin; an app adds it to its vite.config.ts. The path is
// root-relative: apps are served at their own root.
//
// EmojiTile is a row's emoji on a small tile (a to-do between its tick
// and its title), with a dashed empty tile for none so titles line up.
import { useState } from 'react'
import { cn } from 'cn'
import { EMOJI_ASSET_PATH, emojiImageName } from './emoji-image'

export type EmojiProps = {
  /** The emoji itself, e.g. `🐶`. */
  emoji: string
  /**
   * What it means, when nothing beside it says so: the image's `alt`.
   * Without one it is decorative (`alt=""` and `aria-hidden`), because the
   * words beside it name the thing.
   */
  label?: string
  /** A `size-*` class sets its size; `size-4` otherwise. */
  className?: string
}

export function Emoji({ emoji, label, className }: EmojiProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const sized = cn('inline-block size-4 shrink-0 align-[-0.125em]', className)
  const hidden = label ? {} : { 'aria-hidden': true as const }
  // No picture (an emoji newer than the set, or one typed elsewhere with a
  // skin tone): the character itself, drawn by the device.
  if (failed === emoji) {
    return (
      <span
        data-slot="emoji"
        data-fallback=""
        role={label ? 'img' : undefined}
        aria-label={label}
        {...hidden}
        className={cn(sized, 'inline-flex items-center justify-center overflow-hidden leading-none')}
      >
        {emoji}
      </span>
    )
  }
  return (
    <img
      data-slot="emoji"
      src={`${EMOJI_ASSET_PATH}${emojiImageName(emoji)}.svg`}
      alt={label ?? ''}
      {...hidden}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(emoji)}
      className={sized}
    />
  )
}

export type EmojiTileProps = {
  /** The emoji, or null, undefined or `''` for the dashed empty tile. */
  emoji?: string | null
  className?: string
}

/**
 * A row's emoji on a 26px tile (`bg-muted`, `border-border`), or a dashed
 * empty tile for none so the titles beside them line up. Always
 * `aria-hidden`: the title beside it is the row's name. Not a control; a
 * row's emoji is set on its record or form.
 */
export function EmojiTile({ emoji, className }: EmojiTileProps) {
  return (
    <span
      data-slot="emoji-tile"
      data-empty={emoji ? undefined : ''}
      aria-hidden="true"
      className={cn(
        'inline-flex size-6.5 shrink-0 items-center justify-center rounded-[7px] border',
        emoji ? 'border-border bg-muted' : 'border-dashed border-border bg-transparent',
        className,
      )}
    >
      {emoji ? <Emoji emoji={emoji} className="size-[15px]" /> : null}
    </span>
  )
}
