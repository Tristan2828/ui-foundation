import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Every primitive the package ships with a story. Apps import these from
// the package rather than installing shadcn's own, so the package answers
// for their accessibility and their colours. Accessibility of whole
// screens — including dark-mode contrast — is the template's
// e2e/a11y.spec.ts. Story ids are `title`+export slugs.
const STORYBOOK_URL = 'http://localhost:6006'
const PRIMITIVES = [
  'alert',
  'badge',
  'button',
  'card',
  'checkbox',
  'empty',
  'input',
  'separator',
  'sheet',
  'sidebar',
  'skeleton',
  'spinner',
  'switch',
  'table',
  'toast',
  'toggle',
  'tooltip',
  'typography',
]

// Stories that exist to be contrast-checked rather than screenshotted:
// every semantic tone in every style on screen at once, so axe sees all
// twelve combinations in both themes. Adding a tone or a style without
// adding it here would ship an unmeasured color.
const TONE_STORY_IDS = ['ui-badge--all-tones']

// Composites whose job is design language rather than structure: <Markdown>
// styles every app's long text (headings, lists, links, tables, code), so
// it answers for its contrast and its colours the way a primitive does.
// Each id comes with text the story must show, so an iframe that rendered
// nothing can't pass every rule trivially.
// <RichTextEditor> is the same text being edited, so it answers the same way.
// The banners above the router (MockModeBanner, DataEnvironmentBanner) are
// safety cues on every screen, so their solid fills answer too.
// <StageCircle> and the cell patterns' markup (patterns/CellPatterns) are
// design language too: each also has its glyphs measured below.
// <CountLink> is a link style every parent table's counts share.
// The categorical slots, every one on the page and on a card.
// <EntityView>'s two layouts are every record's page: the rail's narrow
// column and its stacked fields answer for their contrast too.
// Its Lists story is the list edited in place: its rows and buttons.
// <DataTable>'s opt-ins for a small entity: sized to its columns, and
// edited in its rows (every cell's pencil, InlineCreate).
// <WidgetCard> is every hub page's widget: its header link, a row's tone
// badge, muted note and switch, and the compact error, in every state.
const COMPOSITE_STORIES = [
  { id: 'app-markdown--default', mustShow: 'Measure twice, cut once.' },
  { id: 'app-richtexteditor--default', mustShow: 'Measure twice, cut once.' },
  { id: 'app-richtexteditor--features', mustShow: 'characters over the limit' },
  { id: 'app-stagecircle--default', mustShow: 'In progress' },
  { id: 'app-banners--default', mustShow: 'Dev data:' },
  { id: 'patterns-cellpatterns--pressed-icon-in-a-cell', mustShow: 'Bookshelf' },
  { id: 'patterns-cellpatterns--icons-with-one-tooltip', mustShow: 'Standing mat' },
  { id: 'patterns-cellpatterns--dependency-list', mustShow: '2 holds' },
  { id: 'app-countlink--default', mustShow: 'Move house' },
  // <Board>: a list as columns of cards, every app's second view of a list.
  { id: 'app-board--default', mustShow: 'Repaint the fence' },
  { id: 'app-board--empty-columns', mustShow: 'No planned projects' },
  { id: 'app-board--states', mustShow: 'No projects yet' },
  // <SpinWheel>: its slices' fills and labels, a picked and a tinted slice, the empty wheel.
  { id: 'app-spinwheel--default', mustShow: 'Spin to pick what to do next.' },
  { id: 'app-spinwheel--all-states', mustShow: 'No items yet' },
  // <FillInQueue>: the progress, the choices (a suggestion dashed), the buttons, every state.
  { id: 'app-fillinqueue--default', mustShow: 'Repaint the fence' },
  { id: 'app-fillinqueue--states', mustShow: 'Every project has an effort' },
  // FillInField's rows by kind (money with a suggestion, a date, a long list), and a record's group.
  { id: 'app-fillinqueue--fields', mustShow: 'New desk chair' },
  { id: 'patterns-categoricalcolour--default', mustShow: 'On a card' },
  { id: 'app-entityview--column', mustShow: 'Measure twice, cut once.' },
  { id: 'app-entityview--rail', mustShow: 'Measure twice, cut once.' },
  { id: 'app-entityview--rail-main-first', mustShow: 'Measure twice, cut once.' },
  { id: 'app-entityview--lists', mustShow: 'Return the keys' },
  { id: 'app-entityview--autosave', mustShow: 'Moving to the third floor.' },
  // A notice across the page and a source credit under both columns.
  { id: 'app-entityview--notice-and-footer', mustShow: 'Data from' },
  // <Notice>: every tone's wash, on the page and on a card.
  { id: 'app-notice--default', mustShow: 'This record is read-only.' },
  // A plain date on a form, required and optional (#157).
  { id: 'app-datefield--default', mustShow: 'No due date' },
  // One image on a record: every look of ImageField, and on a form.
  { id: 'app-imagefield--all-looks', mustShow: 'Add a photo of the plant.' },
  { id: 'app-imagefield--default', mustShow: 'Edit plant' },
  // Images in written text, and the editor that uploads them (its Image button).
  { id: 'app-markdown--images', mustShow: 'A view of the yard:' },
  { id: 'app-richtexteditor--image-uploads', mustShow: 'Paste or drop a photo here.' },
  // Written text under a page's h1 and a section's h2 (headingLevel), and
  // a wide table's box, a named tab stop while it scrolls (#223).
  { id: 'app-markdown--heading-levels', mustShow: 'A page of notes' },
  { id: 'app-markdown--wide-table', mustShow: 'A table that scrolls sideways:' },
  { id: 'app-richtexteditor--heading-levels', mustShow: 'A form with notes' },
  { id: 'app-richtexteditor--wide-table', mustShow: 'wideTable' },
  // Allow reminders in every state, on a card (#167).
  { id: 'app-allowreminders--default', mustShow: 'Reminders are on for this device.' },
  { id: 'app-datatable--content-width', mustShow: 'Finance' },
  { id: 'app-datatable--edit-in-the-rows', mustShow: 'Finance' },
  { id: 'app-datatable--grouped', mustShow: 'Earlier this week' },
  // DataTable's card layouts (#252): a feed's grid and compact list under
  // day headings, and covers with a round Read button and a placeholder.
  { id: 'app-datatable-layouts--feed', mustShow: 'Earlier this week' },
  { id: 'app-datatable-layouts--feed-grid', mustShow: 'Earlier this week' },
  { id: 'app-datatable-layouts--feed-compact', mustShow: 'Earlier this week' },
  { id: 'app-datatable-layouts--covers', mustShow: 'Harbour Lights' },
  { id: 'app-datatable--grouped-no-matches', mustShow: 'No text items' },
  // A highlighted row's wash, with muted text inside it (#156).
  { id: 'app-datatable--highlighted', mustShow: 'Health' },
  // A list of sub-records, and one whose items open to edit, with Duplicate (#222).
  { id: 'app-listeditor--default', mustShow: 'Pack for the trip' },
  { id: 'app-listeditor--rows-that-open', mustShow: 'Romanian deadlift' },
  // A totals row under the columns it adds up, a pinned label (#225).
  { id: 'app-datatable--totals', mustShow: 'Total · 8 items' },
  // The Group menu at None, rows grouped by a multi-value field (folding
  // headings, counts, summaries), the list with a detail panel, and a
  // record's goal and key numbers in its header.
  { id: 'app-datatable-grouping--chores', mustShow: 'Descale the kettle' },
  { id: 'app-datatable-grouping--chores-by-area', mustShow: 'No area' },
  { id: 'app-datatable-grouping--chores-with-panel', mustShow: 'Descale the kettle' },
  { id: 'app-entityview--header-slots', mustShow: 'Boxes packed' },
  // Cell pattern 9's step bar and star, and pattern 13's ring (#154, #156).
  { id: 'patterns-scales--default', mustShow: 'On a card' },
  { id: 'app-appshell--sections', mustShow: 'Page at /projects/categories/2' },
  { id: 'app-appshell--flat', mustShow: 'Page at /projects/7' },
  // Sections that fold, open and folded (#152).
  { id: 'app-appshell--collapsible', mustShow: 'Page at /projects/categories/2' },
  { id: 'app-appshell--version', mustShow: 'Version 3655449 · PR #139' },
  // An entry opening a list on a saved view (#188), and a record's view in the shell (#186).
  { id: 'app-appshell--saved-view', mustShow: 'Page at /reading?status=unread&sort=title:asc' },
  { id: 'app-appshell--with-view', mustShow: 'Pat Owner' },
  // The app's logo beside its title, and alone on the rail (#211).
  { id: 'app-appshell--with-logo', mustShow: 'Page at /projects/7' },
  { id: 'app-appshell--with-logo-rail', mustShow: 'Page at /projects/7' },
  // A module's pages under its entry, open, and on the rail (#239).
  { id: 'app-appshell--nested', mustShow: 'Page at /media/channels/3' },
  { id: 'app-appshell--nested-rail', mustShow: 'Page at /media/channels/3' },
  { id: 'app-widgetcard--default', mustShow: 'Fix the gate latch' },
  { id: 'app-widgetcard--all-states', mustShow: 'Nothing on hold' },
  // A card titled with an outside service's mark (#211).
  { id: 'app-widgetcard--brand-mark', mustShow: 'Timber stains compared' },
  // A value over time against a target, every state (#238).
  { id: 'app-linechart--default', mustShow: 'Standing desk' },
  { id: 'app-linechart--all-states', mustShow: 'No points yet' },
  // Cards that fold to their header, one folded at rest (#233).
  { id: 'app-widgetcard--collapsible', mustShow: 'Fix the gate latch' },
  // A folded card's value in each state, an accordion, and a hub's
  // Customize sheet, open (#263).
  { id: 'app-widgetcard--folded-summary', mustShow: '3 ready' },
  { id: 'app-widgetcard--accordion', mustShow: 'Fix the gate latch' },
  { id: 'app-widgetlayoutsheet--open', mustShow: 'Customize this page' },
  // <ModuleCard> is every hub's places (#224): the band's 10% wash of each
  // slot under foreground text, the number, the note, the action, in
  // every state, and at compact.
  { id: 'app-modulecard--default', mustShow: 'beds planted' },
  { id: 'app-modulecard--all-states', mustShow: 'No slot: a plain band' },
  { id: 'app-modulecard--compact', mustShow: 'beds planted' },
  { id: 'app-modulecard--row', mustShow: 'beds planted' },
  { id: 'app-modulecard--row-states', mustShow: 'No slot: a plain band' },
  // <SessionView> is a timed screen's whole viewport: its header controls
  // and a timer's own (the big digits, the status line, a pressed toggle).
  { id: 'app-sessionview--timer', mustShow: '1:00' },
  // Its dark stage (#253): dark inside the view in both app themes, the
  // lit time on the tone's glow, the quiet outline controls.
  { id: 'app-sessionview--dark-stage', mustShow: '1:00' },
  // Every density, the primitives and DataTable in each (large is the one
  // that changes their type and sizes).
  { id: 'patterns-density--primitives', mustShow: 'data-density="large"' },
  { id: 'patterns-density--data-tables', mustShow: 'data-density="large"' },
  { id: 'patterns-density--sidebars', mustShow: 'data-density="large"' },
  { id: 'patterns-density--hub-cards', mustShow: 'data-density="large"' },
]

// Stories whose glyphs carry meaning on their own: every <svg> in them must
// clear WCAG's 3:1 non-text minimum against the background behind it.
// axe measures text only, so without this an icon could fade below it
// unnoticed (a faint "off" state, a category slot in dark mode).
// A story whose glyphs are in a popup opens it first, and names what it
// opened (`shows`: a selector for it, `[data-open]` by default).
const GLYPH_STORIES: {
  id: string
  open?: (page: import('@playwright/test').Page) => Promise<void>
  shows?: string
  name?: string
}[] = [
  { id: 'app-stagecircle--default' },
  // The ring's arc, the step bar's filled steps, the star in each shape.
  { id: 'patterns-scales--default' },
  { id: 'app-banners--default' },
  // Each tone's icon on its own wash, and the source credit's link marks.
  { id: 'app-notice--default' },
  { id: 'app-entityview--notice-and-footer' },
  // The bells on the button, in the on notice and the blocked one.
  { id: 'app-allowreminders--default' },
  { id: 'patterns-cellpatterns--pressed-icon-in-a-cell' },
  { id: 'patterns-cellpatterns--icons-with-one-tooltip' },
  // Every categorical slot, against the page and against a card.
  { id: 'patterns-categoricalcolour--default' },
  {
    id: 'patterns-cellpatterns--dependency-list',
    open: (page) => page.getByRole('button', { name: /^2 holds/ }).click(),
  },
  { id: 'ui-toggle--default' },
  // A widget's title icon, external-link mark and compact error icon.
  { id: 'app-widgetcard--all-states' },
  { id: 'app-widgetcard--brand-mark' },
  // A chart's line (info-text) and target (success-text) on a card (#238).
  { id: 'app-linechart--default' },
  { id: 'app-linechart--all-states' },
  // The fold chevrons (#233).
  { id: 'app-widgetcard--collapsible' },
  // The accordion's chevrons, and the sheet's arrows (#263).
  { id: 'app-widgetcard--accordion' },
  { id: 'app-widgetlayoutsheet--open' },
  // A summary line's chevron and the row's Move, Duplicate and Remove icons (#222).
  { id: 'app-listeditor--rows-that-open' },
  // A place's slot-tinted icon on its own wash, the external mark, a brand
  // mark, and the error icon.
  { id: 'app-modulecard--default' },
  { id: 'app-modulecard--all-states' },
  // SessionView's header (Full screen, Close) and a timer's controls. It's
  // open on load, portaled to <body> like a popup.
  {
    id: 'app-sessionview--timer',
    open: (page) => page.getByRole('dialog', { name: 'Morning stretch' }).waitFor(),
    shows: '[data-slot=session-view]',
  },
  {
    id: 'app-sessionview--dark-stage',
    open: (page) => page.getByRole('dialog', { name: 'Morning stretch' }).waitFor(),
    shows: '[data-slot=session-view]',
  },
  // Category glyphs in DataTable rows at every density.
  { id: 'patterns-density--data-tables' },
  // ImageField's buttons and its empty tile, and the toolbar's Image button.
  { id: 'app-imagefield--all-looks' },
  { id: 'app-richtexteditor--image-uploads' },
  // The rich-text toolbar's icons (the read-only editor's are disabled:
  // a disabled control is exempt, and its opacity isn't measured here).
  { id: 'app-richtexteditor--features' },
  // The floating toolbar's, over selected words, on the popover surface.
  {
    id: 'app-richtexteditor--features',
    name: 'floating toolbar',
    open: (page) =>
      page.getByRole('textbox', { name: 'formats', exact: true }).locator('p').first().dblclick({ position: { x: 8, y: 8 } }),
    shows: '[data-slot=rich-text-floating-toolbar]',
  },
  // Written text's: callout icons on their washes, task boxes, the
  // external-link mark (<Markdown>), and the callout kind buttons (the
  // editor), then the callout menu's kind icons on the popover surface.
  { id: 'app-markdown--default' },
  { id: 'app-richtexteditor--default' },
  {
    id: 'app-richtexteditor--features',
    name: 'callout menu',
    open: (page) => page.getByRole('button', { name: 'Note callout: change its kind' }).click(),
    shows: '[data-slot=dropdown-menu-content]',
  },
  // The Table menu's, on the popover surface.
  {
    id: 'app-richtexteditor--features',
    name: 'table menu',
    open: async (page) => {
      await page.locator('[data-fixture="table"] td').first().click()
      await page.locator('[data-fixture="table"]').getByRole('button', { name: 'Table', exact: true }).click()
    },
    shows: '[data-slot=dropdown-menu-content]',
  },
  // The slash menu's, on the popover surface, one item highlighted.
  {
    id: 'app-richtexteditor--features',
    name: 'slash menu',
    open: async (page) => {
      await page.getByRole('textbox', { name: 'formats', exact: true }).locator('p').last().click()
      await page.waitForTimeout(100)
      await page.keyboard.press('ControlOrMeta+End')
      await page.keyboard.press('Enter')
      await page.keyboard.type('/')
    },
    shows: '[data-slot=rich-text-slash-menu]',
  },
]

function storyUrlById(id: string, theme: 'light' | 'dark', density?: 'large') {
  const globals = density ? `theme:${theme};density:${density}` : `theme:${theme}`
  return `${STORYBOOK_URL}/iframe.html?id=${id}&viewMode=story&globals=${globals}`
}

function storyUrl(name: string, theme: 'light' | 'dark') {
  return storyUrlById(`ui-${name}--default`, theme)
}

// Storybook's iframe.html is an isolated component preview, not a full
// page — it has no <main>, no <h1>, and content isn't wrapped in a
// landmark by design. axe's page-structure rules exist to catch real
// pages missing this; on a story preview they're false positives, not a
// component defect (the old kitchen-sink test never hit this because it
// ran against the full /kitchen-sink page, which had both).
function analyzeStory(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page })
    .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
    .analyze()
}

test.describe('storybook stories have zero axe violations', () => {
  for (const name of PRIMITIVES) {
    test(`${name} story is accessible`, async ({ page }) => {
      await page.goto(storyUrl(name, 'light'))
      const results = await analyzeStory(page)
      expect(results.violations).toEqual([])
    })
  }
})

test.describe('composite stories have zero axe violations in both themes', () => {
  for (const { id, mustShow } of COMPOSITE_STORIES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${id} is accessible (${theme})`, async ({ page }) => {
        await page.goto(storyUrlById(id, theme))
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        await expect(page.getByText(mustShow)).toBeVisible()
        const results = await analyzeStory(page)
        expect(results.violations).toEqual([])
      })
    }
  }
})

// The collapsed icon rail hides each group label with opacity and pulls it
// up over the group above (-mt-8). Invisible is not inert: without
// pointer-events-none, a second group's label swallows clicks on the last
// entry of the first. click() fails on "element intercepts pointer events".
test('collapsed sidebar: a second group label does not swallow clicks on the group above', async ({ page }) => {
  await page.goto(storyUrlById('ui-sidebar--collapsed-with-two-groups', 'light'))
  await page.getByRole('button', { name: 'Item two' }).click({ timeout: 5_000 })
  await expect(page.getByText('Clicked: Item two')).toBeVisible()
})

// Phase 3 and 4 both flagged dark-mode contrast for --destructive /
// --destructive-foreground as verified only by hand-computed ratios, never
// by a check. axe's color-contrast rule running against the rendered dark
// DOM is that check, for this token and every other one. Kept per-story
// (not one page-wide pass like the retired kitchen-sink test) so a
// contrast regression in any single primitive still fails independently.
test.describe('storybook stories have zero axe violations in dark mode', () => {
  for (const name of PRIMITIVES) {
    test(`${name} story is accessible in dark mode`, async ({ page }) => {
      await page.goto(storyUrl(name, 'dark'))
      await expect(page.locator('html')).toHaveClass(/dark/)
      const results = await analyzeStory(page)
      expect(results.violations).toEqual([])
    })
  }
})

// The large density changes every primitive's type and size, so each
// primitive's own story runs again under it (data-density on <html>, the
// way an app sets it), in both themes.
test.describe('primitive stories have zero axe violations at the large density', () => {
  for (const name of PRIMITIVES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${name} story is accessible at large (${theme})`, async ({ page }) => {
        await page.goto(storyUrlById(`ui-${name}--default`, theme, 'large'))
        await expect(page.locator('html')).toHaveAttribute('data-density', 'large')
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        const results = await analyzeStory(page)
        expect(results.violations).toEqual([])
      })
    }
  }
})

// Composites read on a screen across the room (a hub page on a TV), run
// again under the large density in both themes.
const LARGE_COMPOSITE_STORIES = [
  { id: 'app-widgetcard--default', mustShow: 'Fix the gate latch' },
  { id: 'app-widgetcard--all-states', mustShow: 'Nothing on hold' },
  { id: 'app-modulecard--default', mustShow: 'beds planted' },
  { id: 'app-modulecard--all-states', mustShow: 'No slot: a plain band' },
]

test.describe('composite stories have zero axe violations at the large density', () => {
  for (const { id, mustShow } of LARGE_COMPOSITE_STORIES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${id} is accessible at large (${theme})`, async ({ page }) => {
        await page.goto(storyUrlById(id, theme, 'large'))
        await expect(page.locator('html')).toHaveAttribute('data-density', 'large')
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        await expect(page.getByText(mustShow)).toBeVisible()
        const results = await analyzeStory(page)
        expect(results.violations).toEqual([])
      })
    }
  }
})

// The semantic tones (success / warning / destructive / info, each as a solid
// fill, an outline and a tinted chip) are the one part of the design
// language whose whole correctness is a contrast ratio. theme.css records
// the measured numbers; this is what proves them against the rendered DOM,
// in both themes, before a consuming app inherits them.
test.describe('semantic tones meet contrast in both themes', () => {
  for (const id of TONE_STORY_IDS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${id} has zero axe violations (${theme})`, async ({ page }) => {
        await page.goto(storyUrlById(id, theme))
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        // Guard against a silently empty story: an iframe that rendered
        // nothing would pass every contrast rule trivially.
        await expect(page.getByText('outline-success')).toBeVisible()
        const results = await analyzeStory(page)
        expect(results.violations).toEqual([])
      })
    }
  }
})

// Every colour a shipped primitive paints must come from a token.
//
// This replaces the pixel screenshot baselines that used to guard the same
// thing. Those existed to catch hardcoded colours the ESLint token rule
// cannot see — an inline style, an SVG fill — but they cost a Linux
// round-trip through CI's artifact upload to regenerate, and every new
// variant multiplied the images to review. This asserts the actual
// property instead of a picture of it, runs on any OS, and needs no
// baseline.
//
// The mechanics that make it work: a computed colour is not a token
// *string* — `--success` reads back as `oklch(52.7% .154 150.069)` while
// the element computes `oklch(0.527 0.154 150.069)`, and an opacity
// modifier computes as `oklab(0.527 -0.133 0.077 / 0.15)`. All three are
// the same colour. So both sides are normalised through a canvas, which
// resolves any CSS colour to sRGB, and alpha is dropped — an opacity
// modifier is still the token's colour.
const COLOR_PROPERTIES = ['backgroundColor', 'color', 'borderTopColor', 'fill'] as const

async function offTokenColors(page: import('@playwright/test').Page) {
  return page.evaluate((properties) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // Assigning to fillStyle does NOT normalise a modern colour: Chrome
    // echoes `oklch(...)` back in the same space. Rasterising does — fill a
    // 1x1 pixel and read it, and the browser has done the conversion for
    // us, whatever the input space.
    //
    // Alpha is stripped from the string first rather than handled after:
    // an opacity modifier is still the token's colour, and an opaque fill
    // reads back as exact integers with no rounding to tolerate.
    const stripAlpha = (value: string): string | null => {
      const slash = value.match(/^(\w+)\((.*?)\s*\/\s*([\d.%]+)\s*\)$/)
      if (slash) {
        const alpha = slash[3].endsWith('%') ? Number(slash[3].slice(0, -1)) / 100 : Number(slash[3])
        return alpha === 0 ? null : `${slash[1]}(${slash[2]})`
      }
      const rgba = value.match(/^rgba?\(([^)]+)\)$/)
      if (rgba) {
        const parts = rgba[1].split(',').map((p) => p.trim())
        if (parts.length === 4 && Number(parts[3]) === 0) return null
        return `rgb(${parts.slice(0, 3).join(', ')})`
      }
      return value
    }

    const toRgb = (value: string): string | null => {
      const opaque = stripAlpha(value.trim())
      if (!opaque) return null // fully transparent: paints nothing
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000000'
      ctx.fillStyle = opaque
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return `rgb(${r}, ${g}, ${b})`
    }

    const rootStyle = getComputedStyle(document.documentElement)

    // getComputedStyle does not *enumerate* custom properties, only resolve
    // them by name — so the token names have to come from the stylesheets
    // themselves. Any `--x` declared on :root or .dark counts, which picks
    // up both layers: the semantic tokens components consume and the
    // primitives those resolve to. Either is a token; a hardcoded colour is
    // neither.
    const tokenNames = new Set<string>()
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue // cross-origin sheet; nothing of ours lives there
      }
      for (const rule of Array.from(rules)) {
        const style = (rule as CSSStyleRule).style
        const selector = (rule as CSSStyleRule).selectorText
        if (!style || !selector) continue
        if (!selector.includes(':root') && !selector.includes('.dark')) continue
        for (const name of Array.from(style)) {
          if (name.startsWith('--')) tokenNames.add(name)
        }
      }
    }

    const allowed = new Set<string>()
    for (const name of tokenNames) {
      const declared = rootStyle.getPropertyValue(name).trim()
      if (!declared) continue
      const rgb = toRgb(declared)
      if (rgb) allowed.add(rgb)
    }
    // Pure black and white are legitimate even when no token resolves to
    // them — a UA default border, an SVG with no fill of its own.
    for (const extra of ['rgb(0, 0, 0)', 'rgb(255, 255, 255)']) allowed.add(extra)

    if (tokenNames.size === 0) {
      return ['no custom properties found in any stylesheet — the check would be vacuous']
    }

    const offenders: string[] = []
    const root = document.querySelector('#storybook-root')
    if (!root) return ['#storybook-root not found — the story did not render']
    for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
      const style = getComputedStyle(element as Element)
      for (const property of properties) {
        const raw = style[property as 'color']
        if (!raw || raw === 'none') continue
        const rgb = toRgb(raw)
        if (rgb && !allowed.has(rgb)) {
          offenders.push(`<${element.tagName.toLowerCase()}> ${property}: ${raw} -> ${rgb}`)
        }
      }
    }
    return offenders
  }, COLOR_PROPERTIES as unknown as string[])
}

test.describe('primitives paint only token colours', () => {
  for (const name of PRIMITIVES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${name} uses only tokens (${theme})`, async ({ page }) => {
        await page.goto(storyUrl(name, theme))
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        await expect(page.locator('#storybook-root')).toBeVisible()
        expect(await offTokenColors(page)).toEqual([])
      })
    }
  }

  for (const { id, mustShow } of COMPOSITE_STORIES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${id} uses only tokens (${theme})`, async ({ page }) => {
        await page.goto(storyUrlById(id, theme))
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        await expect(page.getByText(mustShow)).toBeVisible()
        expect(await offTokenColors(page)).toEqual([])
      })
    }
  }

  for (const id of TONE_STORY_IDS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${id} uses only tokens (${theme})`, async ({ page }) => {
        await page.goto(storyUrlById(id, theme))
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        await expect(page.getByText('outline-success')).toBeVisible()
        expect(await offTokenColors(page)).toEqual([])
      })
    }
  }
})

// Density is tokens, not a prop (styles/theme.css), so nothing type-checks
// that data-density reaches the cells. This measures it: in the Densities
// story, each step must make both the header and the body rows taller.
test('table density tokens change row height: compact < default < comfortable', async ({ page }) => {
  await page.goto(storyUrlById('ui-table--densities', 'light'))
  const heights = async (density: string, part: 'th' | 'td') =>
    page
      .getByRole('table', { name: `Widgets (${density})` })
      .locator(part)
      .first()
      .evaluate((cell) => cell.getBoundingClientRect().height)
  for (const part of ['th', 'td'] as const) {
    const [compact, standard, comfortable] = [
      await heights('compact', part),
      await heights('default', part),
      await heights('comfortable', part),
    ]
    expect(compact, `${part}: compact vs default`).toBeLessThan(standard)
    expect(standard, `${part}: default vs comfortable`).toBeLessThan(comfortable)
    expect(comfortable, `${part}: comfortable vs large`).toBeLessThan(await heights('large', part))
  }
})

// Large reaches past tables through Tailwind's own scale and a few patched
// primitives (styles/theme.css), so nothing type-checks it either. In the
// Density stories, every measured part must keep today's size with no
// data-density (and at compact and comfortable, which only touch tables),
// and be larger at large. The pixel values are what the primitives had
// before density reached them: a change to one is a change for every app.
const TODAY: Record<string, { width?: number; height?: number; fontSize?: number }> = {
  button: { height: 32 },
  icon: { width: 16, height: 16 },
  input: { height: 32 },
  body: { fontSize: 14 },
  checkbox: { width: 16, height: 16 },
  switch: { width: 32, height: 18.4 },
  badge: { height: 20 },
}

test('large density grows the primitives; every other density keeps their size', async ({ page }) => {
  await page.goto(storyUrlById('patterns-density--primitives', 'light'))
  const measure = (density: string, part: string) =>
    page
      .locator(`[data-sample="${density}"] [data-measure="${part}"]`)
      .evaluate((el) => {
        const box = el.getBoundingClientRect()
        return { width: box.width, height: box.height, fontSize: parseFloat(getComputedStyle(el).fontSize) }
      })
  for (const [part, today] of Object.entries(TODAY)) {
    const keys = Object.keys(today) as (keyof typeof today)[]
    for (const density of ['default', 'compact', 'comfortable']) {
      const got = await measure(density, part)
      for (const key of keys) expect(got[key], `${part} ${key} (${density})`).toBeCloseTo(today[key]!, 1)
    }
    const large = await measure('large', part)
    for (const key of keys) expect(large[key], `${part} ${key} (large)`).toBeGreaterThan(today[key]!)
  }
})

// compact reaches a hub's cards through the density-compact variant
// (#224), which nothing type-checks. In the Hub cards story, compact must
// tighten WidgetCard's padding and rows and ModuleCard's band and body;
// every other density keeps today's (large grows them, as it grows all).
// Text stays at type-body: the rows' text keeps its 14px.
test('compact density tightens the hub cards; the default keeps their size', async ({ page }) => {
  await page.goto(storyUrlById('patterns-density--hub-cards', 'light'))
  const measure = (density: string) =>
    page.locator(`[data-sample="${density}"]`).evaluate((sample) => {
      const height = (selector: string) => sample.querySelector(selector)!.getBoundingClientRect().height
      const widget = sample.querySelector('[data-slot=widget-card] [data-slot=card]')!
      return {
        widgetPadding: parseFloat(getComputedStyle(widget).paddingTop),
        row: height('[data-slot=widget-list-item]'),
        band: height('[data-slot=module-card-band]'),
        body: height('[data-slot=module-card-body]'),
        rowText: parseFloat(getComputedStyle(sample.querySelector('[data-slot=widget-list-item]')!).fontSize),
      }
    })
  const today = { widgetPadding: 16, row: 37, band: 36, body: 66, rowText: 14 }
  for (const density of ['default', 'comfortable']) {
    const got = await measure(density)
    for (const [key, value] of Object.entries(today)) {
      expect(got[key as keyof typeof today], `${key} (${density})`).toBeCloseTo(value, 1)
    }
  }
  const compact = await measure('compact')
  for (const key of ['widgetPadding', 'row', 'band', 'body'] as const) {
    expect(compact[key], `${key} (compact)`).toBeLessThan(today[key])
  }
  expect(compact.rowText, 'rowText (compact)').toBe(today.rowText)
})

test('large density widens the sidebar; the default keeps 16rem', async ({ page }) => {
  await page.goto(storyUrlById('patterns-density--sidebars', 'light'))
  const width = (density: string) =>
    page
      .locator(`[data-sample="${density}"] [data-measure="sidebar"]`)
      .evaluate((el) => el.getBoundingClientRect().width)
  expect(await width('default')).toBe(256)
  expect(await width('large')).toBeGreaterThan(256)
})

// The type-* roles are @utility rules over --type-* tokens. A typo in
// either is silent: the class just sets nothing. Each role's computed font
// size must equal its token, so an unbuilt or misnamed role fails here.
test('typography roles resolve to their tokens', async ({ page }) => {
  await page.goto(storyUrlById('ui-typography--default', 'light'))
  const roles = ['page-title', 'section-title', 'body', 'label', 'caption', 'numeric', 'heading-1', 'heading-2', 'heading-3']
  for (const role of roles) {
    const { size, expected, weight, expectedWeight } = await page
      .locator(`[data-role="type-${role}"]`)
      .evaluate((el, name) => {
        const root = getComputedStyle(document.documentElement)
        const px = (rem: string) => `${parseFloat(rem) * parseFloat(root.fontSize)}px`
        const style = getComputedStyle(el)
        return {
          size: style.fontSize,
          expected: px(root.getPropertyValue(`--type-${name}-size`)),
          weight: style.fontWeight,
          expectedWeight: root.getPropertyValue(`--type-${name}-weight`).trim(),
        }
      }, role)
    expect(size, `type-${role} font-size`).toBe(expected)
    expect(weight, `type-${role} font-weight`).toBe(expectedWeight)
  }
  await expect(page.locator('[data-role="type-numeric"]')).toHaveCSS('font-variant-numeric', 'tabular-nums')
})

// Each <svg>'s ink (its `color`, which strokes and fills use through
// currentColor) against the first opaque background behind it, as a WCAG
// contrast ratio. Colours go through the same canvas as the token check,
// so any colour space resolves; a translucent ink (an opacity modifier) is
// painted over its background first, so the ratio is of what's on screen.
async function glyphContrasts(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const paint = (...colours: string[]) => {
      ctx.clearRect(0, 0, 1, 1)
      for (const colour of colours) {
        ctx.fillStyle = '#000000'
        ctx.fillStyle = colour
        ctx.fillRect(0, 0, 1, 1)
      }
      return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
    }
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const c = v / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const alpha = (colour: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'
      ctx.fillStyle = colour
      ctx.fillRect(0, 0, 1, 1)
      return ctx.getImageData(0, 0, 1, 1).data[3]
    }
    // Every background behind the element, outermost first, from the first
    // opaque one: painted in that order, they're what the glyph sits on.
    const backgroundsBehind = (element: Element) => {
      const layers: string[] = []
      for (let node: Element | null = element; node; node = node.parentElement) {
        const colour = getComputedStyle(node).backgroundColor
        const a = alpha(colour)
        if (a === 0) continue
        layers.unshift(colour)
        if (a === 255) return layers
      }
      return ['rgb(255, 255, 255)', ...layers]
    }
    // The page, not only the story's root: a popup is portaled to <body>.
    const visible = Array.from(document.body.querySelectorAll('svg')).filter((svg) => svg.checkVisibility())
    return visible.map((svg) => {
      const backgrounds = backgroundsBehind(svg)
      const ink = getComputedStyle(svg).color
      const [a, b] = [luminance(paint(...backgrounds, ink)), luminance(paint(...backgrounds))]
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      const where = svg.closest('[aria-label]')?.getAttribute('aria-label') ?? svg.closest('li, td, th')?.textContent
      return { glyph: `${svg.getAttribute('class')} in "${where}"`, ratio: Math.round(ratio * 100) / 100 }
    })
  })
}

test.describe('glyphs clear the 3:1 non-text minimum in both themes', () => {
  for (const { id, open, shows = '[data-open]', name } of GLYPH_STORIES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${id}${name ? ` ${name}` : ''} (${theme})`, async ({ page }) => {
        await page.goto(storyUrlById(id, theme))
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        await open?.(page)
        await expect(page.locator(open ? `${shows} svg` : '#storybook-root svg').first()).toBeVisible()
        const glyphs = await glyphContrasts(page)
        if (process.env.PRINT_GLYPHS) console.log(id, theme, JSON.stringify(glyphs))
        expect(glyphs.length).toBeGreaterThan(0)
        expect(glyphs.filter(({ ratio }) => ratio < 3)).toEqual([])
      })
    }
  }
})

// The categorical slots: each resolves to its own colour on both surfaces,
// in both themes. A slot whose token is missing (in one theme, or from
// index.css's Tailwind colours) leaves its glyph the label's colour, which
// the glyph check above would pass.
test.describe('categorical slots', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`all twelve are distinct colours on the page and on a card (${theme})`, async ({ page }) => {
      await page.goto(storyUrlById('patterns-categoricalcolour--default', theme))
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
      for (const surface of ['background', 'card']) {
        const list = page.locator(`[data-surface="${surface}"]`)
        await expect(list.locator('li')).toHaveCount(12)
        const colours = await list.locator('li').evaluateAll((items) =>
          items.map((li) => ({ glyph: getComputedStyle(li.querySelector('svg')!).color, label: getComputedStyle(li).color })),
        )
        expect(new Set(colours.map(({ glyph }) => glyph)).size).toBe(12)
        for (const { glyph, label } of colours) expect(glyph).not.toBe(label)
      }
    })
  }
})

// Cell pattern 15's variant: a pressed icon inside another value's cell.
test.describe('pressed icon in a cell', () => {
  const STORY = 'patterns-cellpatterns--pressed-icon-in-a-cell'

  test('is aria-pressed, named for its row, and only there while the value allows it', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    const on = page.getByRole('button', { name: 'Focus: Desk lamp' })
    const off = page.getByRole('button', { name: 'Focus: Bookshelf' })
    await expect(on).toHaveAttribute('aria-pressed', 'true')
    await expect(off).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: 'Focus: Office chair' })).toHaveCount(0)
    // Pressed is toned and filled; not pressed is neither.
    const fill = (button: typeof on) => button.locator('svg').evaluate((svg) => getComputedStyle(svg).fill)
    expect(await fill(on)).not.toBe('none')
    expect(await fill(off)).toBe('none')
    // Hovered, pressed keeps its tone (the primitive's hover is foreground).
    const colour = (button: typeof on) => button.evaluate((element) => getComputedStyle(element).color)
    const toned = await colour(on)
    await on.hover()
    expect(await colour(on)).toBe(toned)
  })

  test('flips from the keyboard, with "Saving" beside it', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    const off = page.getByRole('button', { name: 'Focus: Bookshelf' })
    await off.focus()
    await page.keyboard.press('Space')
    await expect(off).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('status', { name: 'Saving' })).toBeVisible()
    await expect(page.getByRole('status', { name: 'Saving' })).toHaveCount(0)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`pressed and not, focused and hovered, have zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(storyUrlById(STORY, theme))
      await page.getByRole('button', { name: 'Focus: Bookshelf' }).hover()
      await page.getByRole('button', { name: 'Focus: Desk lamp' }).focus()
      const results = await analyzeStory(page)
      expect(results.violations).toEqual([])
    })
  }
})

// Cell pattern 4 for a multi value: the icons side by side, every name in
// one tooltip on the whole group.
test.describe('icons with one tooltip', () => {
  const STORY = 'patterns-cellpatterns--icons-with-one-tooltip'

  test('the group is one focusable image named by every value, "…" while one loads', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    await expect(page.getByRole('img', { name: 'Home, Finance', exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Repairs, …', exact: true })).toBeVisible()
    await expect(page.getByRole('row', { name: /Standing mat/ })).toContainText('—')
    // Read-only: no button in the cell.
    await expect(page.getByRole('table').getByRole('button')).toHaveCount(0)
  })

  // With several tooltips on a page, one that's closing stays in the DOM
  // for a moment: the open one is the one with [data-open].
  test('focus opens the tooltip; the open one is read by [data-open]', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    const open = page.locator('[data-slot=tooltip-content][data-open]')
    await page.getByRole('img', { name: 'Home, Finance', exact: true }).focus()
    await expect(open).toHaveText('Home, Finance')
    await page.keyboard.press('Tab')
    await expect(open).toHaveText('Repairs, Home, Finance')
    await expect(open).toHaveCount(1)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`with the tooltip open, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(storyUrlById(STORY, theme))
      await page.getByRole('img', { name: 'Home, Finance', exact: true }).focus()
      await expect(page.locator('[data-slot=tooltip-content][data-open]')).toBeVisible()
      const results = await analyzeStory(page)
      expect(results.violations).toEqual([])
    })
  }
})

// Cell pattern 10 for a dependency list: a summary in the cell, every
// related record in a popover, grouped by kind.
test.describe('dependency list', () => {
  const STORY = 'patterns-cellpatterns--dependency-list'

  test('opens on a tap, grouped by kind, held with its reason; nothing linked is plain text', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    await page.getByRole('button', { name: /^2 holds/ }).click()
    const popup = page.getByRole('dialog')
    await expect(popup.getByRole('region', { name: 'Parts' })).toContainText('Bulb: unavailable')
    await expect(popup.getByRole('region', { name: 'Dates' })).toContainText("Delivery day: hasn't happened")
    await expect(popup.getByRole('region', { name: 'Links' })).toContainText('Bookshelf: clear')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('row', { name: /Office chair/ })).toContainText('Ready')
    await expect(page.getByRole('row', { name: /Office chair/ }).getByRole('button')).toHaveCount(0)
  })

  test('opens on hover too', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    await page.getByRole('button', { name: /^Ready/ }).hover()
    await expect(page.getByRole('dialog')).toContainText('Screws')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`with the popover open, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(storyUrlById(STORY, theme))
      await page.getByRole('button', { name: /^2 holds/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      const results = await analyzeStory(page)
      expect(results.violations).toEqual([])
    })
  }
})

// <CountLink>, cell pattern 20: a count linking to the other table,
// filtered to this row.
test.describe('count link', () => {
  const STORY = 'app-countlink--default'

  test('each count is a link named for its row, to the filtered list; zero is plain text', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    const three = page.getByRole('link', { name: '3 open tasks in Kitchen remodel', exact: true })
    await expect(three).toHaveText('3')
    await expect(three).toHaveAttribute('href', '/tasks?project=1')
    // Singular for one.
    await expect(page.getByRole('link', { name: '1 open task in Garden', exact: true })).toHaveText('1')
    // Found by what it shows, as speech input would.
    await expect(page.getByRole('link', { name: /^12 / })).toHaveAttribute('href', '/tasks?project=4')
    // Zero is a value, not a link.
    await expect(page.getByRole('row', { name: /Taxes/ })).toContainText('0')
    await expect(page.getByRole('row', { name: /Taxes/ }).getByRole('link')).toHaveCount(0)
    await expect(page.getByRole('link')).toHaveCount(3)
    // Underlined at rest, not only on hover.
    const line = await three.evaluate((element) => getComputedStyle(element).textDecorationLine)
    expect(line).toContain('underline')
  })

  test('reachable from the keyboard, in row order', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    await page.getByRole('link', { name: '3 open tasks in Kitchen remodel' }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: '1 open task in Garden' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: '12 open tasks in Move house' })).toBeFocused()
  })

  test('Enter goes to the list filtered to that row', async ({ page }) => {
    await page.goto(storyUrlById(STORY, 'light'))
    await page.getByRole('link', { name: '1 open task in Garden' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
    await expect(page.getByText('Filtered to Garden.')).toBeVisible()
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`focused and hovered, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(storyUrlById(STORY, theme))
      await page.getByRole('link', { name: /^1 open task/ }).hover()
      await page.getByRole('link', { name: /^3 open tasks/ }).focus()
      const results = await analyzeStory(page)
      expect(results.violations).toEqual([])
    })
  }
})

// WidgetCard (a hub page's widget): what its names and states promise.
test.describe('widget card', () => {
  const ALL = 'app-widgetcard--all-states'
  const inState = (page: import('@playwright/test').Page, state: string) =>
    page.getByRole('region', { name: `State: ${state}` })

  test('each widget is a region named by its heading, in the page outline', async ({ page }) => {
    await page.goto(storyUrlById('app-widgetcard--default', 'light'))
    for (const title of ['Ready to start', 'Waiting on', 'Saved links']) {
      await expect(page.getByRole('region', { name: title })).toBeVisible()
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
    }
  })

  test('a header link is described by its title, so two "All" links stay distinct', async ({ page }) => {
    await page.goto(storyUrlById('app-widgetcard--default', 'light'))
    const ready = page.getByRole('region', { name: 'Ready to start' }).getByRole('link', { name: 'All', exact: true })
    await expect(ready).toHaveAccessibleDescription('Ready to start')
    const waiting = page.getByRole('region', { name: 'Waiting on' }).getByRole('link', { name: 'All', exact: true })
    await expect(waiting).toHaveAccessibleDescription('Waiting on')
  })

  test("a row's switch is named by the row's text", async ({ page }) => {
    await page.goto(storyUrlById('app-widgetcard--default', 'light'))
    await expect(page.getByRole('switch', { name: 'Parts arrive' })).not.toBeChecked()
    await expect(page.getByRole('switch', { name: 'Weather clears' })).toBeChecked()
  })

  test('a long row is cut to one line, with its whole text in the link and its tooltip', async ({ page }) => {
    await page.goto(storyUrlById('app-widgetcard--default', 'light'))
    const text = 'Choosing an exterior paint for a timber shed that sees a lot of weather'
    const link = page.getByRole('link', { name: `${text} (opens in a new tab)` })
    await expect(link).toHaveAttribute('title', text)
    await expect(link).toHaveAttribute('target', '_blank')
    const cut = await link.locator('span').first().evaluate((span) => span.scrollWidth > span.clientWidth)
    expect(cut).toBe(true)
  })

  test('every state is in each widget: skeleton, empty line, compact error with retry, rows', async ({ page }) => {
    await page.goto(storyUrlById(ALL, 'light'))
    await expect(inState(page, 'loading').locator('[data-slot=widget-card][data-state=loading]')).toHaveCount(3)
    await expect(inState(page, 'empty').getByText('Nothing waiting')).toBeVisible()
    const errors = inState(page, 'error')
    await expect(errors.getByText('Connection problem')).toHaveCount(3)
    await expect(errors.getByRole('button', { name: 'Try again' })).toHaveCount(3)
    await expect(errors.locator('[data-state=error][data-size=compact]')).toHaveCount(3)
    await expect(inState(page, 'success').getByRole('listitem')).toHaveCount(8)
  })

  // The skeleton holds as many rows as the widget usually does, so a card
  // keeps its height when its data arrives.
  test("a loading widget is its loaded height, within a few pixels", async ({ page }) => {
    await page.goto(storyUrlById(ALL, 'light'))
    for (const title of ['Ready to start', 'Waiting on', 'Saved links']) {
      const height = async (state: string) =>
        (await page.getByRole('region', { name: `${title} (${state})` }).boundingBox())!.height
      expect(Math.abs((await height('loading')) - (await height('success')))).toBeLessThanOrEqual(4)
    }
  })
})
