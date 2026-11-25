// Where <Emoji> finds an emoji's picture: the `emoji()` Vite plugin serves
// the package's emoji/ folder there, each file named as Noto names it.

/** Where the `emoji()` plugin serves the pictures. The version makes the immutable cache safe. */
export const EMOJI_ASSET_PATH = '/assets/emoji-18.0/'

/**
 * The picture's file name for an emoji, without `.svg`: its code points in
 * lower-case hex, each at least four digits, joined by `_`, with U+FE0F
 * left out (Noto's own rule). `🏳️‍🌈` → `1f3f3_200d_1f308`.
 */
export function emojiImageName(emoji: string): string {
  return [...emoji]
    .map((ch) => ch.codePointAt(0) ?? 0)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16).padStart(4, '0'))
    .join('_')
}
