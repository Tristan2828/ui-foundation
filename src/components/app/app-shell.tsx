import { HomeIcon, LogOutIcon, MoonIcon, PackageIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
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
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/widgets', label: 'Widgets', icon: PackageIcon, end: false },
] as const

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

export function AppShell() {
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
      <SidebarProvider>
        <nav aria-label="Primary">
          <Sidebar collapsible="icon">
            <SidebarHeader>
              <span className="px-2 text-sm font-semibold text-sidebar-foreground">
                UI Foundation
              </span>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
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
            </SidebarContent>
            <SidebarFooter>
              <div className="flex items-center justify-between gap-2 px-2">
                <span className="truncate text-xs text-sidebar-foreground/70">{user.name}</span>
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
        <SidebarInset>
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
      <Toaster />
    </TooltipProvider>
  )
}
