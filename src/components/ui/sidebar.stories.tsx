import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'

const meta: Meta<typeof Sidebar> = {
  title: 'ui/Sidebar',
}

export default meta
type Story = StoryObj<typeof Sidebar>

export const AllVariants: Story = {
  render: () => (
    <div className="h-64 w-56 overflow-hidden rounded-lg border border-border">
      <SidebarProvider>
        <nav aria-label="Sidebar demo">
          <Sidebar collapsible="none">
            <SidebarHeader>
              <span className="px-2 text-sm font-semibold text-sidebar-foreground">Demo</span>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Section</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton isActive>Item one</SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>Item two</SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </nav>
      </SidebarProvider>
    </div>
  ),
}
