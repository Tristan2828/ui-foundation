import type { Page } from '@playwright/test'
import { expect, test } from '@tristan2828/ui-foundation/testing'

// The app renders where the browser blocks storage: a private window with
// site data blocked, or a policy that makes every Storage call throw. MSW's
// cookie store reads localStorage unguarded when its module loads, so
// without the guard in src/main.tsx the mocks' import throws and nothing
// renders in mock mode.
test.beforeEach(async ({ page }) => {
  if (process.env.VITE_API === 'real') {
    await page.request.post('/api/auth/login', {
      data: { email: 'dev@example.com', password: 'dev-password-123' },
    })
  }
})

async function expectHomeRenders(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
}

test('renders when the Storage methods throw', async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
      Object.defineProperty(Storage.prototype, method, { value: blocked, configurable: true })
    }
  })
  await expectHomeRenders(page)
})

test('renders when window.localStorage itself throws', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
  })
  await expectHomeRenders(page)
})
