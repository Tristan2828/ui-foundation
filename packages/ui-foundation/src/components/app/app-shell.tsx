import { ChevronRightIcon, LogOutIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { activeNavTo, navGroups, navPageLabel, type NavEntry, type NavGroup, type NavItem } from '@/components/app/app-shell-nav'
import { versionHref, versionLabel, type AppShellVersion } from '@/components/app/app-shell-version'
import { ErrorState } from '@/components/app/error-state'
import type { IconComponent } from '@/components/app/icon-component'
import { useErrorReporter } from '@/error-reporting/error-reporting-context'
import { ReportRoutePattern } from '@/error-reporting/error-reporting-provider'
import { useShellDocumentTitle } from '@/hooks/use-document-title'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
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
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export type { NavEntry, NavItem, NavSection } from '@/components/app/app-shell-nav'
export type { AppShellVersion } from '@/components/app/app-shell-version'

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
   * section's items.
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

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle dark mode"
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

// One group's entries. A plain Link, not NavLink: NavLink marks every
// matching entry current, and only the most specific one should be
// (activeNavTo).
function NavMenu({ items, activeTo }: { items: readonly NavItem[]; activeTo: string | undefined }) {
  return (
    <SidebarMenu>
      {items.map(({ to, label, icon: Icon }) => {
        const isActive = to === activeTo
        return (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton
              isActive={isActive}
              tooltip={label}
              render={<Link to={to} aria-current={isActive ? 'page' : undefined} />}
            >
              <Icon />
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
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
  const holdsCurrent = group.items.some((item) => item.to === activeTo)

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

export function AppShell({ title, logo: Logo, nav, sidebarExtra, defaultSidebarOpen = true, version }: AppShellProps) {
  const { user, status, error, retry, logout } = useAuth()
  const location = useLocation()
  const reporter = useErrorReporter()
  // Set before logout starts, so the redirect below knows this was a
  // deliberate logout. It can't be a follow-up navigate() after logout
  // resolves: that runs before React re-renders, and the <Navigate> this
  // component then renders starts a second navigation that wins.
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  useShellDocumentTitle(title, navPageLabel(nav, location.pathname))

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
              {navGroups(nav).map((group, groupIndex) =>
                group.collapsible && group.label !== undefined ? (
                  <CollapsibleNavGroup
                    key={`${groupIndex}:${group.label}`}
                    group={{ ...group, label: group.label }}
                    activeTo={activeTo}
                  />
                ) : (
                  <SidebarGroup key={`${groupIndex}:${group.label ?? ''}`}>
                    {group.label !== undefined && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                    <SidebarGroupContent>
                      <NavMenu items={group.items} activeTo={activeTo} />
                    </SidebarGroupContent>
                  </SidebarGroup>
                ),
              )}
              {sidebarExtra}
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
                <Button variant="ghost" size="icon-sm" aria-label="Log out"
                  onClick={() => {
                    setIsLoggingOut(true)
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
        {/* min-w-0: <SidebarInset> is a flex item beside <Sidebar> with
            the default min-width:auto, which floors it at its content's
            width — so a wide table grew the whole page sideways instead of
            scrolling inside its own container, and a right-pinned column
            sat off-screen. Passed via className: sidebar.tsx is shadcn's. */}
        <SidebarInset className="min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <ThemeToggle />
          </header>
          <div className="flex-1 p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      {/* top-center, not sonner's bottom-right default: that sat on
          DataTable's pagination buttons, which are bottom-right too.
          top-right would collide with the theme toggle instead. */}
      <Toaster position="top-center" />
    </TooltipProvider>
  )
}
