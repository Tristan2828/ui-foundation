// Error reporting in the browser (src/error-reporting/reporter.ts, issue
// #126): each source reports once with reporting on and never with it off,
// expected AppError kinds are never reported, and a report carries no
// query string.
import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppError } from '../src/api/contracts'
import type { ClientErrorReport } from '../src/api/gateway/client-errors'
import { toAppError } from '../src/api/gateway/errors'
import {
  createErrorReporter,
  resolveErrorReporting,
  routePattern,
  scrub,
  type ErrorReporter,
} from '../src/error-reporting/reporter'

let uninstall: (() => void) | undefined
afterEach(() => uninstall?.())

function setUp({ signedIn = true, now = (): number => 0 }: { signedIn?: boolean; now?: () => number } = {}) {
  const sent: ClientErrorReport[] = []
  const reporter = createErrorReporter({ options: { release: 'abc1234' }, send: (report) => sent.push(report), now })
  reporter.setSignedIn(signedIn)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const target = new EventTarget()
  uninstall = reporter.install(queryClient, target)
  return { sent, reporter, queryClient, target }
}

function windowError(target: EventTarget, error: unknown) {
  target.dispatchEvent(Object.assign(new Event('error'), { error, message: String(error) }))
}

function rejection(target: EventTarget, reason: unknown) {
  target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }))
}

async function failQuery(queryClient: QueryClient, error: AppError, key = 'widgets') {
  await queryClient.fetchQuery({ queryKey: [key, error], queryFn: () => Promise.reject(error) }).catch(() => {})
}

async function failMutation(queryClient: QueryClient, error: AppError) {
  await queryClient
    .getMutationCache()
    .build(queryClient, { mutationFn: () => Promise.reject(error) })
    .execute(undefined)
    .catch(() => {})
}

describe('resolveErrorReporting', () => {
  it('is off unless the app turns it on', () => {
    expect(resolveErrorReporting(undefined)).toBeNull()
    expect(resolveErrorReporting(false)).toBeNull()
    expect(resolveErrorReporting(true)).toEqual({})
    expect(resolveErrorReporting({ release: 'x' })).toEqual({ release: 'x' })
  })
})

describe('the sources', () => {
  it('reports an uncaught error once, with its stack and the release', () => {
    const { sent, target, reporter } = setUp()
    reporter.setRoute('/widgets/:id')
    const error = new TypeError('Cannot read properties of undefined')
    windowError(target, error)
    windowError(target, error)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      source: 'window',
      type: 'TypeError',
      message: 'Cannot read properties of undefined',
      route: '/widgets/:id',
      release: 'abc1234',
    })
    expect(sent[0].stack).toContain('TypeError')
  })

  it('reports an unhandled rejection once, but never one that is an AppError', () => {
    const { sent, target } = setUp()
    rejection(target, toAppError(500, { detail: 'Database is down' }))
    rejection(target, toAppError(422, { detail: [] }))
    expect(sent).toEqual([])
    rejection(target, new Error('lost promise'))
    rejection(target, new Error('lost promise'))
    expect(sent.map((report) => [report.source, report.message])).toEqual([['unhandledrejection', 'lost promise']])
  })

  it('reports a server failure of a query once, with its method and status', async () => {
    const { sent, queryClient } = setUp()
    await failQuery(queryClient, toAppError(503, { detail: 'Database is down' }))
    await failQuery(queryClient, toAppError(503, { detail: 'Database is down' }), 'again')
    expect(sent).toEqual([
      { source: 'query', type: 'ServerError', message: 'Database is down', method: 'GET', status: 503, release: 'abc1234' },
    ])
  })

  it('reports a server failure of a mutation', async () => {
    const { sent, queryClient } = setUp()
    await failMutation(queryClient, toAppError(500, { detail: 'Internal server error' }))
    expect(sent).toMatchObject([{ source: 'mutation', type: 'ServerError', status: 500 }])
  })

  it('never reports auth, notfound, validation, rate_limited or network failures', async () => {
    const { sent, queryClient } = setUp()
    const expected: AppError[] = [
      toAppError(401, { detail: 'Not authenticated' }),
      toAppError(404, { detail: 'Not found' }),
      toAppError(422, { detail: [{ loc: ['body', 'name'], msg: 'required', type: 'missing' }] }),
      toAppError(429, { detail: 'Slow down' }),
      { kind: 'network', message: 'Network error' },
    ]
    for (const [n, error] of expected.entries()) {
      await failQuery(queryClient, error, `q${n}`)
      await failMutation(queryClient, error)
    }
    expect(sent).toEqual([])
  })

  it('sends nothing while signed out', async () => {
    const { sent, target, queryClient } = setUp({ signedIn: false })
    windowError(target, new Error('boom'))
    await failQuery(queryClient, toAppError(500, { detail: 'x' }))
    expect(sent).toEqual([])
  })

  it('the same error goes again after a minute', () => {
    let clock = 0
    const { sent, target } = setUp({ now: () => clock })
    windowError(target, new Error('boom'))
    clock = 59_000
    windowError(target, new Error('boom'))
    clock = 60_000
    windowError(target, new Error('boom'))
    expect(sent).toHaveLength(2)
  })

  it('stops listening once uninstalled', () => {
    const { sent, target } = setUp()
    uninstall?.()
    uninstall = undefined
    windowError(target, new Error('boom'))
    expect(sent).toEqual([])
  })

  it('reports a route crash through report()', () => {
    const { sent, reporter } = setUp()
    ;(reporter as ErrorReporter).report('route', new RangeError('Invalid time value'))
    expect(sent).toMatchObject([{ source: 'route', type: 'RangeError', message: 'Invalid time value' }])
  })
})

describe('what a report never holds', () => {
  it('cuts query strings and fragments from the message and the stack, keeping line numbers', () => {
    const { sent, target } = setUp()
    const error = new Error('Failed to load https://app.example.com/widgets?search=alice#row-3')
    error.stack = 'Error: x\n    at load (https://app.example.com/assets/index.js?v=secret:12:34)'
    windowError(target, error)
    expect(sent[0].message).toBe('Failed to load https://app.example.com/widgets')
    expect(sent[0].stack).toBe('Error: x\n    at load (https://app.example.com/assets/index.js:12:34)')
    expect(JSON.stringify(sent)).not.toMatch(/alice|secret|row-3/)
  })

  it('caps the length', () => {
    expect(scrub('x'.repeat(3000), 2000)).toHaveLength(2000)
  })
})

describe('routePattern', () => {
  it('puts the route params back as names', () => {
    expect(routePattern('/widgets/7/edit', { id: '7' })).toBe('/widgets/:id/edit')
    expect(routePattern('/people/alice%20b', { slug: 'alice b' })).toBe('/people/:slug')
    expect(routePattern('/files/a/b/c', { '*': 'a/b/c' })).toBe('/files/*')
    expect(routePattern('/widgets', {})).toBe('/widgets')
  })
})
