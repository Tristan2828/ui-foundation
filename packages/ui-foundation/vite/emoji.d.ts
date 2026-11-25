// The helpers behind emoji(), typed for the package's own tests. Apps use
// `emoji` from `@tristan2828/ui-foundation/vite` (./index.d.ts).
import type { Plugin } from 'vite'
import type { EmojiOptions } from './index'

export const EMOJI_DIR: string
export const EMOJI_ASSET_DIR: string
export function emojiFiles(dir?: string): string[]
export function emoji(options?: EmojiOptions): Plugin
