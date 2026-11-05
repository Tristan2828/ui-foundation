import type { Meta, StoryObj } from '@/fixtures/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PushPermission, PushStatus } from '@/hooks/use-push-permission'
import { AllowReminders } from './allow-reminders'

// Every state AllowReminders can be in, on a card as a settings page would
// put it, so axe, the token check and the glyph check measure each one in
// both themes (e2e/fixtures-visual.spec.ts). A real page passes
// usePushPermission(); these pass its result as it would be.
const STATES: { label: string; status: PushStatus | undefined; pending?: boolean; error?: string }[] = [
  { label: 'Off: explains, then asks', status: 'off' },
  { label: 'Turning on', status: 'off', pending: true },
  { label: 'On', status: 'on' },
  { label: 'Failed', status: 'off', error: "Couldn't reach the app. Check the connection and try again." },
  { label: 'iPhone in a browser tab', status: 'needs-install' },
  { label: 'Refused', status: 'blocked' },
  { label: 'No push in this browser', status: 'unsupported' },
  { label: 'Mock data', status: 'mock' },
  { label: 'Working it out', status: undefined },
]

const push = (state: (typeof STATES)[number]): PushPermission => ({
  status: state.status,
  pending: state.pending ?? false,
  error: state.error ?? null,
  enable: () => {},
  disable: () => {},
})

const meta: Meta = {
  title: 'app/AllowReminders',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="grid max-w-3xl gap-4">
      {STATES.map((state) => (
        <Card key={state.label}>
          <CardHeader>
            <CardTitle>{state.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <AllowReminders push={push(state)} />
          </CardContent>
        </Card>
      ))}
    </div>
  ),
}
