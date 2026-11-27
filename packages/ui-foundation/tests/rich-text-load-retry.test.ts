// A load that fails once (a chunk missing for a moment after a deploy, the
// network down) is tried again by the next editor, not kept for the
// session. The editor's module is mocked to throw the first time only.
import { describe, expect, it, vi } from 'vitest'
import { loadedRichTextEditor, loadRichTextEditor } from '../src/components/app/rich-text-load'

const attempts = vi.hoisted(() => ({ count: 0 }))

vi.mock('../src/components/app/milkdown-editor', () => {
  attempts.count += 1
  if (attempts.count === 1) throw new Error('The editor failed to load.')
  return { default: () => null }
})

describe('loadRichTextEditor, after a failed load', () => {
  it('the failure is not kept: the next call loads it', async () => {
    await expect(loadRichTextEditor()).rejects.toThrow()
    expect(loadedRichTextEditor()).toBeNull()
    const module = await loadRichTextEditor()
    expect(typeof module.default).toBe('function')
    expect(loadedRichTextEditor()).toBe(module)
    expect(attempts.count).toBe(2)
  })
})
