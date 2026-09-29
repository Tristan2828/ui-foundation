import { test } from '@playwright/test'
import { defineMockModeBannerSuite } from '@tristan2828/ui-foundation/testing'

// A screen inside the shell, and the logged-out screen where a mock session
// passing for a real one first cost someone time. Under VITE_API=real
// (scripts/check-backend-postgres.sh) the suite asserts the banner is absent.
//
// The describe is this file's own so `playwright test <this file>` selects
// the suite: Playwright locates a test where test()/describe() is called,
// and the suite's calls are in the package.
test.describe('mock-mode banner', () => {
  defineMockModeBannerSuite({ routes: ['/widgets', '/login'] })
})
