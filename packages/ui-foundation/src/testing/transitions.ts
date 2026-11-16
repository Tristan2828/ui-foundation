import type { Page } from '@playwright/test'

/**
 * Resolves once the page's open and close transitions have finished. A
 * popup fading in is already "visible" to Playwright, and its text is
 * blended with the page behind: axe measured a sheet's muted labels at
 * 4.37:1 mid-fade, 4.74:1 once shown, and failed CI on correct colours.
 * Two frames first, so a transition that starts on the next frame (Base
 * UI drops `data-starting-style` there) is running by the time it's read.
 * Endless animations (a spinner, a skeleton's pulse) are left out.
 */
export async function waitForTransitions(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const ending = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
    await Promise.all(ending.map((animation) => animation.finished.catch(() => undefined)))
  })
}
