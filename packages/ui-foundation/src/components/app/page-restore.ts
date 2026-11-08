// A removed page's Restore, shared by <Markdown>'s button (page-link.tsx)
// and the editor's (rich-text-page-links.ts): the app's `onRestore`, its
// refusal toasted in the gateway's words (messageOf).
import { toast } from 'sonner'
import type { PageLinkInfo } from '@/lib/page-link'
import { messageOf } from './edit-in-place-store'

/** Runs the app's restore, toasting a refusal. Resolves either way. */
export async function restorePage(info: PageLinkInfo, name: string): Promise<void> {
  try {
    await info.onRestore?.()
  } catch (error) {
    toast.error(`Couldn't restore ${name}: ${messageOf(error)}`)
  }
}
