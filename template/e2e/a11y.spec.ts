import { expect, test, type Page } from '@playwright/test'
import {
  POPUP_FOCUS_GUARDS,
  defineA11ySuite,
  expectNoAxeViolations,
  waitForMswReady,
} from '@tristan2828/ui-foundation/testing'

// Every page in the sidebar is found and checked automatically, in light
// and dark mode. Form screens aren't in the sidebar: add each entity's
// create route here, plus an edit route when the form shows something only
// existing data has (the Wireless Mouse's tag chips, with their remove
// buttons). Nor are views: add each entity's view of a full record and of
// its sparse one, so filled values and "not set" labels are both checked.
// The describe is this file's own so `playwright test <this file>`
// selects the suite (see mock-mode-banner.spec.ts).
test.describe('a11y', () => {
  defineA11ySuite({
    formRoutes: ['/widgets/new', '/widgets/1/edit'],
    viewRoutes: ['/widgets/1', '/widgets/4'],
    loggedOutRoutes: ['/login', '/register'],
  })
})

// The rich-text editor arrives in a chunk of its own, after the form. The
// form is checked while that chunk is held back (its placeholder showing)
// and again once the editor is in. Between the two, the editor is made a
// few moments after its field shows, too briefly for a scan to land in, so
// every change to the page is watched for an aria-controls naming an
// element that isn't there.
declare global {
  interface Window {
    __missingControls: string[]
  }
}

test.describe('a11y: the rich-text editor while it loads', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(colorScheme, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.addInitScript(() => {
        window.__missingControls = []
        new MutationObserver(() => {
          for (const element of document.querySelectorAll('[aria-controls]')) {
            for (const id of element.getAttribute('aria-controls')!.split(/\s+/)) {
              if (id && !document.getElementById(id)) window.__missingControls.push(id)
            }
          }
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-controls', 'id'] })
      })
      let release = () => {}
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('**/milkdown-editor-*.js', async (route) => {
        await held
        await route.continue()
      })
      await page.goto('/widgets/new')
      await expect(page.locator('form')).toBeVisible()
      await expect(page.locator('[data-slot="rich-text-editor"]')).toHaveAttribute('data-state', 'loading')
      await test.step('editor loading', () => expectNoAxeViolations(page))

      release()
      await expect(page.locator('#widget-description')).toBeVisible()
      await test.step('editor loaded', () => expectNoAxeViolations(page))
      expect(await page.evaluate(() => window.__missingControls)).toEqual([])
    })
  }
})

// Editing in place (cell pattern 18) changes the view while you work, so
// each state it can be in is checked on its own, in both themes: a field
// open, saving, refused, the rich-text editor, a choice's list, a
// picker's list, and the leave-page prompt.
const OPEN_LIST = { disableRules: ['region'], exclude: [POPUP_FOCUS_GUARDS] }

test.describe('a11y: editing in place on the view', () => {
  const nameField = (page: Page) => page.getByRole('textbox', { name: 'Name' })

  async function openName(page: Page) {
    await page.goto('/widgets/1')
    await page.getByRole('heading', { level: 1 }).getByText('Wireless Mouse').click()
    await expect(nameField(page)).toBeFocused()
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(colorScheme, () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ colorScheme })
      })

      test('a field open, saving, and refused', async ({ page }) => {
        await openName(page)
        await nameField(page).fill('Wireless Mouse Pro')
        await test.step('open', () => expectNoAxeViolations(page))

        await waitForMswReady(page)
        await page.evaluate(() => {
          const { worker, http, HttpResponse } = window.__msw
          worker.use(
            http.patch('*/api/widgets/:id', async () => {
              await new Promise((resolve) => setTimeout(resolve, 1500))
              return HttpResponse.json(
                { detail: [{ loc: ['body', 'name'], msg: 'A widget with this name already exists', type: 'value_error' }] },
                { status: 422 },
              )
            }),
          )
        })
        await page.keyboard.press('Enter')
        await expect(page.getByText('Saving…')).toBeVisible()
        await test.step('saving', () => expectNoAxeViolations(page))

        await expect(page.getByRole('alert')).toHaveText('A widget with this name already exists')
        await test.step('refused', () => expectNoAxeViolations(page))
      })

      test('long text open in the rich-text editor', async ({ page }) => {
        await page.goto('/widgets/1')
        await page.getByRole('region', { name: 'Description' }).getByText('Runs on one AA battery').click()
        await expect(page.getByRole('textbox', { name: 'Description' })).toBeFocused()
        await expectNoAxeViolations(page)
      })

      test("a choice's list and a picker's list", async ({ page }) => {
        await page.goto('/widgets/1')
        await page.getByRole('button', { name: 'Edit Status' }).click()
        await expect(page.getByRole('option', { name: 'Archived' })).toBeVisible()
        // An open list is portaled to <body>, outside the landmarks by
        // design, with focus guards of its own; contrast and every other
        // rule still check it.
        await test.step('status list', () => expectNoAxeViolations(page, OPEN_LIST))
        await page.keyboard.press('Escape')

        await page.getByRole('button', { name: 'Edit Extra Categories' }).click()
        await page.getByRole('combobox', { name: 'Extra Categories' }).fill('F')
        await expect(page.getByRole('option', { name: 'Furniture' })).toBeVisible()
        // A combobox you type in hides the rest of the page from screen
        // readers while its list is open (Floating UI's `markOthers`, the
        // ARIA combobox pattern: you work in the input and its list).
        // axe reads that as hidden focusable content and a missing <h1>;
        // the same happens with every picker, on the form too.
        await test.step('picker list', () =>
          expectNoAxeViolations(page, {
            ...OPEN_LIST,
            disableRules: [...OPEN_LIST.disableRules, 'aria-hidden-focus', 'page-has-heading-one'],
          }),
        )
      })

      test('the checklist: an item open, one being added, and a refused change', async ({ page }) => {
        await page.goto('/widgets/1')
        const checklist = page.getByRole('region', { name: 'Checklist' })
        await checklist.getByText('Pair the receiver', { exact: true }).click()
        await expect(page.getByRole('textbox', { name: 'Item 2 text' })).toBeFocused()
        await test.step('item open', () => expectNoAxeViolations(page))
        await page.keyboard.press('Escape')

        await checklist.getByRole('button', { name: 'Add item' }).click()
        await expect(page.getByRole('textbox', { name: 'Item 3 text' })).toBeFocused()
        await test.step('item being added', () => expectNoAxeViolations(page))
        await page.keyboard.press('Escape')

        await waitForMswReady(page)
        await page.evaluate(() => {
          const { worker, http, HttpResponse } = window.__msw
          worker.use(http.patch('*/api/widgets/:id', () => HttpResponse.json({ detail: 'Database is down' }, { status: 500 })))
        })
        await checklist.getByRole('button', { name: 'Move item 2 up' }).click()
        await expect(checklist.getByRole('alert')).toBeVisible()
        await test.step('change refused', () => expectNoAxeViolations(page))
      })

      test('the leave-page prompt', async ({ page }) => {
        await openName(page)
        await nameField(page).fill('Half typed')
        await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
        await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible()
        await expectNoAxeViolations(page)
      })
    })
  }
})
