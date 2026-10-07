import { test } from '@playwright/test'
import { defineDataEnvironmentBannerSuite } from '@tristan2828/ui-foundation/testing'

// The same screens as the mock-mode banner: one inside the shell, and the
// logged-out one. In mock mode the banner is absent unless the suite
// forces a label through MSW; under VITE_API=real
// (scripts/check-backend-postgres.sh) it follows the backend's DATA_LABEL.
// The describe is this file's own (see mock-mode-banner.spec.ts).
test.describe('data-environment banner', () => {
  defineDataEnvironmentBannerSuite({ routes: ['/widgets', '/login'] })
})
