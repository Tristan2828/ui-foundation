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

// collapsible stays "none" — the collapsed/offcanvas states need real
// viewport interaction, not something a static screenshot can show
// meaningfully. side/variant are the Controls that do.
const meta: Meta<typeof Sidebar> = {
  title: 'ui/Sidebar',
  argTypes: {
    side: {
      control: 'select',
      options: ['left', 'right'],
    },
    variant: {
      control: 'select',
      options: ['sidebar', 'floating', 'inset'],
    },
  },
  args: {
    side: 'left',
    variant: 'sidebar',
  },
  render: (args) => (
    <div className="h-64 w-56 overflow-hidden rounded-lg border border-border">
      <SidebarProvider>
        <nav aria-label="Sidebar demo">
          <Sidebar collapsible="none" side={args.side} variant={args.variant}>
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

export default meta
type Story = StoryObj<typeof Sidebar>

export const Default: Story = {}
