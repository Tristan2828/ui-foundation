import type { Meta, StoryObj } from '@/fixtures/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Tabs in both looks. The line look is a page's sub-navigation: a row of
// tabs under a small section heading, the open one's name and line in the
// theme colour (4.110), the way EntityView's record tabs draw theirs. The
// default look is the segmented pill. Each shows an open tab and closed
// ones at once, so axe and the token check see both states.
const meta: Meta = {
  title: 'ui/Tabs',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2" data-testid="page-tabs">
        <h2 className="type-label text-muted-foreground">Workshop</h2>
        <Tabs defaultValue="overview">
          <TabsList variant="line">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="parts" disabled>
              Parts
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today">What's on today.</TabsContent>
          <TabsContent value="overview">The workshop at a glance.</TabsContent>
          <TabsContent value="projects">Every project.</TabsContent>
          <TabsContent value="tools">Every tool.</TabsContent>
        </Tabs>
      </section>
      <section className="flex flex-col gap-2" data-testid="pill-tabs">
        <h2 className="type-label text-muted-foreground">Range</h2>
        <Tabs defaultValue="week">
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
          <TabsContent value="day">One day.</TabsContent>
          <TabsContent value="week">One week.</TabsContent>
          <TabsContent value="month">One month.</TabsContent>
        </Tabs>
      </section>
    </div>
  ),
}
