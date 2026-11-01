import type { Meta, StoryObj } from '@/fixtures/types'
import { CircleAlertIcon, InfoIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// shadcn's Alert as the package ships it. Apps usually want <Notice>
// (app/Notice), which is built on it with the semantic tones.
const meta: Meta = {
  title: 'ui/Alert',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <Alert role={undefined}>
        <InfoIcon />
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>The import runs every night at two.</AlertDescription>
      </Alert>
      <Alert role={undefined} variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>The import failed</AlertTitle>
        <AlertDescription>The catalogue didn't answer. It will try again tonight.</AlertDescription>
      </Alert>
    </div>
  ),
}
