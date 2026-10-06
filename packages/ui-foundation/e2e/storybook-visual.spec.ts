import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Every primitive the package ships with a story. Apps import these from
// the package rather than installing shadcn's own, so the package answers
// for their accessibility and their colours. Accessibility of whole
// screens — including dark-mode contrast — is the template's
// e2e/a11y.spec.ts. Story ids are `title`+export slugs.
const STORYBOOK_URL = 'http://localhost:6006'
const PRIMITIVES = [
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
const COMPOSITE_STORIES = [
  { id: 'app-markdown--default', mustShow: 'Measure twice, cut once.' },
  { id: 'app-richtexteditor--default', mustShow: 'Measure twice, cut once.' },
]

function storyUrlById(id: string, theme: 'light' | 'dark') {
  return `${STORYBOOK_URL}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`
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
  }
})

// The type-* roles are @utility rules over --type-* tokens. A typo in
// either is silent: the class just sets nothing. Each role's computed font
// size must equal its token, so an unbuilt or misnamed role fails here.
test('typography roles resolve to their tokens', async ({ page }) => {
  await page.goto(storyUrlById('ui-typography--default', 'light'))
  const roles = ['page-title', 'section-title', 'body', 'label', 'caption']
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
})
