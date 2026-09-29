import type { Meta, StoryObj } from '@storybook/react-vite'
import { HomeIcon, LinkIcon, PackageIcon } from 'lucide-react'
import { useState } from 'react'
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
import { TooltipProvider } from '@/components/ui/tooltip'

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

// The collapsed icon rail with a second group below the first — what every
// AppShell with a `sidebarExtra` group looks like collapsed. The hidden
// group label is pulled up (-mt-8) over the last entry of the group above,
// so it must not take pointer events; e2e/storybook-visual.spec.ts clicks
// "Item two" here and fails if the label intercepts it.
function CollapsedWithTwoGroupsDemo() {
  const [clicked, setClicked] = useState('none')
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <nav aria-label="Sidebar demo">
          <Sidebar collapsible="icon">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {[
                      { label: 'Item one', icon: HomeIcon },
                      { label: 'Item two', icon: PackageIcon },
                    ].map(({ label, icon: Icon }) => (
                      <SidebarMenuItem key={label}>
                        <SidebarMenuButton tooltip={label} onClick={() => setClicked(label)}>
                          <Icon />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel>Resources</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton tooltip="Extra" onClick={() => setClicked('Extra')}>
                        <LinkIcon />
                        <span>Extra</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </nav>
        <p className="p-4 text-sm text-foreground">Clicked: {clicked}</p>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export const CollapsedWithTwoGroups: Story = {
  argTypes: { side: { table: { disable: true } }, variant: { table: { disable: true } } },
  render: () => <CollapsedWithTwoGroupsDemo />,
}
