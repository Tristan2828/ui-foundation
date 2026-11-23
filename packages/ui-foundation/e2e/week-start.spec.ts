import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// The day a date calendar's weeks start on, everywhere one opens
// (app/DateField's EveryCalendar and WeeksFromSunday): a form, a value
// edited in place, a date filter and a Fill in row, all on Wednesday Sep
// 16, 2026. Monday when nothing says, `weekStart="SU"` for Sunday: the
// weekday row, the weeks and the keyboard agree.
const story = (id: string, query = '') => `http://localhost:6180/story.html?id=app-datefield--${id}${query}`

// A day's name is react-day-picker's "Monday, September 14th, 2026", and
// axe doesn't find the "14" it shows as a word of that (docs/DEFERRED.md).
const AXE_RULES = ['landmark-one-main', 'page-has-heading-one', 'region', 'label-content-name-mismatch']

const popup = (page: Page) => page.locator('[data-slot="date-field-calendar"]')
const section = (page: Page, name: string) => page.getByRole('region', { name })
const typedField = (page: Page, name: string) =>
  page.locator('[data-slot="date-field"]').filter({ has: page.getByRole('textbox', { name, exact: true }) })

async function openIn(scope: Locator, page: Page) {
  await scope.getByRole('button', { name: 'Open Calendar' }).first().click()
  return popup(page)
}

const PLACES: Record<string, (page: Page) => Promise<Locator>> = {
  'a typed field on a form': (page) => openIn(typedField(page, 'Typed'), page),
  'a date button on a form': async (page) => {
    await page.getByRole('button', { name: 'Button', exact: true }).click()
    return popup(page)
  },
  'a typed value edited in place': async (page) => {
    await page.getByRole('button', { name: 'Edit Due' }).click()
    return openIn(section(page, 'Details'), page)
  },
  'a value edited in place by its button': async (page) => {
    await page.getByRole('button', { name: 'Edit Filed' }).click()
    return popup(page)
  },
  'a date filter': (page) => openIn(page.locator('[data-slot="filter-date-range"]'), page),
  'a Fill in row': (page) => openIn(typedField(page, 'Buy On'), page),
}

const WEEKS = {
  'every-calendar': { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], first: 14, last: 20 },
  'weeks-from-sunday': { days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], first: 13, last: 19 },
}

for (const [id, week] of Object.entries(WEEKS)) {
  test.describe(`${id}: weeks start on ${week.days[0]}`, () => {
    test.use({ locale: 'en-US' })

    for (const [place, open] of Object.entries(PLACES)) {
      test(`in ${place}`, async ({ page }) => {
        await page.goto(story(id))
        const calendar = await open(page)
        const picked = calendar.getByRole('button', { name: /September 16th, 2026/ })
        await expect(picked).toBeFocused()

        // The row over the days: what's shown, and its label.
        const heads = calendar.locator('thead th')
        await expect(heads).toHaveText(week.days.map((day) => day.slice(0, 2)))
        expect(await heads.evaluateAll((all) => all.map((head) => head.getAttribute('aria-label')))).toEqual(week.days)

        // Each day sits under its own weekday, named with it.
        const names = await calendar
          .locator('tbody tr')
          .filter({ has: page.getByRole('button', { name: /September 16th, 2026/ }) })
          .getByRole('button')
          .evaluateAll((all) => all.map((day) => day.getAttribute('aria-label') ?? ''))
        expect(names.map((name) => /(\w+day), September (\d+)/.exec(name)?.slice(1).join(' '))).toEqual(
          week.days.map((day, i) => `${day} ${week.first + i}`),
        )

        // Home and End are the week's ends.
        await page.keyboard.press('Home')
        await expect(calendar.getByRole('button', { name: new RegExp(`${week.days[0]}, September ${week.first}th`) })).toBeFocused()
        await page.keyboard.press('End')
        await expect(calendar.getByRole('button', { name: new RegExp(`${week.days[6]}, September ${week.last}th`) })).toBeFocused()
      })
    }

    for (const theme of ['light', 'dark']) {
      for (const place of ['a typed field on a form', 'a typed value edited in place', 'a date filter']) {
        test(`${place}, its calendar open, has zero axe violations (${theme})`, async ({ page }) => {
          await page.goto(story(id, `&theme=${theme}`))
          await expect(await PLACES[place](page)).toBeVisible()
          const results = await new AxeBuilder({ page }).disableRules(AXE_RULES).analyze()
          expect(results.violations).toEqual([])
        })
      }
    }
  })
}
