// ErrorState's buttons by kind: a lapsed sign-in at a proxy in front of the
// app (kind proxy_auth) offers Sign In Again and never a retry, whether or
// not the screen passed onRetry; every other kind is as it was. Pressing it
// and axe in both themes are e2e/error-state.spec.ts and
// e2e/fixtures-visual.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AppError } from '../src/api/contracts'
import { ErrorState } from '../src/components/app/error-state'

const LAPSED: AppError = { kind: 'proxy_auth', message: 'Your sign-in has expired. Reload the page to sign in again.' }

describe('ErrorState', () => {
  it('a lapsed proxy sign-in: its title and message, Sign In Again, no retry', () => {
    const html = renderToStaticMarkup(<ErrorState error={LAPSED} onRetry={() => {}} />)
    expect(html).toContain('Sign-in expired')
    expect(html).toContain(LAPSED.message)
    expect(html).toContain('Sign In Again')
    expect(html).not.toContain('Try Again')
  })

  it('offers Sign In Again with no onRetry too, and in the compact size', () => {
    const html = renderToStaticMarkup(<ErrorState error={LAPSED} size="compact" />)
    expect(html).toContain('data-size="compact"')
    expect(html).toContain('Sign In Again')
  })

  it.each(['network', 'server', 'notfound', 'auth', 'rate_limited', 'validation'] as const)(
    'kind %s keeps Try Again (with onRetry) and never offers Sign In Again',
    (kind) => {
      const html = renderToStaticMarkup(<ErrorState error={{ kind, message: 'x' }} onRetry={() => {}} />)
      expect(html).toContain('Try Again')
      expect(html).not.toContain('Sign In Again')
    },
  )
})
