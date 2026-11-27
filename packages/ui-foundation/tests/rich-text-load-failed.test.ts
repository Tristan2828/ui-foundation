// A preload whose load fails (a chunk gone after a deploy, the network
// down) leaves no unhandled rejection: the page that called it carries
// on, and the editor reports the failure when one mounts. The editor's
// module is mocked to throw as it loads.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRichTextEditor, preloadRichTextEditor } from '../src/components/app/rich-text-load'

vi.mock('../src/components/app/milkdown-editor', () => {
  throw new Error('The editor failed to load.')
})

describe('preloadRichTextEditor, when the load fails', () => {
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  beforeEach(() => {
    unhandled.length = 0
    process.on('unhandledRejection', onUnhandled)
  })
  afterEach(() => {
    process.off('unhandledRejection', onUnhandled)
  })

  it('the load itself rejects, for the editor to report', async () => {
    await expect(loadRichTextEditor()).rejects.toThrow()
  })

  it('a preload returns nothing, throws nothing and leaves no unhandled rejection', async () => {
    expect(preloadRichTextEditor()).toBeUndefined()
    // Long enough for a rejection nobody caught to be reported.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(unhandled).toEqual([])
  })
})
