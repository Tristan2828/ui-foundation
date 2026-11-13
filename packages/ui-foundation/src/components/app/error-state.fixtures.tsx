import type { Meta, StoryObj } from '@/fixtures/types'
import { ListChecksIcon } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import type { AppError } from '@/api/contracts'
import { ErrorState } from './error-state'
import { ModuleCard } from './module-card'
import { WidgetCard } from './widget-card'

// A lapsed sign-in at a proxy in front of the app (kind `proxy_auth`):
// "Sign In Again" in place of a retry, full size (a table's, a record's,
// the shell's) and compact (a widget's), and on a module card. Axe, the
// token check and the glyph check measure it in both themes
// (e2e/fixtures-visual.spec.ts); e2e/error-state.spec.ts presses it.
const meta: Meta = {
  title: 'app/ErrorState',
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export default meta

const LAPSED: AppError = {
  kind: 'proxy_auth',
  message: 'Your sign-in has expired. Reload the page to sign in again.',
}

export const SignInAgain: StoryObj = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6 p-6">
      <ErrorState error={LAPSED} onRetry={() => {}} />
      <WidgetCard title="Ready to Start" icon={ListChecksIcon} error={LAPSED} onRetry={() => {}} isLoading={false} isEmpty={false} emptyMessage="Nothing ready">
        {null}
      </WidgetCard>
      <ModuleCard title="Projects" icon={ListChecksIcon} category={1} to="/projects" error={LAPSED} onRetry={() => {}} />
    </div>
  ),
}
