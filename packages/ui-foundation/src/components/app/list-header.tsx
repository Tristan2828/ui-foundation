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
//
// `siblings` (4.100) is a switch beside the title between lists that are
// one thing seen three ways (Exercises / Targets / Weak spots): links in a
// segmented row, the one on marked as the current page. They're the
// page's own peers, so they aren't in ⋯, which keeps only what's left
// (Show deleted). On a phone the switch takes its own line under the
// title and scrolls sideways if it must.
//
// `secondaryAction` (4.117) is one more button, beside New and before it,
// for a list's second most common action ("Refresh Now", "Add from
// Catalog"): an outline button, so New stays the primary. On a phone it
// folds into ⋯, the menu's first item, so the row keeps the title, ⋯ and
// New.
import { EllipsisIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Link, NavLink, type To } from 'react-router'
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
/** The one button beside New (4.117): a link to a page, or a function. */
export type ListHeaderSecondaryAction = {
  label: string
  /** Drawn before the words, in the button and in ⋯. */
  icon?: IconComponent
  /** Can't be used now (a refresh in flight): the button and its menu item are disabled. */
  disabled?: boolean
} & ({ to: To; onClick?: never } | { onClick: () => void; to?: never })
/** One list in the `siblings` switch. */
export type ListHeaderSibling = {
  label: string
  to: To
  /** How many records it holds, after its label. */
  count?: number
  /**
   * Whether it's the list showing. Left out, it's the one whose path is
   * the page's (react-router's NavLink, `end`), so set it for siblings
   * told apart by their query string.
   */
  current?: boolean
}

export type ListHeaderProps = {
  /** The list's name: the page's h1. */
  title: string
  /** How many records there are, beside the title in the muted tone. Left out while loading. */
  count?: number
  /** Related screens (Board, Change log). One stays a button; two or more fold into ⋯. */
  links?: readonly ListHeaderLink[]
  /** The New button: a link to the new-record page, or a function that opens its dialog. */
  newAction?: { label: string; to: To; onClick?: never } | { label: string; onClick: () => void; to?: never }
  /**
   * One more button beside New (4.117), for the list's second most common
   * action ("Refresh Now", "Add from Catalog"). An outline button before
   * New, which stays the primary. On a phone it's the first item in ⋯.
   */
  secondaryAction?: ListHeaderSecondaryAction
  /** The page's other actions (Export, Import), in ⋯ after the folded links. */
  more?: readonly ListHeaderAction[]
  /**
   * Soft-deleted records, for a list that has them: "Show deleted" in ⋯,
   * and the notice while it is on. `noun` completes "Showing deleted
   * <noun>" (default "records").
   */
  deleted?: { shown: boolean; onShownChange: (shown: boolean) => void; noun?: string }
  /**
   * Lists that are this one's peers (4.100): a switch beside the title,
   * this list among them. Two or more; fewer draws nothing.
   */
  siblings?: readonly ListHeaderSibling[]
  /** The switch's landmark name: "<title> Lists" unless set. */
  siblingsLabel?: string
  className?: string
}

// The switch: one bordered row, the current list filled. Each link is
// 32px tall (40 on a phone), its focus ring inside the row.
const SIBLING_CLASS =
  'inline-flex min-h-8 shrink-0 items-center gap-1.5 border-r border-border px-3 type-body whitespace-nowrap ' +
  'text-muted-foreground outline-none last:border-r-0 hover:bg-muted hover:text-foreground ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset max-md:min-h-10 ' +
  'aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground'

function SiblingSwitch({ siblings, label }: { siblings: readonly ListHeaderSibling[]; label: string }) {
  return (
    <nav
      aria-label={label}
      data-slot="list-header-siblings"
      className="max-w-full max-md:order-last max-md:basis-full max-md:overflow-x-auto"
    >
      <div className="inline-flex overflow-hidden rounded-md border border-border">
        {siblings.map((sibling) => {
          const inner = (
            <>
              {sibling.label}
              {sibling.count !== undefined && (
                <span className="tabular-nums">
                  <span className="sr-only">, </span>
                  {sibling.count}
                </span>
              )}
            </>
          )
          return sibling.current === undefined ? (
            <NavLink key={sibling.label} to={sibling.to} end className={SIBLING_CLASS}>
              {inner}
            </NavLink>
          ) : (
            <Link
              key={sibling.label}
              to={sibling.to}
              aria-current={sibling.current ? 'page' : undefined}
              className={SIBLING_CLASS}
            >
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function ListHeader({
  title,
  count,
  links = [],
  newAction,
  secondaryAction,
  more = [],
  deleted,
  siblings = [],
  siblingsLabel,
  className,
}: ListHeaderProps) {
  // One link is a button of its own; two or more go in the menu.
  const outLink = links.length === 1 ? links[0] : undefined
  const menuLinks = links.length > 1 ? links : []
  const hasOwnMenu = menuLinks.length > 0 || more.length > 0 || deleted !== undefined
  // The secondary action folds into ⋯ on a phone, so ⋯ is there on a
  // phone even when nothing else is in it (and only there).
  const hasMenu = hasOwnMenu || secondaryAction !== undefined
  const SecondaryIcon = secondaryAction?.icon
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
        {siblings.length > 1 && <SiblingSwitch siblings={siblings} label={siblingsLabel ?? `${title} Lists`} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {outLink && (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link to={outLink.to} />}>
              {outLink.icon && <outLink.icon aria-hidden="true" />}
              {outLink.label}
            </Button>
          )}
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={`More for ${title}`}
                    data-slot="list-header-more"
                    className={hasOwnMenu ? undefined : 'md:hidden'}
                  />
                }
              >
                <EllipsisIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              {/* As wide as its longest item, never wrapping one
                  ("Show Deleted" on one line, 4.105): the trigger is a
                  small icon, so the menu's default width (the trigger's)
                  is too narrow. */}
              <DropdownMenuContent align="end" className="w-max max-w-(--available-width) whitespace-nowrap">
                {secondaryAction && (
                  <>
                    <DropdownMenuItem
                      data-slot="list-header-secondary-item"
                      className="md:hidden"
                      disabled={secondaryAction.disabled}
                      render={secondaryAction.to !== undefined ? <Link to={secondaryAction.to} /> : undefined}
                      onClick={secondaryAction.onClick}
                    >
                      {SecondaryIcon && <SecondaryIcon aria-hidden="true" />}
                      {secondaryAction.label}
                    </DropdownMenuItem>
                    {hasOwnMenu && <DropdownMenuSeparator className="md:hidden" />}
                  </>
                )}
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
                    Show Deleted
                  </DropdownMenuCheckboxItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {secondaryAction &&
            (secondaryAction.to !== undefined && !secondaryAction.disabled ? (
              <Button
                size="sm"
                variant="outline"
                data-slot="list-header-secondary"
                className="max-md:hidden"
                nativeButton={false}
                render={<Link to={secondaryAction.to} />}
              >
                {SecondaryIcon && <SecondaryIcon aria-hidden="true" />}
                {secondaryAction.label}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                data-slot="list-header-secondary"
                className="max-md:hidden"
                disabled={secondaryAction.disabled}
                onClick={secondaryAction.onClick}
              >
                {SecondaryIcon && <SecondaryIcon aria-hidden="true" />}
                {secondaryAction.label}
              </Button>
            ))}
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
                Back to the List
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
