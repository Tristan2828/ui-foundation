// `@tristan2828/ui-foundation/testing` — Playwright helpers and suites for
// what every app built on the foundation must keep true. An app's spec file
// calls a suite with its own routes, instead of carrying a copy of the spec
// to edit (each of these was forked by the first real app for exactly that).
//
// Call a suite inside the spec file's own `test.describe(...)`. Playwright
// locates a test where test() is called, which for a suite is this package;
// a file argument (`playwright test e2e/a11y.spec.ts`) keeps a test only if
// it or an enclosing describe is located in that file. Without the app's
// own describe, selecting the spec by file runs nothing.
//
// Runs in Node, inside Playwright: @playwright/test and @axe-core/playwright
// are optional peer dependencies, needed only by apps that import this.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { MswOverride } from '../mocks/override'

export type { MswHandle, MswOverride } from '../mocks/override'

// This module runs in Node (Playwright), but the package builds without
// Node's types; this is the one global it reads.
declare const process: { env: Record<string, string | undefined> }

/**
 * Forces a response for the page's *first* load: set before navigation, so
 * it wins the race against the app's own first fetch. For states forced
 * after load, use `waitForMswReady` and then `window.__msw.worker.use(...)`.
 */
export async function forceMswOverride(page: Page, override: MswOverride): Promise<void> {
  await page.addInitScript((spec) => {
    window.__E2E_MSW_OVERRIDE__ = spec
  }, override)
}

/** `window.__msw` is set only once the app's mocking has started — page.goto's load event doesn't wait for it. */
export async function waitForMswReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__msw !== undefined)
}

/** Starts the page logged out: GET /auth/me answers 401 on first load. */
export function forceLoggedOut(page: Page): Promise<void> {
  return forceMswOverride(page, {
    method: 'get',
    path: '*/api/auth/me',
    status: 401,
    body: { detail: 'Not authenticated' },
  })
}

/**
 * Leaves an open popup's own scaffolding out of an axe run: Base UI's
 * focus guards, invisible `aria-hidden` sentinels that hand focus back
 * when you tab past a non-modal list. Hidden yet focusable is their job;
 * they're never read out.
 */
export const POPUP_FOCUS_GUARDS = '[data-base-ui-focus-guard]'

/**
 * axe on the page as it is now. The options are for a state whose
 * structure a rule doesn't fit, said where they're used: a list open in a
 * portal sits outside the page's landmarks by design (`disableRules:
 * ['region']`) and brings focus guards (`exclude: [POPUP_FOCUS_GUARDS]`),
 * while every other rule, contrast included, still checks the list.
 */
export async function expectNoAxeViolations(
  page: Page,
  options: { disableRules?: string[]; exclude?: string[] } = {},
): Promise<void> {
  const builder = new AxeBuilder({ page })
  if (options.disableRules?.length) builder.disableRules(options.disableRules)
  for (const selector of options.exclude ?? []) builder.exclude(selector)
  const results = await builder.analyze()
  expect(results.violations).toEqual([])
}

// The app's own pages, read from the Primary nav. Below the sidebar's
// mobile breakpoint the nav renders into an off-canvas Sheet *portaled to
// document.body*, outside the <nav aria-label="Primary"> landmark, so the
// links are read from the sheet there. Keyed off the `isMobile` fixture,
// deliberately not a link count: count() doesn't retry, so on a slow first
// paint it read 0 on desktop too, clicked the trigger (which collapses the
// desktop sidebar) and then waited for a sheet that never came.
async function navRoutes(page: Page, isMobile: boolean | undefined): Promise<string[]> {
  await page.goto('/')
  const nav = isMobile
    ? (await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click(), page.getByRole('dialog'))
    : page.getByRole('navigation', { name: 'Primary' })

  await expect(nav.getByRole('link').first()).toBeVisible()
  const hrefs = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))
  // Only this app's pages: a sidebarExtra group may link to other sites.
  const origin = new URL(page.url()).origin
  return [...new Set(hrefs.filter((href) => new URL(href).origin === origin).map((href) => new URL(href).pathname))]
}

export type A11ySuiteOptions = {
  /**
   * Form screens, which aren't in the sidebar: each entity's create route,
   * plus an edit route when the form shows something only existing data has.
   */
  formRoutes: readonly string[]
  /**
   * Record views (`/<entity>/:id`, built on EntityView), which aren't in
   * the sidebar either: each entity's view of a full record, plus its
   * sparse one, so both filled values and "not set" labels are checked.
   */
  viewRoutes?: readonly string[]
  /** Screens outside the app shell, e.g. '/login' (and '/register' if the app has it). */
  loggedOutRoutes: readonly string[]
}

/**
 * Accessibility of the real screens in light and dark mode: every page in
 * the Primary nav (discovered, so a new entity's table is covered with no
 * edit), the given form routes, and the logged-out screens. axe's
 * color-contrast rule against the rendered dark DOM is also what keeps the
 * dark-mode tokens readable. The theme follows the OS setting, so
 * emulateMedia switches it.
 */
export function defineA11ySuite({ formRoutes, viewRoutes = [], loggedOutRoutes }: A11ySuiteOptions): void {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`accessibility (${colorScheme})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ colorScheme })
      })

      test('every nav page has zero axe violations', async ({ page, isMobile }) => {
        for (const route of await navRoutes(page, isMobile)) {
          await page.goto(route)
          await expect(page.locator('html')).toHaveClass(colorScheme)
          // Wait for data, not the loading skeleton, so the real UI is checked.
          await expect(page.locator('[data-state="loading"]')).toHaveCount(0)
          await test.step(route, () => expectNoAxeViolations(page))
        }
      })

      for (const route of [...formRoutes, ...loggedOutRoutes]) {
        test(`${route} has zero axe violations`, async ({ page }) => {
          await page.goto(route)
          await expect(page.locator('form')).toBeVisible()
          await expectNoAxeViolations(page)
        })
      }

      for (const route of viewRoutes) {
        test(`${route} has zero axe violations`, async ({ page }) => {
          await page.goto(route)
          // EntityView's loaded state, not its skeleton or an error.
          await expect(page.locator('[data-state="success"]')).toBeVisible()
          await expectNoAxeViolations(page)
        })
      }
    })
  }
}

export type MockModeBannerSuiteOptions = {
  /** Screens to check, logged-out ones included (e.g. '/login'). */
  routes: readonly string[]
  /**
   * Whether this run's app is MSW-backed. Defaults to
   * `process.env.VITE_API !== 'real'`, the same switch the app is built with.
   * When false (a run against the real backend) the banner must be absent.
   */
  mockMode?: boolean
}

/**
 * Mock mode is announced on every route, logged-out ones included — /login
 * is where a mock session passing for a real one first cost someone time.
 * The default Playwright run is MSW-backed, so the banner must be there.
 *
 * Against the real backend (`VITE_API=real`) it asserts the opposite: no
 * banner on any route. That half catches a mock bundle shipped as if it
 * were production, which is what the banner exists for.
 */
export function defineMockModeBannerSuite({
  routes,
  mockMode = process.env.VITE_API !== 'real',
}: MockModeBannerSuiteOptions): void {
  if (mockMode) {
    test('mock mode is announced on every route, including logged-out ones', async ({ page }) => {
      const banner = page.getByRole('status').filter({ hasText: 'Mock data' })
      for (const route of routes) {
        await page.goto(route)
        await test.step(route, () => expect(banner).toBeVisible())
      }
    })
    return
  }

  test('no mock-mode banner on any route against the real backend', async ({ page }) => {
    const banner = page.getByRole('status').filter({ hasText: 'Mock data' })
    for (const route of routes) {
      await page.goto(route)
      await test.step(route, async () => {
        // The banner renders beside the router, so once a screen's <main>
        // is on the page the banner would be too. Without this wait a
        // blank page would pass the count check trivially.
        await expect(page.getByRole('main')).toBeVisible()
        await expect(banner).toHaveCount(0)
      })
    }
  })
}

export type DataEnvironmentBannerSuiteOptions = {
  /** Screens to check, logged-out ones included (e.g. '/login'). */
  routes: readonly string[]
  /** Whether this run's app is MSW-backed. Defaults to `process.env.VITE_API !== 'real'`, as for the mock-mode banner. */
  mockMode?: boolean
  /**
   * Against the real backend only: the DATA_LABEL it was started with.
   * Defaults to `process.env.DATA_LABEL`, null when that's unset or empty
   * (production data, so no banner).
   */
  dataLabel?: string | null
}

// The banner names the label as data: "dev" → "Dev data".
const dataName = (label: string) => `${label.charAt(0).toUpperCase()}${label.slice(1)} data`

/**
 * Opens a route and waits for the app's own GET /environment to answer,
 * so "no banner" is checked after the backend has spoken, not before.
 */
async function gotoWithDataLabel(page: Page, route: string): Promise<void> {
  const answered = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/environment')
  await page.goto(route)
  await answered
  // The banner renders beside the router: once a screen's <main> is on
  // the page, the banner would be too.
  await expect(page.getByRole('main')).toBeVisible()
}

/**
 * DataEnvironmentBanner: shown on every route, logged-out ones included,
 * whenever the backend says its data isn't production's, and nowhere when
 * it says it is.
 *
 * Mock mode: the mock handler answers null, so no banner (MockModeBanner
 * covers mock data). A label forced through MSW shows on every route, in
 * a tone apart from the mock banner, and passes axe in light and dark.
 *
 * Real backend (`VITE_API=real`): the banner names `dataLabel` on every
 * route, or is absent when it's null, which is how a production deploy
 * runs.
 */
export function defineDataEnvironmentBannerSuite({
  routes,
  mockMode = process.env.VITE_API !== 'real',
  dataLabel = process.env.DATA_LABEL?.trim() || null,
}: DataEnvironmentBannerSuiteOptions): void {
  const banner = (page: Page) => page.getByRole('status').filter({ hasText: "changes here don't reach production" })

  const expectAbsentEverywhere = async (page: Page) => {
    for (const route of routes) {
      await gotoWithDataLabel(page, route)
      await test.step(route, () => expect(banner(page)).toHaveCount(0))
    }
  }

  const expectNamedEverywhere = async (page: Page, label: string) => {
    for (const route of routes) {
      await gotoWithDataLabel(page, route)
      await test.step(route, () => expect(banner(page)).toContainText(`${dataName(label)}:`))
    }
  }

  if (!mockMode) {
    if (dataLabel === null) {
      test('no data-environment banner on production data', async ({ page }) => {
        await expectAbsentEverywhere(page)
      })
    } else {
      test(`"${dataName(dataLabel)}" is announced on every route, including logged-out ones`, async ({ page }) => {
        await expectNamedEverywhere(page, dataLabel)
      })
    }
    return
  }

  const forceLabel = (page: Page) =>
    forceMswOverride(page, { method: 'get', path: '*/api/environment', body: { dataLabel: 'dev' } })

  test('no data-environment banner in mock mode, where the mock banner says it', async ({ page }) => {
    await expectAbsentEverywhere(page)
  })

  test('a data label from the backend is announced on every route, including logged-out ones', async ({ page }) => {
    await forceLabel(page)
    await expectNamedEverywhere(page, 'dev')
    // Both banners at once, and never the same one.
    await expect(page.getByRole('status').filter({ hasText: 'Mock data' })).toBeVisible()
    const fill = (locator: ReturnType<typeof banner>) => locator.evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(await fill(banner(page))).not.toBe(await fill(page.getByRole('status').filter({ hasText: 'Mock data' })))
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the data-environment banner has zero axe violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await forceLabel(page)
      for (const route of routes) {
        await gotoWithDataLabel(page, route)
        await expect(page.locator('html')).toHaveClass(colorScheme)
        await expect(banner(page)).toBeVisible()
        await expect(page.locator('[data-state="loading"]')).toHaveCount(0)
        await test.step(route, () => expectNoAxeViolations(page))
      }
    })
  }
}
