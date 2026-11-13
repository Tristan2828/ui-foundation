// A record's status as an icon, a colour and its word (4.98, record
// standard 5B), the same in a table's cell, a record's header and a
// select's options. Every status an app has sorts into one of six kinds,
// and the kind decides the icon and the colour; the word is the status's
// own ("As needed", "On hold"), so nothing needs learning and the kind
// still reads without colour, by its icon's shape.
//
//   active     In use or under way now            a ring with a dot    success text
//   planned    Not started yet: an idea, queued   a dashed ring        info text
//   paused     Started, then held; expected back  a ring with bars     warning text
//   done       Finished as meant                  a ring with a tick   muted text
//   ended      Stopped without finishing          a ring with a slash  muted text
//   attention  Overdue, failing or blocked        a warning triangle   destructive text
//
// The icons are one map, STATUS_KIND_ICONS (lib/status-kinds.ts): changing one there
// changes it everywhere. A screen can pass its own `icon` for one place.
// Colours are the *-text tokens and the muted foreground only, so the
// word clears 4.5:1 and the icon 3:1 on the page and on a card in both
// themes (the fixtures' axe and glyph checks measure every kind).
import type { ReactNode } from 'react'
import { cn } from 'cn'
import {
  STATUS_KIND_ICONS,
  STATUS_KIND_LABELS,
  STATUS_KIND_TONES,
  type StatusKind,
} from '@/lib/status-kinds'
import type { IconComponent } from './icon-component'

export type StatusMarkProps = {
  kind: StatusKind
  /** The status's own word ("As needed"). Defaults to the kind's (STATUS_KIND_LABELS). */
  children?: ReactNode
  /** This place's own icon, in place of the kind's. */
  icon?: IconComponent
  className?: string
}

/**
 * A status as its kind's icon and colour with its word: a `<span>`, so it
 * goes wherever a badge did (a cell, EntityView's `badges`, an
 * OptionSelect's `render`). The icon is decorative; the word says it.
 */
export function StatusMark({ kind, children, icon, className }: StatusMarkProps) {
  const Icon = icon ?? STATUS_KIND_ICONS[kind]
  return (
    <span
      data-slot="status-mark"
      data-kind={kind}
      className={cn('inline-flex min-w-0 items-center gap-1.5 type-label whitespace-nowrap', STATUS_KIND_TONES[kind], className)}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{children ?? STATUS_KIND_LABELS[kind]}</span>
    </span>
  )
}
