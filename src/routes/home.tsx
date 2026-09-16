import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HomeRoute() {
  return (
    <Card className="max-w-lg">
      <h1 className="sr-only">Home</h1>
      <CardHeader>
        <CardTitle>UI Foundation</CardTitle>
        <CardDescription>
          A reusable UI foundation for personal projects that display and edit database-backed
          data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button>Get started</Button>
      </CardContent>
    </Card>
  )
}
