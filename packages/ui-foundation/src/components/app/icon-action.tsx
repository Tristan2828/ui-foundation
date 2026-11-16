// A command drawn as its icon alone (record page standard 3.2, #R3): an
// outline icon button at the header's button size, its `label` both the
// tooltip shown on hover or focus and the button's accessible name. For
// the universal actions only (Delete, Print notes, Copy link, Pin, Open
// site, Restore, More), each with one icon across the app; a record's own
// commands (New visit, Mark done) stay in words.
//
// It takes every Button prop, so it can be a dialog's trigger as it is:
// `<DialogTrigger render={<IconAction icon={Trash2Icon} label="Delete" tone="destructive" />} />`.
//
// A link (4.123): `render={<Link to="/print" />}` or `render={<a href=… />}`
// draws the icon as that link, its tooltip and name kept: the link is the
// tooltip's trigger itself, drawn as the button, so it stays a link with
// its href. A link takes no Button props.
import { isValidElement, type ComponentProps } from 'react'
import { cn } from 'cn'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { IconComponent } from './icon-component'

export type IconActionProps = Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'aria-label'> & {
  /** The action's icon, from the app's icon vocabulary (Lucide `Trash2Icon` for Delete). */
  icon: IconComponent
  /** What the action does ("Delete", "Print notes"): its tooltip and accessible name. */
  label: string
  /**
   * The accessible name, when it says more than the tooltip (4.123):
   * "Delete The Long Walk" for a tooltip of "Delete", so several on a page
   * are told apart. Start it with `label`, so what's seen is what's said.
   */
  accessibleName?: string
  /** `destructive` draws the icon in the destructive tone (Delete). Defaults to `default`. */
  tone?: 'default' | 'destructive'
  /** The button's size: `default` (36px, beside the header's other buttons) or `sm` (32px). */
  size?: 'default' | 'sm'
}

export function IconAction({
  icon: Icon,
  label,
  accessibleName,
  tone = 'default',
  size = 'default',
  variant = 'outline',
  className,
  render,
  ...props
}: IconActionProps) {
  const look = cn(buttonVariants({ variant, size: size === 'sm' ? 'icon-sm' : 'icon' }), className)
  const icon = <Icon aria-hidden="true" className={cn('size-4', tone === 'destructive' && 'text-destructive-text')} />
  return (
    <Tooltip>
      {render && isValidElement(render) ? (
        // A link: the tooltip's trigger is the link itself, drawn as the
        // button. Not through Button, which makes any element it renders a
        // `role="button"` and loses a router Link's href.
        <TooltipTrigger
          render={render}
          data-slot="icon-action"
          data-variant={variant}
          aria-label={accessibleName ?? label}
          className={look}
        >
          {icon}
        </TooltipTrigger>
      ) : (
        <TooltipTrigger
          render={
            <Button
              {...props}
              render={render}
              data-slot="icon-action"
              variant={variant}
              size={size === 'sm' ? 'icon-sm' : 'icon'}
              aria-label={accessibleName ?? label}
              className={className}
            />
          }
        >
          {icon}
        </TooltipTrigger>
      )}
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
