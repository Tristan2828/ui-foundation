import { HomeIcon, LogOutIcon, MoonIcon, PackageIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/use-auth'
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
  const { user, status, logout } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <AppShellSkeleton />
  }

  // Also covers `status === 'unauthenticated'` (user is always null then) —
  // narrowing on `user` here, rather than `status`, is what lets TypeScript
  // treat `user` as non-null for the rest of this component.
  if (!user) {
    return <Navigate to="/login" replace />
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
                <Button variant="ghost" size="icon-sm" aria-label="Log out" onClick={() => logout()}>
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
