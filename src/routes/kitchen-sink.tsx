import { InfoIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function Section({
  name,
  title,
  children,
}: {
  name: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section data-kitchen={name} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

export function KitchenSinkRoute() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-lg font-semibold text-foreground">Kitchen Sink</h1>

      <Section name="button" title="Button">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section name="card" title="Card">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Card description text.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Card body content.</p>
          </CardContent>
        </Card>
      </Section>

      <Section name="input" title="Input">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kitchen-input-default" className="text-xs text-muted-foreground">
            Default
          </label>
          <Input id="kitchen-input-default" placeholder="Type here" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kitchen-input-disabled" className="text-xs text-muted-foreground">
            Disabled
          </label>
          <Input id="kitchen-input-disabled" placeholder="Disabled" disabled />
        </div>
      </Section>

      <Section name="sidebar" title="Sidebar">
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
      </Section>

      <Section name="sheet" title="Sheet">
        <Sheet>
          <SheetTrigger render={<Button variant="outline">Open sheet</Button>} />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet title</SheetTitle>
              <SheetDescription>Sheet description text.</SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <Button>Save</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Section>

      <Section name="tooltip" title="Tooltip">
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline" size="icon-sm" aria-label="Info" />}>
            <InfoIcon />
          </TooltipTrigger>
          <TooltipContent>Helpful info</TooltipContent>
        </Tooltip>
      </Section>

      <Section name="separator" title="Separator">
        <div className="flex w-full flex-col gap-3">
          <Separator />
          <div className="flex h-6 items-center gap-3">
            <span className="text-sm text-muted-foreground">Left</span>
            <Separator orientation="vertical" />
            <span className="text-sm text-muted-foreground">Right</span>
          </div>
        </div>
      </Section>

      <Section name="skeleton" title="Skeleton">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </Section>

      <Section name="spinner" title="Spinner">
        <Spinner />
      </Section>

      <Section name="empty" title="Empty">
        <Empty className="w-full border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InfoIcon />
            </EmptyMedia>
            <EmptyTitle>No items yet</EmptyTitle>
            <EmptyDescription>Create one to get started.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm">Create item</Button>
          </EmptyContent>
        </Empty>
      </Section>

      <Section name="toast" title="Toast">
        <Button variant="outline" onClick={() => toast.success('Saved successfully')}>
          Show toast
        </Button>
      </Section>
    </div>
  )
}
