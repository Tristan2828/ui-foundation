// The six status kinds (4.98, record standard 5B) and how each is drawn:
// StatusMark (components/app/status-mark.tsx) reads these. The icons are
// one map, STATUS_KIND_ICONS: changing one here changes it everywhere.
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CirclePauseIcon,
  CircleSlash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { IconComponent } from '@/components/app/icon-component'

export type StatusKind = 'active' | 'planned' | 'paused' | 'done' | 'ended' | 'attention'

/** Every kind, in the order a legend lists them. */
export const STATUS_KINDS: readonly StatusKind[] = ['active', 'planned', 'paused', 'done', 'ended', 'attention']

/** Each kind's icon: the one place to change them. */
export const STATUS_KIND_ICONS: Record<StatusKind, IconComponent> = {
  active: CircleDotIcon,
  planned: CircleDashedIcon,
  paused: CirclePauseIcon,
  done: CircleCheckIcon,
  ended: CircleSlash2Icon,
  attention: TriangleAlertIcon,
}

/** Each kind's word, when the status has none of its own (a legend). */
export const STATUS_KIND_LABELS: Record<StatusKind, string> = {
  active: 'Active',
  planned: 'Planned',
  paused: 'Paused',
  done: 'Done',
  ended: 'Ended',
  attention: 'Needs Attention',
}

/**
 * Each kind's colour, for the icon and the word: *-text tokens only. Done
 * is a teal and ended a soft rose (4.110, --status-done-text and
 * --status-ended-text), so a finished or stopped record no longer reads as
 * a grey, disabled one.
 */
export const STATUS_KIND_TONES: Record<StatusKind, string> = {
  active: 'text-success-text',
  planned: 'text-info-text',
  paused: 'text-warning-text',
  done: 'text-status-done-text',
  ended: 'text-status-ended-text',
  attention: 'text-destructive-text',
}
