import { defineMockModeBannerSuite } from '@tristan2828/ui-foundation/testing'

// A screen inside the shell, and the logged-out screen where a mock session
// passing for a real one first cost someone time.
defineMockModeBannerSuite({ routes: ['/widgets', '/login'] })
