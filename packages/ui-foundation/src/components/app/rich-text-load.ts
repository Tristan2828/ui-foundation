// The editor's own code (Milkdown), loaded apart from the page that shows
// it: RichTextEditor asks for it when it first mounts, and an app that
// opens on an editor asks ahead with `preloadRichTextEditor()`.
//
// Once loaded, the module is kept: an editor mounted after that is drawn
// at once, with no loading view. A load that fails is forgotten, so the
// next editor to mount asks again (a chunk that failed once, the network
// down for a moment, needn't fail every editor until a reload).

type EditorModule = typeof import('./milkdown-editor')

let loaded: EditorModule | null = null
let loading: Promise<EditorModule> | null = null

/** The editor's module, fetched once: later calls get the same one. A failed load is tried again by the next call. */
export function loadRichTextEditor(): Promise<EditorModule> {
  if (loaded) return Promise.resolve(loaded)
  loading ??= import('./milkdown-editor').then(
    (module) => (loaded = module),
    (error: unknown) => {
      loading = null
      throw error
    },
  )
  return loading
}

/** The editor's module if it has loaded, else `null`. */
export function loadedRichTextEditor(): EditorModule | null {
  return loaded
}

/**
 * Starts loading the editor now, before one is on screen: an app whose
 * first screen is an editor (a notes app that opens on a note) calls it as
 * the app starts, so the editor is there when the note is, not a moment
 * after it. Safe to call more than once, and anywhere: it never throws,
 * and a failed load is swallowed here, so the page goes on; the next
 * editor to mount tries again.
 */
export function preloadRichTextEditor(): void {
  void loadRichTextEditor().catch(() => {})
}
