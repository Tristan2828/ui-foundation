// How written text looks, the same in <Markdown> and in the rich-text
// editor: its headings, links and rules (PROSE), and each kind of callout
// (src/lib/markdown-callout.ts says what one is): its name, its icon, and
// its colours. A callout is a wash of the kind's tone behind ordinary text,
// the icon in the tone's text shade, so the text keeps the page's
// contrast and the icon clears 3:1 against the wash. Note is the default
// (what "Callout" inserts).
import {
  InfoIcon,
  LightbulbIcon,
  MessageSquareWarningIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from 'lucide-react'
import type { CalloutKind } from '@/lib/markdown-callout'

/**
 * Classes for written text's own elements.
 *
 * `#` and `##` sit on a full-width tinted band, stronger for `#`, which
 * also has a 2px rule along its foot, so the top of the outline is marked
 * twice. `###` is a small uppercase label. The band's text is always the
 * foreground: the editor's read-only text is muted as a whole, and muted
 * text on the `##` band measures 4.34:1.
 *
 * Where there's a band, the rest of the text (paragraphs, lists, tables,
 * callouts, `###` and deeper) is inset by its padding, PROSE_INSET, so it
 * lines up with the words inside the band rather than its edge.
 */
export const PROSE = {
  /** `#`: the largest, on the stronger band with a rule along its foot. */
  heading1:
    'type-heading-1 mt-4 rounded-t-sm border-b-2 border-rule bg-heading-band px-3 py-2 text-foreground first:mt-0',
  heading2: 'type-heading-2 mt-5 rounded-sm bg-muted px-3 py-1.25 text-foreground first:mt-0',
  /** `###`: a small uppercase label in the muted tone, no band. */
  heading3: 'type-heading-3 mt-0.5 uppercase tracking-[0.08em] text-muted-foreground first:mt-0',
  /** `####` and deeper: a label, as before. */
  heading4: 'type-label mt-1 first:mt-0',
  /** Coloured as well as underlined. */
  link: 'text-link underline decoration-link/40 underline-offset-4 transition-colors hover:decoration-link',
  /** `---`: a 2px line in the rule tone, with room around it. */
  rule: 'my-2 h-0.5 rounded-full border-0 bg-rule',
} as const

/**
 * A heading's fold button (`foldKey`), before its words, the line's height
 * so it sits on the first line of a heading that wraps. Its chevron points
 * down while the section shows and right while it's folded.
 */
export const FOLD_BUTTON =
  '-ml-1 flex h-[1lh] w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50'

/** A heading with a fold button: the button and the words side by side, the look on both. */
export const FOLD_HEADING = 'flex items-start gap-1'

/**
 * On the text's container: when it has a band (a `#` or `##`, marked
 * `data-band`, whatever element its `headingLevel` makes it), everything
 * else is inset by the band's 12px padding, so the text lines up with the
 * words in the band. Text with no band stays flush, where the section's
 * own text starts. A margin, so a list's own indent and a table's or
 * callout's box keep theirs.
 */
export const PROSE_INSET = '[&:has(>[data-band])>:not([data-band])]:mx-3'

/**
 * The HTML level a heading in the text can render as. `headingLevel` on
 * <Markdown> and the editor is the one `#` renders as: where the text
 * sits in the page's outline (2 straight under the page's <h1>, 3 under a
 * section's <h2>, the default).
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/** `#` renders as an <h3>: the page owns the <h1> and each section its <h2>. */
export const DEFAULT_HEADING_LEVEL: HeadingLevel = 3

/**
 * Which heading in the text takes `headingLevel`: `'hash'` (the default),
 * `#`, whatever the text holds; `'text'`, the text's own highest heading,
 * so notes that start at `##` (an export from Notion, a README) put their
 * first heading straight under the page's, not a level further down.
 */
export type HeadingFrom = 'hash' | 'text'

/**
 * The element a heading renders as, by its Markdown level (1 for `#`) and
 * the level `#` renders as: `##` one below it, `###` two below, and so on,
 * never past <h6>. `textTop` is the level that renders at `top` instead
 * of `#` (`headingFrom="text"`: the text's highest), and a heading above
 * it renders at `top` too. Only the element follows the page; the look
 * (the band, the label) stays the Markdown level's (headingClass), so a
 * `#` looks like a `#` wherever it sits.
 */
export function headingTag(level: number, top: HeadingLevel = DEFAULT_HEADING_LEVEL, textTop = 1): `h${HeadingLevel}` {
  const markdown = Math.max(1, Math.floor(level) || 1)
  const below = Math.max(0, markdown - Math.max(1, Math.floor(textTop) || 1))
  return `h${Math.min(top + below, 6) as HeadingLevel}`
}

/** Whether a heading sits on a band (`#` and `##`): the text beside it is inset (PROSE_INSET). */
export function headingBand(level: number): boolean {
  return level <= 2
}

/** A heading's classes by its Markdown level (1 for `#`). */
export function headingClass(level: number): string {
  return level === 1 ? PROSE.heading1 : level === 2 ? PROSE.heading2 : level === 3 ? PROSE.heading3 : PROSE.heading4
}

export type CalloutLook = {
  label: string
  icon: LucideIcon
  /** The box's wash and border. */
  box: string
  /** The icon's tint. */
  tint: string
}

export const CALLOUT_LOOK: Record<CalloutKind, CalloutLook> = {
  note: { label: 'Note', icon: InfoIcon, box: 'bg-info/10 border-info/25', tint: 'text-info-text' },
  tip: { label: 'Tip', icon: LightbulbIcon, box: 'bg-success/10 border-success/25', tint: 'text-success-text' },
  important: {
    label: 'Important',
    icon: MessageSquareWarningIcon,
    box: 'bg-category-2/10 border-category-2/25',
    tint: 'text-category-2',
  },
  warning: { label: 'Warning', icon: TriangleAlertIcon, box: 'bg-warning/10 border-warning/25', tint: 'text-warning-text' },
  caution: {
    label: 'Caution',
    icon: OctagonAlertIcon,
    box: 'bg-destructive/10 border-destructive/25',
    tint: 'text-destructive-text',
  },
}

/** The box every callout shares: the icon in a column, the text beside it. */
export const CALLOUT_BOX = 'flex gap-2.5 rounded-lg border px-3 py-2.5'
