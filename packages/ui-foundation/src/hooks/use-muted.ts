import { createFlagStore, useRememberedFlag, type FlagStore } from './use-remembered-flag'

// A mute toggle for a screen's sound cues, remembered on this device
// (localStorage under the app's own key): a remembered flag
// (use-remembered-flag.ts) that starts unmuted. Where storage is blocked
// it still works for the page's life, and a change in another tab of the
// same app shows here too.

export type MutedStore = FlagStore

/** The store under useMuted, for its unit tests (tests/use-muted.test.ts). */
export const createMutedStore = createFlagStore

/**
 * `[muted, setMuted]`, remembered on this device under `key` (name it for
 * the app and screen: `"my-app:timer:muted"`). Unmuted until set.
 */
export function useMuted(key: string): readonly [boolean, (muted: boolean) => void] {
  return useRememberedFlag(key, false)
}
