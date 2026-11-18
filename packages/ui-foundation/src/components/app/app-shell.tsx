import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon, MoonIcon, PaletteIcon, Rows3Icon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { BottomBar, BOTTOM_BAR_PADDING } from '@/components/app/app-shell-bottom-bar'
import {
  activeNavTo,
  childItems,
  childRuns,
  childrenOpen,
  isNavItemGroup,
  navCountSpoken,
  navCountText,
  navGroups,
  navPageLabel,
  navTooltip,
  navTrail,
  trailBackTarget,
  withChildren,
  type BottomBarItem,
  type NavEntry,
  type NavGroup,
  type NavItem,
  type NavItemGroup,
  type NavLook,
} from '@/components/app/app-shell-nav'
import { versionHref, versionLabel, type AppShellVersion } from '@/components/app/app-shell-version'
import { ErrorState } from '@/components/app/error-state'
import { PageTrail, type PageCrumb } from '@/components/app/page-trail'
import { PageTrailContext, type PageTrailSlot } from '@/components/app/page-trail-context'
import { SearchPalette, type AppShellSearch } from '@/components/app/search-palette'
import type { IconComponent } from '@/components/app/icon-component'
import { useErrorReporter } from '@/error-reporting/error-reporting-context'
import { ReportRoutePattern } from '@/error-reporting/error-reporting-provider'
import { useShellDocumentTitle } from '@/hooks/use-document-title'
import { usePalette } from '@/hooks/use-palette'
import { useRows } from '@/hooks/use-rows'
import { clearRecentRecords } from '@/lib/search-palette'
import { isPaletteName, PALETTE_LABELS, PALETTES, type PaletteName } from '@/lib/palettes'
import { isRowsName, ROWS, ROWS_LABELS } from '@/lib/rows'
import { cn } from 'cn'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { OfflineNotice } from '@/components/app/offline-notice'
import { TooltipProvider } from '@/components/ui/tooltip'

export type { BottomBarItem, NavChild, NavEntry, NavItem, NavItemGroup, NavLook, NavSection } from '@/components/app/app-shell-nav'
export type { AppShellVersion } from '@/components/app/app-shell-version'
export type { AppShellSearch, RecentRecord, SearchRecord } from '@/components/app/search-palette'

export type AppShellProps = {
  /**
   * Shown at the top of the sidebar (hidden on the collapsed icon rail), and
   * the app's part of the browser tab's title: "<page> · <title>", the page
   * named by the current nav entry, or the title alone on the home entry
   * ('/'). A screen names its own page with `useDocumentTitle` (EntityView
   * does, with its record's title).
   */
  title: string
  /**
   * The app's mark, shown before `title` at the top of the sidebar, and
   * alone, centred, at the top of the collapsed icon rail. Drawn like an
   * icon (`IconComponent`: sized by the shell, `aria-hidden` passed
   * through) and decorative, since `title` names the app. Its own colours,
   * or `currentColor` for the sidebar's text colour.
   */
  logo?: IconComponent
  /**
   * The app's primary navigation, in order: pages, and labelled sections of
   * pages (`{ label, items }`, one per module, say). A nav with no sections
   * is the single "Navigation" group. One entry is marked active: the most
   * specific whose route matches, so '/tasks' and '/tasks/categories' can
   * both be listed. An entry is matched on its `to`'s path, so `to` can
   * open a list on a saved view ('/tasks?status=open'). A section marked `collapsible` folds under its label,
   * remembered per browser (`defaultOpen` for the first visit); the one
   * holding the current page stays open, and the icon rail shows every
   * section's items. An entry's `children` (a module's own pages) show
   * under it while you're on one of them, under small headings where they
   * are groups (`{ label, items }`). The current entry has the tint and a
   * bar at its start; an entry's `count` shows at its end (a dot on the
   * rail); a section with `placement: 'bottom'` sits at the sidebar's foot.
   * On a phone, a page below an entry shows a back arrow to it in the
   * header (design-language.md "The sidebar and the phone's bar").
   */
  nav: readonly NavEntry[]
  /**
   * More sidebar groups under the primary nav — reference links, say. Built
   * from the sidebar primitives (`@tristan2828/ui-foundation/ui/sidebar`).
   * Rendered inside the Primary landmark, so keep it navigation.
   */
  sidebarExtra?: ReactNode
  /**
   * Whether the sidebar starts expanded for someone who has never toggled
   * it. After the first toggle their choice is remembered (the sidebar
   * primitive writes a cookie, read back here). A wide table wants false.
   */
  defaultSidebarOpen?: boolean
  /**
   * Which build is live, as a short commit in the sidebar footer linking to
   * its PR (or to the commit when there's no PR). Nothing is shown without
   * a commit, so development shows nothing. The values come from
   * `@tristan2828/ui-foundation/vite` (`import.meta.env.VITE_BUILD_*`).
   */
  version?: AppShellVersion
  /**
   * A bar of shortcuts at the bottom of a phone's screen (below the md
   * breakpoint), in thumb reach: at most five, each a page
   * (`{ to, label, icon }`) or a nav section by its label
   * (`{ group: 'Every day', icon }`, with an optional shorter `label`),
   * which opens a sheet of that section's entries (as tiles with
   * `sheet: 'tiles'`). The item holding the
   * current page is marked. The header's menu button stays, for
   * everything, except on a page below a nav entry, where the back arrow
   * takes its place. The shell pads its content so nothing sits under the bar.
   */
  bottomBar?: readonly BottomBarItem[]
  /**
   * How the sidebar draws its groups (design-language.md "The sidebar and
   * the phone's bar"): lists, icon beside label (`'list'`, the default),
   * or `'tiles'`: each group a grid of tiles, icon over a short label,
   * three to a row, with no visible headings (a section's label is kept
   * for screen readers), and the current entry's pages listed under its
   * group's grid, with hairlines in place of their headings. A section's
   * own `look` wins. The icon rail is unchanged, and a `bottomBar` item
   * for a tiles section opens its sheet as tiles, the current entry's
   * pages under them. Keep the labels short: a word or two.
   */
  navLook?: NavLook
  /**
   * Search in the header (#N6): a box ("Search", or `placeholder`) from
   * md up and a button on a phone, both opening a palette (Ctrl K, ⌘K on
   * a Mac) that finds the nav's pages by name and, with `findRecords`,
   * the app's records, listed under their kinds; Enter opens the one
   * highlighted. Before you type it lists the records opened lately
   * (`useRecentRecord`), `recent` of them. No search, no box.
   */
  search?: AppShellSearch
}

// Must match SIDEBAR_COOKIE_NAME in ../ui/sidebar.tsx, which writes the
// cookie on every toggle but never reads it back — that half is here.
const SIDEBAR_COOKIE_NAME = 'sidebar_state'

function storedSidebarOpen(fallback: boolean): boolean {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SIDEBAR_COOKIE_NAME}=([^;]*)`))
  return match ? match[1] === 'true' : fallback
}

// Below the mobile breakpoint the sidebar is a modal sheet, and the
// primitive leaves it open when one of its links navigates, covering the
// page the user just asked for. Keyed on location.key, so following a link
// to the page already showing closes it too. Covers sidebarExtra's links.
function CloseMobileSidebarOnNavigate() {
  const { setOpenMobile } = useSidebar()
  const { key } = useLocation()
  useEffect(() => {
    setOpenMobile(false)
  }, [key, setOpenMobile])
  return null
}

// The header's look control: an app with a palette is always dark (or,
// with a light palette, always light), so it has no light/dark toggle, and with the picker on it gets the look menu
// in its place (design-language.md "Palettes"). With the rows picker the
// same menu offers the table rows (design-language.md "Density"); an app
// without a palette keeps its toggle beside it.
function LookControl() {
  const { palette, picker } = usePalette()
  const rows = useRows()
  const pickPalette = picker && isPaletteName(palette) ? palette : null
  return (
    <>
      {!palette && <ThemeToggle />}
      {(pickPalette || rows.picker) && <LookMenu palette={pickPalette} />}
    </>
  )
}

// Each palette's swatch is its own background with its accent and second
// colour on it, read from the palette primitives, so the menu shows all
// four whichever is on screen.
function PaletteSwatch({ name }: { name: PaletteName }) {
  const colour = (part: string) => `var(--palette-${name}-${part})`
  return (
    <span
      aria-hidden
      className="flex h-4 w-7 shrink-0 items-center justify-center gap-0.5 rounded-sm border border-border"
      style={{ background: colour('background') }}
    >
      <span className="size-2 rounded-full" style={{ background: colour('accent') }} />
      <span className="size-2 rounded-full" style={{ background: colour('second') }} />
    </span>
  )
}

// `palette` is null when only the rows are offered: the trigger is then
// the rows' own.
function LookMenu({ palette }: { palette: PaletteName | null }) {
  const { setPalette } = usePalette()
  const { rows, picker: pickRows, setRows } = useRows()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={palette ? `Palette: ${PALETTE_LABELS[palette]}` : `Rows: ${ROWS_LABELS[rows]}`}
          />
        }
      >
        {palette ? <PaletteIcon /> : <Rows3Icon />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {palette && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Palette on This Device</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={palette}
              onValueChange={(next) => {
                if (isPaletteName(next)) setPalette(next)
              }}
            >
              {PALETTES.map((name) => (
                <DropdownMenuRadioItem key={name} value={name}>
                  <PaletteSwatch name={name} />
                  {PALETTE_LABELS[name]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        )}
        {palette && pickRows && <DropdownMenuSeparator />}
        {pickRows && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Rows on This Device</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={rows}
              onValueChange={(next) => {
                if (isRowsName(next)) setRows(next)
              }}
            >
              {ROWS.map((name) => (
                <DropdownMenuRadioItem key={name} value={name}>
                  {ROWS_LABELS[name]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle Dark Mode"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}

// Hidden on the icon rail, like the user's name beside it.
function VersionEntry({ version }: { version: AppShellVersion }) {
  const label = versionLabel(version)
  if (!label) return null
  const href = versionHref(version)
  const className = 'block truncate px-2 type-caption text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden'
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${className} hover:underline`}>
      {label}
    </a>
  ) : (
    <span className={className}>{label}</span>
  )
}

// The current entry's mark (#N2): the sidebar's tint and a 3px bar in
// the accent at its start, the same mark as a selected or hovered table
// row, in the sidebar and on the rail.
const ACTIVE_MARK = 'data-active:shadow-[inset_3px_0_0_0_var(--primary)]'

// An entry's count (#N3): a plain number at its end in the muted tone,
// read with what it counts; on the icon rail, a dot on the icon.
function NavCount({ count, countLabel }: { count?: number; countLabel?: string }) {
  const text = navCountText(count)
  if (text === undefined) return null
  return (
    <>
      <span
        aria-hidden="true"
        data-slot="nav-count"
        className="ml-auto shrink-0 type-caption text-muted-foreground tabular-nums group-data-[collapsible=icon]:hidden"
      >
        {text}
      </span>
      <span className="sr-only">{navCountSpoken(count, countLabel)}</span>
      <span
        aria-hidden="true"
        data-slot="nav-count-dot"
        className="pointer-events-none absolute top-1 right-1 hidden size-1.5 rounded-full bg-primary group-data-[collapsible=icon]:block"
      />
    </>
  )
}

function NavSubLink({ item, activeTo }: { item: NavItem; activeTo: string | undefined }) {
  const { to, label, icon: Icon, count, countLabel } = item
  const isActive = to === activeTo
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        isActive={isActive}
        className={ACTIVE_MARK}
        render={<Link to={to} aria-current={isActive ? 'page' : undefined} />}
      >
        <Icon />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <NavCount count={count} countLabel={countLabel} />
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

// A heading among a module's pages (#N1): a small label over its pages,
// a list named by it, so a screen reader hears "Money, list".
function NavSubGroup({ group, activeTo }: { group: NavItemGroup; activeTo: string | undefined }) {
  const headingId = useId()
  return (
    <li data-slot="nav-sub-group" className="flex flex-col gap-1">
      <span id={headingId} className="px-2 pt-1.5 type-caption text-sidebar-foreground/70">
        {group.label}
      </span>
      <ul aria-labelledby={headingId} className="flex flex-col gap-1">
        {group.items.map((item) => (
          <NavSubLink key={item.to} item={item} activeTo={activeTo} />
        ))}
      </ul>
    </li>
  )
}

// One group's entries. A plain Link, not NavLink: NavLink marks every
// matching entry current, and only the most specific one should be
// (activeNavTo).
//
// An entry's children (#239) are a list inside its item, so they're read
// as its pages, shown while you're in them (childrenOpen) and otherwise
// in the page but hidden, as a folded section's are. The icon rail has no
// room for them: there the entry looks current while one of them is, and
// its tooltip names them (or their headings).
function NavMenu({
  items,
  activeTo,
  label,
}: {
  items: readonly NavItem[]
  activeTo: string | undefined
  /** Names the list, for a run of pages with no visible heading. */
  label?: string
}) {
  const { state, isMobile } = useSidebar()
  const rail = state === 'collapsed' && !isMobile
  return (
    <SidebarMenu aria-label={label}>
      {items.map((item) => {
        const { to, label, icon: Icon, children, count, countLabel } = item
        const isActive = to === activeTo
        const childActive = childItems(item).some((child) => child.to === activeTo)
        return (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton
              isActive={isActive || (rail && childActive)}
              tooltip={navTooltip(item)}
              className={cn('relative', ACTIVE_MARK)}
              render={<Link to={to} aria-current={isActive ? 'page' : undefined} />}
            >
              <Icon />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <NavCount count={count} countLabel={countLabel} />
            </SidebarMenuButton>
            {children && children.length > 0 && (
              <SidebarMenuSub hidden={!childrenOpen(item, activeTo)}>
                {children.map((child) =>
                  isNavItemGroup(child) ? (
                    <NavSubGroup key={`group:${child.label}`} group={child} activeTo={activeTo} />
                  ) : (
                    <NavSubLink key={child.to} item={child} activeTo={activeTo} />
                  ),
                )}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

// A tile in the tiles look (#6C): the entry's icon over its label, a
// finger's target at least, its count in the corner. The current one,
// or the one holding the current page, has the tint and a --primary ring.
const NAV_TILE_CLASS =
  'relative flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-lg bg-sidebar-accent/50 px-1 py-2 ' +
  'text-center type-caption text-sidebar-foreground outline-hidden ring-sidebar-ring transition-colors ' +
  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 ' +
  'data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground ' +
  'data-active:shadow-[inset_0_0_0_1px_var(--primary)] [&>svg]:size-5 [&>svg]:shrink-0'

function NavTile({ item, activeTo }: { item: NavItem; activeTo: string | undefined }) {
  const { to, label, icon: Icon, count, countLabel } = item
  // "page" on the entry's own page, "true" on one of its pages.
  const current = to === activeTo ? 'page' : childItems(item).some((child) => child.to === activeTo) ? 'true' : undefined
  return (
    <li className="flex min-w-0">
      <Link
        to={to}
        aria-current={current}
        data-slot="nav-tile"
        data-active={current ? '' : undefined}
        className={NAV_TILE_CLASS}
      >
        <Icon aria-hidden="true" />
        <span className="max-w-full break-words">{label}</span>
        {navCountText(count) !== undefined ? (
          <>
            <span
              aria-hidden="true"
              data-slot="nav-count"
              className="absolute top-1 right-1.5 type-caption leading-none text-sidebar-foreground tabular-nums"
            >
              {navCountText(count)}
            </span>
            <span className="sr-only">{navCountSpoken(count, countLabel)}</span>
          </>
        ) : null}
      </Link>
    </li>
  )
}

// A group in the tiles look (#6C): its entries as a three-column grid,
// its label for screen readers only (the grid is a list named by it), and
// under the grid the pages of the entry you're in, as the list look's
// children, each heading a hairline (its list still named by it). On the
// icon rail it's the rail's icons, as every group.
function TilesNavGroup({ group, activeTo }: { group: NavGroup; activeTo: string | undefined }) {
  const { state, isMobile } = useSidebar()
  const headingId = useId()
  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarGroup>
        {group.label !== undefined && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <NavMenu items={group.items} activeTo={activeTo} />
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }
  const open = group.items.filter((item) => childrenOpen(item, activeTo))
  return (
    <SidebarGroup data-nav-look="tiles">
      {group.label !== undefined && (
        <span id={headingId} className="sr-only">
          {group.label}
        </span>
      )}
      <SidebarGroupContent className="flex flex-col gap-2">
        <ul
          data-slot="nav-tiles"
          aria-labelledby={group.label !== undefined ? headingId : undefined}
          className="grid grid-cols-3 gap-1.5"
        >
          {group.items.map((item) => (
            <NavTile key={item.to} item={item} activeTo={activeTo} />
          ))}
        </ul>
        {open.map((item) => (
          <div key={item.to} role="group" aria-label={`${item.label} pages`} data-slot="nav-tile-pages" className="flex flex-col gap-1">
            {childRuns(item).map((run, runIndex) => (
              <div key={run.label ?? `run:${runIndex}`} className="flex flex-col gap-1">
                <SidebarSeparator className="mx-0" />
                <NavMenu items={run.items} activeTo={activeTo} label={run.label} />
              </div>
            ))}
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// Whether a collapsible section is open, remembered per browser by its
// label. Storage can be missing or refuse (a private window): then it's
// remembered for the page's life only.
const SECTION_KEY = (label: string) => `ui-foundation:nav-section:${label}`

function storedSectionOpen(label: string): boolean | null {
  try {
    const stored = window.localStorage.getItem(SECTION_KEY(label))
    return stored === null ? null : stored === 'open'
  } catch {
    return null
  }
}

function storeSectionOpen(label: string, open: boolean) {
  try {
    window.localStorage.setItem(SECTION_KEY(label), open ? 'open' : 'closed')
  } catch {
    // Not remembered; the state still holds until the page reloads.
  }
}

// A section whose label folds it (#152). On the icon rail (the collapsed
// sidebar on a wide screen) its items always show and its label stays the
// rail's hidden one, so no page is out of reach and no hidden button
// takes a tab stop. The section holding the current page is always open:
// arriving in a closed one opens it and remembers that.
function CollapsibleNavGroup({ group, activeTo }: { group: NavGroup & { label: string }; activeTo: string | undefined }) {
  const { state, isMobile } = useSidebar()
  const contentId = useId()
  const [stored, setStored] = useState(() => storedSectionOpen(group.label))
  const holdsCurrent = withChildren(group.items).some((item) => item.to === activeTo)

  // Arriving in a folded section unfolds it, and it stays unfolded after.
  if (holdsCurrent && stored !== true) setStored(true)
  useEffect(() => {
    if (holdsCurrent) storeSectionOpen(group.label, true)
  }, [holdsCurrent, group.label])

  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <NavMenu items={group.items} activeTo={activeTo} />
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  const open = holdsCurrent || (stored ?? group.defaultOpen ?? true)
  return (
    <SidebarGroup data-collapsible-section={open ? 'open' : 'closed'}>
      <SidebarGroupLabel
        render={
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            // Can't fold the section you're in: the page would sit inside it.
            aria-disabled={holdsCurrent || undefined}
            onClick={() => {
              if (holdsCurrent) return
              setStored(!open)
              storeSectionOpen(group.label, !open)
            }}
          />
        }
        className="w-full justify-between text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-disabled:hover:bg-transparent aria-disabled:hover:text-sidebar-foreground/70"
      >
        {group.label}
        <ChevronRightIcon aria-hidden="true" className={cn('transition-transform', open && 'rotate-90')} />
      </SidebarGroupLabel>
      <SidebarGroupContent id={contentId} hidden={!open}>
        <NavMenu items={group.items} activeTo={activeTo} />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// The phone's back arrow (#N7), below the md breakpoint only: the
// shell's own way up from a page below a nav entry. Its label is the
// place it goes, so it reads "Back to Accounts".
function PhoneBack({ back }: { back: { label: string; to: string } }) {
  return (
    <Link
      to={back.to}
      data-slot="app-shell-back"
      aria-label={`Back to ${back.label}`}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        '-ml-2 max-w-[60vw] gap-0.5 px-1.5 text-link hover:text-link md:hidden',
      )}
    >
      <ChevronLeftIcon aria-hidden="true" />
      <span className="truncate">{back.label}</span>
    </Link>
  )
}

function AppShellSkeleton() {
  return (
    <div className="flex h-screen w-full gap-4 p-4" data-state="loading">
      <Skeleton className="h-full w-56 shrink-0" />
      <div className="flex-1 space-y-4 pt-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export function AppShell({
  title,
  logo: Logo,
  nav,
  sidebarExtra,
  defaultSidebarOpen = true,
  version,
  bottomBar,
  navLook = 'list',
  search,
}: AppShellProps) {
  const { user, status, error, retry, logout } = useAuth()
  const location = useLocation()
  const reporter = useErrorReporter()
  // Set before logout starts, so the redirect below knows this was a
  // deliberate logout. It can't be a follow-up navigate() after logout
  // resolves: that runs before React re-renders, and the <Navigate> this
  // component then renders starts a second navigation that wins.
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  useShellDocumentTitle(title, navPageLabel(nav, location.pathname))
  // The trail a page put up (usePageTrail, #N5), for the bar.
  const [pageTrail, setPageTrail] = useState<{ owner: object; crumbs: readonly PageCrumb[] } | null>(null)
  const set = useCallback((owner: object, crumbs: readonly PageCrumb[]) => setPageTrail({ owner, crumbs }), [])
  const clear = useCallback(
    (owner: object) => setPageTrail((current) => (current?.owner === owner ? null : current)),
    [],
  )
  const trailSlot = useMemo<PageTrailSlot>(() => ({ set, clear }), [set, clear])

  if (status === 'loading') {
    return <AppShellSkeleton />
  }

  // The session check itself failed (backend down, network) — not the same
  // as logged out, so don't send the user to a login form that can't work.
  if (status === 'unavailable' && error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <ErrorState error={error} onRetry={retry} />
      </div>
    )
  }

  // Also covers `status === 'unauthenticated'` (user is always null then) —
  // narrowing on `user` here, rather than `status`, is what lets TypeScript
  // treat `user` as non-null for the rest of this component. `from` lets
  // /login send the user back here afterwards; router state, not a query
  // param, so it can't be used as an open redirect from a crafted link.
  if (!user) {
    // A deliberate logout lands on a clean /login — otherwise whoever signs
    // in next would be sent back to the previous user's page.
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={isLoggingOut ? undefined : { from }} />
  }

  const activeTo = activeNavTo(nav, location.pathname)
  const ownTrail = pageTrail?.crumbs ?? null
  const back = trailBackTarget(nav, location.pathname, ownTrail)
  const trail = ownTrail ?? navTrail(nav, location.pathname)
  const groups = navGroups(nav)
  const renderGroup = (group: NavGroup, groupIndex: number) =>
    (group.look ?? navLook) === 'tiles' ? (
      <TilesNavGroup
        key={`${group.placement ?? 'top'}:${groupIndex}:${group.label ?? ''}`}
        group={group}
        activeTo={activeTo}
      />
    ) : group.collapsible && group.label !== undefined ? (
      <CollapsibleNavGroup
        key={`${group.placement ?? 'top'}:${groupIndex}:${group.label}`}
        group={{ ...group, label: group.label }}
        activeTo={activeTo}
      />
    ) : (
      <SidebarGroup key={`${group.placement ?? 'top'}:${groupIndex}:${group.label ?? ''}`}>
        {group.label !== undefined && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <NavMenu items={group.items} activeTo={activeTo} />
        </SidebarGroupContent>
      </SidebarGroup>
    )

  return (
    <TooltipProvider>
      {reporter && <ReportRoutePattern reporter={reporter} />}
      <SidebarProvider defaultOpen={storedSidebarOpen(defaultSidebarOpen)}>
        <CloseMobileSidebarOnNavigate />
        <nav aria-label="Primary">
          <Sidebar collapsible="icon">
            <SidebarHeader>
              {/* The title is hidden on the icon rail: unlike a menu
                  button's label, a bare span gets no collapse treatment
                  from the sidebar primitive, so it would wrap onto itself
                  at rail width. The logo stays, centred where the menu
                  buttons' icons are. */}
              <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                {Logo && (
                  <Logo
                    aria-hidden="true"
                    className="size-5 shrink-0 text-sidebar-foreground group-data-[collapsible=icon]:size-4"
                  />
                )}
                <span className="truncate text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                  {title}
                </span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              {groups.filter((group) => !group.placement).map(renderGroup)}
              {sidebarExtra}
              {/* Sections placed at the bottom (#N4): at the sidebar's foot,
                  under everything else, pushed down by the space above. */}
              {groups.some((group) => group.placement) && (
                <div data-slot="nav-foot" className="mt-auto flex flex-col">
                  {groups.filter((group) => group.placement).map(renderGroup)}
                </div>
              )}
            </SidebarContent>
            <SidebarFooter>
              {version && <VersionEntry version={version} />}
              {/* On the icon rail the name is hidden and the button centred —
                  otherwise the name's truncated sliver pushes the button off
                  the rail. */}
              <div className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <span className="truncate type-caption text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                  {user.name}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="Log Out"
                  onClick={() => {
                    setIsLoggingOut(true)
                    // The records opened lately are this person's: the
                    // next to sign in on this device doesn't see them.
                    clearRecentRecords()
                    // A failed request still ends the session on screen
                    // (AuthProvider), so this stays a deliberate logout: a
                    // clean /login, never the previous user's page as `from`.
                    logout().catch(() => {})
                  }}
                >
                  <LogOutIcon />
                </Button>
              </div>
            </SidebarFooter>
          </Sidebar>
        </nav>
        {/* The column beside the sidebar: the bar, then the page in
            <main>. The bar is outside <main>: it holds the trail,
            whose crumbs name the same places as a page's own links, and a
            test (or a screen reader's landmark list) that looks in the
            page for "Projects" should find the page's, not the bar's.
            min-w-0: it is a flex item beside <Sidebar> with the default
            min-width:auto, which floors it at its content's width — so a
            wide table grew the whole page sideways instead of scrolling
            inside its own container, and a right-pinned column sat
            off-screen. */}
        <PageTrailContext.Provider value={trailSlot}>
        <div data-slot="app-shell-column" className="flex w-full min-w-0 flex-1 flex-col bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            {/* On a phone, a page below a nav entry gets a way back up to
                it (#N7): "‹ Accounts" on a record. With a bottom bar to get
                around by, it takes the menu button's place; without one
                the menu button stays beside it. Entries' own pages, and
                every width from md up, keep the menu button. */}
            {back && <PhoneBack back={back} />}
            <SidebarTrigger className={cn(back && bottomBar?.length && 'max-md:hidden')} />
            {/* The trail (#N5), from md up: the page's own (usePageTrail,
                EntityView's back.trail), or its nav entry's. A phone has
                the back arrow instead. */}
            <div data-slot="app-shell-trail" className="min-w-0 flex-1">
              {trail.length > 0 && <PageTrail crumbs={trail} aria-label="You are here" className="max-md:hidden" />}
            </div>
            {search && <SearchPalette search={search} nav={nav} />}
            <LookControl />
          </header>
          {/* "You're offline", over every page while the server can't be reached (4.90). */}
          <OfflineNotice />
          <SidebarInset className="min-w-0">
            <div className={cn('flex-1 p-6', bottomBar?.length && BOTTOM_BAR_PADDING)}>
              <Outlet />
            </div>
          </SidebarInset>
        </div>
        </PageTrailContext.Provider>
        {bottomBar && bottomBar.length > 0 && <BottomBar items={bottomBar} nav={nav} activeTo={activeTo} navLook={navLook} />}
      </SidebarProvider>
      {/* Top centre, and at the bottom on a phone above its bars (4.90,
          ui/sonner.tsx): not sonner's bottom-right default, which sat on
          DataTable's pagination buttons; top-right would collide with
          the theme toggle. */}
      <Toaster />
    </TooltipProvider>
  )
}
