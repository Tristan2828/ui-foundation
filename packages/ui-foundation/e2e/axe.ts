import PlainAxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { waitForTransitions } from '../src/testing/transitions'

// The package's specs build axe themselves (their own rules, include and
// exclude), so they take this in place of @axe-core/playwright's builder:
// the same builder, whose analyze() first waits out the page's open and
// close transitions, as the /testing entry point's expectNoAxeViolations
// does. A menu, tooltip or hover tint measured mid-fade blends its text
// with what's behind it and fails contrast on correct colours.
export default class AxeBuilder extends PlainAxeBuilder {
  readonly #page: Page

  constructor(options: { page: Page }) {
    super(options)
    this.#page = options.page
  }

  override async analyze(): ReturnType<PlainAxeBuilder['analyze']> {
    await waitForTransitions(this.#page)
    return super.analyze()
  }
}
