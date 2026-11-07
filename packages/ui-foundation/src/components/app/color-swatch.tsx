// A colour the user stored as data (a paint's hex, a label's colour, a
// calendar's colour), shown as a small swatch beside its name. The design
// language's "A stored colour" section is the why of each choice:
//
// - The fill is the stored value, as an inline style: it is data, not a
//   design decision, so no token can hold it. Only a value `storedColor`
//   accepts reaches the style; anything else (missing, empty, a typo, a
//   CSS keyword, `url(...)`) draws the empty swatch, a dashed ring with no
//   fill, so a bad value never paints and never breaks the row.
// - The ring is `border-muted-foreground`: it clears 3:1 against the page,
//   a card and a muted surface in light, dark and every palette (measured
//   in e2e/fixtures-visual.spec.ts), so a stored white on a white card, or
//   a near-black in dark mode, still shows its edge. `--border` and
//   `--input` don't (2.5 to 2.9:1 at best).
// - The swatch is aria-hidden and the name is always rendered beside it:
//   `label` is required, so the colour is never the only way to tell.
import { cn } from 'cn'
import { storedColor } from '@/lib/stored-color'

const SIZES = {
  // Inside a Badge: its icons' 12px (`[&>svg]:size-3`), its gap.
  sm: { swatch: 'size-3', gap: 'gap-1' },
  // In a cell, a list or a line of text: the 16px of a cell's icon (pattern 2).
  default: { swatch: 'size-4', gap: 'gap-2' },
} as const

export interface ColorSwatchProps {
  /** The stored colour: a hex value (`#c0392b`, `c0392b`, `#fff`). Missing or invalid draws the empty swatch. */
  color: string | null | undefined
  /**
   * The colour's name or what it labels ("Hale Navy", "Work"), always shown
   * beside the swatch: the swatch is hidden from screen readers and is never
   * the only way to tell. For a missing colour, say so ("No colour").
   */
  label: string
  /** `sm` inside a Badge, `default` (16px) in a cell or a line of text. */
  size?: keyof typeof SIZES
  className?: string
}

export function ColorSwatch({ color, label, size = 'default', className }: ColorSwatchProps) {
  const fill = storedColor(color)
  const { swatch, gap } = SIZES[size]
  return (
    <span data-slot="color-swatch-label" className={cn('inline-flex min-w-0 items-center', gap, className)}>
      <span
        aria-hidden="true"
        data-slot="color-swatch"
        data-empty={fill ? undefined : ''}
        data-color={fill ?? undefined}
        className={cn(
          'box-border shrink-0 rounded-sm border border-muted-foreground',
          swatch,
          !fill && 'border-dashed',
        )}
        style={fill ? { backgroundColor: fill } : undefined}
      />
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
    </span>
  )
}
