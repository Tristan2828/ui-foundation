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
 * Classes for written text's own elements. No colours on the headings:
 * <Markdown> adds the text colour, and the editor's read-only text is
 * muted as a whole.
 */
export const PROSE = {
  /** `#`: the largest, with a rule under it, so it reads as the top of the outline. */
  heading1: 'type-heading-1 mt-4 border-b border-border pb-1.5 first:mt-0',
  heading2: 'type-heading-2 mt-3 first:mt-0',
  heading3: 'type-heading-3 mt-1 first:mt-0',
  /** `####` and deeper: a label, as before. */
  heading4: 'type-label mt-1 first:mt-0',
  /** Coloured as well as underlined. */
  link: 'text-link underline decoration-link/40 underline-offset-4 transition-colors hover:decoration-link',
  /** `---`: a 2px line in the rule tone, with room around it. */
  rule: 'my-2 h-0.5 rounded-full border-0 bg-rule',
} as const

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
