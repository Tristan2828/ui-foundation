import type { Meta, StoryObj } from '@storybook/react-vite'
import { DataEnvironmentNotice } from './data-environment-banner'
import { MockModeBanner } from './mock-mode-banner'

// The banners an app shows above its router, together: each is a safety
// cue, so each answers for its contrast in both themes, and they sit
// stacked here to show they never read as the same thing (the mock
// banner's warning fill, the data banner's info fill). A real backend on
// dev data shows only the second; a production one shows neither.
const meta: Meta = {
  title: 'app/Banners',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div>
      <MockModeBanner active />
      <DataEnvironmentNotice label="dev" />
      <main className="p-4 type-body">The app’s screen.</main>
    </div>
  ),
}
