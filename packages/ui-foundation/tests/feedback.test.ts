// The dialogs and feedback standard's logic (4.90): the connection store
// OfflineNotice reads, fed by safeFetch (D9), and the words a toast and a
// delete use (D1, D6). The components themselves run in the browser
// (e2e/feedback.spec.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeFetch } from '../src/api/gateway/errors'
import { isOffline, reportAnswered, reportUnreachable } from '../src/lib/connection'
import { doneMessage, pastTense } from '../src/components/app/notify'

afterEach(() => {
  vi.unstubAllGlobals()
  reportAnswered()
})

describe('the connection store', () => {
  it('is offline after a request gets no answer, and online again once one does', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    await expect(safeFetch('/widgets')).rejects.toMatchObject({ kind: 'network' })
    expect(isOffline()).toBe(true)

    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify({ detail: 'boom' }), { status: 500 })))
    await safeFetch('/widgets')
    // Any answer, a 500 included: the server is there.
    expect(isOffline()).toBe(false)
  })

  it('says nothing either way for a request cancelled on purpose', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new DOMException('The operation was aborted.', 'AbortError')))
    await expect(safeFetch('/widgets')).rejects.toMatchObject({ kind: 'network' })
    expect(isOffline()).toBe(false)

    reportUnreachable()
    await expect(safeFetch('/widgets')).rejects.toMatchObject({ kind: 'network' })
    expect(isOffline()).toBe(true)
  })
})

describe('the words', () => {
  it('a toast says the verb first, then the name', () => {
    expect(doneMessage('Deleted', 'The Long Walk')).toBe('Deleted The Long Walk')
    expect(doneMessage('Restored', 'The Long Walk')).toBe('Restored The Long Walk')
  })

  it('a delete action puts its verb in the past tense', () => {
    expect(pastTense('Delete')).toBe('Deleted')
    expect(pastTense('Retire')).toBe('Retired')
    expect(pastTense('Archive')).toBe('Archived')
    expect(pastTense('Remove')).toBe('Removed')
    expect(pastTense('Detach')).toBe('Detached')
  })
})
