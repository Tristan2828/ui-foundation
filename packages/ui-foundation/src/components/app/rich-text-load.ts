// The editor's own code (Milkdown), loaded apart from the page that shows
// it: RichTextEditor asks for it when it first mounts, and an app that
// opens on an editor asks ahead with `preloadRichTextEditor()`.

/** The editor's module, fetched once: later calls get the same one. */
export const loadRichTextEditor = () => import('./milkdown-editor')

/**
 * Starts loading the editor now, before one is on screen: an app whose
 * first screen is an editor (a notes app that opens on a note) calls it as
 * the app starts, so the editor is there when the note is, not a moment
 * after it. Safe to call more than once, and anywhere: it never throws,
 * and a failed load is swallowed here, so the page goes on; the editor
 * meets the same failure when one mounts, as it would with no preload.
 */
export function preloadRichTextEditor(): void {
  void loadRichTextEditor().catch(() => {})
}
