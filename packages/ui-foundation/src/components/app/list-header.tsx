// A list page's header (list standard L12): the title with its count,
// the New button alone beside it, and everything else behind one ⋯ menu.
// The related screens (Board, Change log) stay out as buttons while
// there's one; two or more fold into the menu with the page's other
// extras, so the row is the same on a list with no siblings and one with
// four. "Show deleted" is the menu's last item, and while it's on a notice
// says so with "Back to the list", so the ⋯ menu and the notice are one
// component and a list can't show deleted records without saying so.
//
// Holds no state: the app keeps `shown` (usually a URL filter). `links`
// are routes, `more` are the app's own actions. The ⋯ button has an
// accessible name and is left out when the menu would be empty.
import { EllipsisIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Link, type To } from 'react-router'
import { cn } from 'cn'
import type { IconComponent } from '@/components/app/icon-component'
import { Notice } from '@/components/app/notice'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ListHeaderLink = { label: string; to: To; icon?: IconComponent }
export type ListHeaderAction = { label: string; onSelect: () => void; icon?: IconComponent }

export type ListHeaderProps = {
  /** The list's name: the page's h1. */
  title: string
  /** How many records there are, beside the title in the muted tone. Left out while loading. */
  count?: number
  /** Related screens (Board, Change log). One stays a button; two or more fold into ⋯. */
  links?: readonly ListHeaderLink[]
  /** The New button: a link to the new-record page, or a function that opens its dialog. */
  newAction?: { label: string; to: To; onClick?: never } | { label: string; onClick: () => void; to?: never }
  /** The page's other actions (Export, Import), in ⋯ after the folded links. */
  more?: readonly ListHeaderAction[]
  /**
   * Soft-deleted records, for a list that has them: "Show deleted" in ⋯,
   * and the notice while it is on. `noun` completes "Showing deleted
   * <noun>" (default "records").
   */
  deleted?: { shown: boolean; onShownChange: (shown: boolean) => void; noun?: string }
  className?: string
}

export function ListHeader({ title, count, links = [], newAction, more = [], deleted, className }: ListHeaderProps) {
  // One link is a button of its own; two or more go in the menu.
  const outLink = links.length === 1 ? links[0] : undefined
  const menuLinks = links.length > 1 ? links : []
  const hasMenu = menuLinks.length > 0 || more.length > 0 || deleted !== undefined
  return (
    <div data-slot="list-header" className={cn('flex flex-col', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="flex items-baseline gap-2 type-page-title text-foreground">
          {title}
          {count !== undefined && (
            <span className="type-body font-normal tabular-nums text-muted-foreground">
              <span className="sr-only">, </span>
              {count}
            </span>
          )}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {outLink && (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link to={outLink.to} />}>
              {outLink.icon && <outLink.icon aria-hidden="true" />}
              {outLink.label}
            </Button>
          )}
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="icon-sm" variant="outline" aria-label={`More for ${title}`} data-slot="list-header-more" />}
              >
                <EllipsisIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {menuLinks.map((link) => (
                  <DropdownMenuItem key={link.label} render={<Link to={link.to} />}>
                    {link.icon && <link.icon aria-hidden="true" />}
                    {link.label}
                  </DropdownMenuItem>
                ))}
                {more.map((action) => (
                  <DropdownMenuItem key={action.label} onClick={action.onSelect}>
                    {action.icon && <action.icon aria-hidden="true" />}
                    {action.label}
                  </DropdownMenuItem>
                ))}
                {deleted && (menuLinks.length > 0 || more.length > 0) && <DropdownMenuSeparator />}
                {deleted && (
                  <DropdownMenuCheckboxItem closeOnClick checked={deleted.shown} onCheckedChange={deleted.onShownChange}>
                    <Trash2Icon aria-hidden="true" />
                    Show deleted
                  </DropdownMenuCheckboxItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {newAction &&
            (newAction.to !== undefined ? (
              <Button size="sm" nativeButton={false} render={<Link to={newAction.to} />}>
                <PlusIcon aria-hidden="true" />
                {newAction.label}
              </Button>
            ) : (
              <Button size="sm" onClick={newAction.onClick}>
                <PlusIcon aria-hidden="true" />
                {newAction.label}
              </Button>
            ))}
        </div>
      </div>
      {/* A status region that is always there, so the notice appearing is announced and the page's first one isn't. */}
      <div role="status" data-slot="list-header-notice" className="not-empty:mt-3">
        {deleted?.shown && (
          <Notice
            tone="info"
            icon={Trash2Icon}
            action={
              <Button size="sm" variant="outline" onClick={() => deleted.onShownChange(false)}>
                Back to the list
              </Button>
            }
          >
            Showing deleted {deleted.noun ?? 'records'}.
          </Notice>
        )}
      </div>
    </div>
  )
}
