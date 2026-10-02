import { LogOutIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { ErrorState } from '@/components/app/error-state'
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

export type NavItem = {
  /** The route this entry links to. */
  to: string
  label: string
  icon: ComponentType
  /** Active only on an exact match (use for '/'); otherwise on any sub-path too. */
  end?: boolean
}

export type AppShellProps = {
  /** Shown at the top of the sidebar (hidden on the collapsed icon rail). */
  title: string
  /** The app's primary navigation, in order. */
  nav: readonly NavItem[]
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

export function AppShell({ title, nav, sidebarExtra, defaultSidebarOpen = true }: AppShellProps) {
  const { user, status, error, retry, logout } = useAuth()
  const location = useLocation()
  // Set before logout starts, so the redirect below knows this was a
  // deliberate logout. It can't be a follow-up navigate() after logout
  // resolves: that runs before React re-renders, and the <Navigate> this
  // component then renders starts a second navigation that wins.
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={storedSidebarOpen(defaultSidebarOpen)}>
        <CloseMobileSidebarOnNavigate />
        <nav aria-label="Primary">
          <Sidebar collapsible="icon">
            <SidebarHeader>
              {/* Hidden on the icon rail: unlike a menu button's label, a
                  bare span gets no collapse treatment from the sidebar
                  primitive, so it would wrap onto itself at rail width. */}
              <span className="px-2 text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                {title}
              </span>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {nav.map(({ to, label, icon: Icon, end }) => {
                      const isActive = end
                        ? location.pathname === to
                        : location.pathname.startsWith(to)
                      return (
                        <SidebarMenuItem key={to}>
                          <SidebarMenuButton
                            isActive={isActive}
                            tooltip={label}
                            render={<NavLink to={to} end={end} />}
                          >
                            <Icon />
                            <span>{label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              {sidebarExtra}
            </SidebarContent>
            <SidebarFooter>
              {/* On the icon rail the name is hidden and the button centred —
                  otherwise the name's truncated sliver pushes the button off
                  the rail. */}
              <div className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <span className="truncate text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                  {user.name}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="Log out"
                  onClick={() => {
                    setIsLoggingOut(true)
                    logout().catch(() => setIsLoggingOut(false))
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
