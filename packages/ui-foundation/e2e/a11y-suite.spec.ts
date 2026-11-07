import { test } from '@playwright/test'
import { defineA11ySuite } from '../src/testing'

// defineA11ySuite's view check on a page with `<ModuleStrip mobile="row">`,
// at a phone's width (Roadmap 172). On a phone each ModuleCard is hidden
// beside its chip and both carry `data-state="success"`; the card comes
// first, so expectDataViewsLoaded waited for a hidden element and every
// view check on such a page timed out. The page is the Row page fixture,
// whose only visible data state is a chip. The same page is checked at a
// desktop width too, where the chips are the hidden ones.
test.use({ baseURL: 'http://localhost:6180' })

const ROW_PAGE = '/story.html?id=app-modulecard--row-page'

test.describe('a ModuleStrip mobile="row" page, on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  defineA11ySuite({ nav: [], checkSidebar: false, formRoutes: [], viewRoutes: [ROW_PAGE] })
})

test.describe('a ModuleStrip mobile="row" page, at a desktop width', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  defineA11ySuite({ nav: [], checkSidebar: false, formRoutes: [], viewRoutes: [ROW_PAGE] })
})
