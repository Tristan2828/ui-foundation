// The wake lock's rules (src/hooks/use-wake-lock.ts) against a fake
// browser whose answers the test releases one at a time: asked again when
// the tab comes back, let go on deactivate, including a request the
// browser hasn't answered yet, and nothing at all where there's no API.
import { describe, expect, it } from 'vitest'
import { createWakeLock } from '../src/hooks/use-wake-lock'

class FakeSentinel extends EventTarget {
  released = false
  release() {
    if (!this.released) {
      this.released = true
      this.dispatchEvent(new Event('release'))
    }
    return Promise.resolve()
  }
}

function fakeBrowser() {
  const doc = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState }
  doc.visibilityState = 'visible'
  const pending: { grant: () => FakeSentinel; refuse: () => void }[] = []
  const granted: FakeSentinel[] = []
  const wakeLock = {
    request: () =>
      new Promise<WakeLockSentinel>((resolve, reject) => {
        pending.push({
          grant: () => {
            const lock = new FakeSentinel()
            granted.push(lock)
            resolve(lock as unknown as WakeLockSentinel)
            return lock
          },
          refuse: () => reject(new DOMException('Not allowed', 'NotAllowedError')),
        })
      }),
  }
  const setVisibility = (state: DocumentVisibilityState) => {
    doc.visibilityState = state
    doc.dispatchEvent(new Event('visibilitychange'))
  }
  // Lets the promise callbacks run.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  return { doc, wakeLock, pending, granted, setVisibility, settle }
}

describe('createWakeLock', () => {
  it('asks for the screen lock on activate, once', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock({ wakeLock: browser.wakeLock, document: browser.doc })
    lock.activate()
    lock.activate()
    expect(browser.pending).toHaveLength(1)
    browser.pending[0].grant()
    await browser.settle()
    expect(browser.granted[0].released).toBe(false)
  })

  it('asks again when the tab comes back after the browser dropped it', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock({ wakeLock: browser.wakeLock, document: browser.doc })
    lock.activate()
    browser.pending[0].grant()
    await browser.settle()

    // Hiding the tab: the browser releases the lock itself.
    browser.setVisibility('hidden')
    await browser.granted[0].release()
    expect(browser.pending).toHaveLength(1)

    browser.setVisibility('visible')
    expect(browser.pending).toHaveLength(2)
    browser.pending[1].grant()
    await browser.settle()
    expect(browser.granted[1].released).toBe(false)
  })

  it("doesn't ask twice when the tab returns while a lock is still held", async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock({ wakeLock: browser.wakeLock, document: browser.doc })
    lock.activate()
    browser.pending[0].grant()
    await browser.settle()
    browser.setVisibility('visible')
    expect(browser.pending).toHaveLength(1)
  })

  it('waits for the tab to be visible before asking', () => {
    const browser = fakeBrowser()
    browser.doc.visibilityState = 'hidden'
    const lock = createWakeLock({ wakeLock: browser.wakeLock, document: browser.doc })
    lock.activate()
    expect(browser.pending).toHaveLength(0)
    browser.setVisibility('visible')
    expect(browser.pending).toHaveLength(1)
  })

  it('releases the lock on deactivate, and stops asking', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock({ wakeLock: browser.wakeLock, document: browser.doc })
    lock.activate()
    browser.pending[0].grant()
    await browser.settle()
    lock.deactivate()
    expect(browser.granted[0].released).toBe(true)

    browser.setVisibility('hidden')
    browser.setVisibility('visible')
    expect(browser.pending).toHaveLength(1)
  })

  it('releases a lock granted after deactivate (a request still in flight)', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock({ wakeLock: browser.wakeLock, document: browser.doc })
    lock.activate()
    lock.deactivate()
    const late = browser.pending[0].grant()
    await browser.settle()
    expect(late.released).toBe(true)
  })

  it('keeps a lock granted after a deactivate and a new activate', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock({ wakeLock: browser.wakeLock, document: browser.doc })
    lock.activate()
    lock.deactivate()
    lock.activate()
    // The first request is still out, so the second activate doesn't add one.
    expect(browser.pending).toHaveLength(1)
    const held = browser.pending[0].grant()
    await browser.settle()
    expect(held.released).toBe(false)
  })

  it('a refusal changes nothing, and the next visible tab asks again', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock({ wakeLock: browser.wakeLock, document: browser.doc })
    lock.activate()
    browser.pending[0].refuse()
    await browser.settle()
    browser.setVisibility('hidden')
    browser.setVisibility('visible')
    expect(browser.pending).toHaveLength(2)
  })

  it('does nothing where the browser has no wake lock', () => {
    const browser = fakeBrowser()
    const lock = createWakeLock({ wakeLock: undefined, document: browser.doc })
    expect(() => {
      lock.activate()
      browser.setVisibility('visible')
      lock.deactivate()
    }).not.toThrow()
  })
})
