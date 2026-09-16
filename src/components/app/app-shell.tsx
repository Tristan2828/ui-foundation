import { HomeIcon, LayoutGridIcon, MoonIcon, PackageIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { Button } from '@/components/ui/button'
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
  { to: '/kitchen-sink', label: 'Kitchen Sink', icon: LayoutGridIcon, end: false },
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

export function AppShell() {
  const { user } = useAuth()
  const location = useLocation()

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
              <span className="truncate px-2 text-xs text-sidebar-foreground/70">{user.name}</span>
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
