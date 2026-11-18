// An option's icon, shared by ChoiceButtons and OptionSelect (4.109): a
// status kind's icon in its colour (StatusMark's, lib/status-kinds.ts), or
// the option's own icon, uncoloured without a kind. Decorative: the
// option's word says it.
import { cn } from 'cn'
import { STATUS_KIND_ICONS, STATUS_KIND_TONES, type StatusKind } from '@/lib/status-kinds'
import type { IconComponent } from './icon-component'

export function OptionIcon({ kind, icon, slot }: { kind?: StatusKind; icon?: IconComponent; slot: string }) {
  const Icon = icon ?? (kind ? STATUS_KIND_ICONS[kind] : undefined)
  if (!Icon) return null
  return (
    <Icon
      aria-hidden="true"
      data-slot={slot}
      data-kind={kind}
      className={cn('size-3.5 shrink-0', kind && STATUS_KIND_TONES[kind])}
    />
  )
}
