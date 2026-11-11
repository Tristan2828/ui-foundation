// A command drawn as its icon alone (record page standard 3.2, #R3): an
// outline icon button at the header's button size, its `label` both the
// tooltip shown on hover or focus and the button's accessible name. For
// the universal actions only (Delete, Print notes, Copy link, Pin, Open
// site, Restore, More), each with one icon across the app; a record's own
// commands (New visit, Mark done) stay in words.
//
// It takes every Button prop, so it can be a dialog's trigger as it is:
// `<DialogTrigger render={<IconAction icon={Trash2Icon} label="Delete" tone="destructive" />} />`.
import type { ComponentProps } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { IconComponent } from './icon-component'

export type IconActionProps = Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'aria-label'> & {
  /** The action's icon, from the app's icon vocabulary (Lucide `Trash2Icon` for Delete). */
  icon: IconComponent
  /** What the action does ("Delete", "Print notes"): its tooltip and accessible name. */
  label: string
  /** `destructive` draws the icon in the destructive tone (Delete). Defaults to `default`. */
  tone?: 'default' | 'destructive'
  /** The button's size: `default` (36px, beside the header's other buttons) or `sm` (32px). */
  size?: 'default' | 'sm'
}

export function IconAction({
  icon: Icon,
  label,
  tone = 'default',
  size = 'default',
  variant = 'outline',
  className,
  ...props
}: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            {...props}
            data-slot="icon-action"
            variant={variant}
            size={size === 'sm' ? 'icon-sm' : 'icon'}
            aria-label={label}
            className={className}
          />
        }
      >
        <Icon aria-hidden="true" className={cn('size-4', tone === 'destructive' && 'text-destructive')} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
