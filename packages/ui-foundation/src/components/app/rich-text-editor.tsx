// Long text written as Markdown, edited as formatted text where it's read
// (Notion-style), not as Markdown syntax in a textarea. The control for a
// `long text` field marked Markdown, on the form and in place on the view.
//
// It stays Markdown: it opens from Markdown and reports Markdown. Opening
// and saving round-trip exactly: an untouched document comes back byte for
// byte, and an edited one keeps every block the person didn't change as it
// was written (src/lib/markdown-merge.ts). If an edit can't be saved
// without rewriting another block, `onChange` isn't called (the draft
// stays on screen, nothing is saved in its place), the editor marks itself
// invalid, and `onProblem` says why; with no `onProblem`, the editor says
// it itself, inside the field. A form gives `onProblem` and holds its
// submit on it (add-an-entity.md "Forms"), or Save would send the last
// text that could be saved and say it worked.
//
// Raw HTML in the text shows as its characters, as <Markdown> shows it,
// and nothing pasted or typed can add markup.
//
// Headings, tables, page links, `foldKey` and `tableLook` follow
// <Markdown>'s (`headingLevel`, from <h3> by default; a table wider than
// the field scrolls in a tab stop the arrow keys scroll). Grips on a
// table's column and row (or a right-click, or Shift+F10, in a cell) open
// menus to insert, move, delete, align, sort and colour. A toggle heading
// is `## Safety {toggle="true"}` in the Markdown: typed as `>## `, picked
// from the slash menu or made with the toolbar's Toggle heading.
//
// Images in the text (`![alt](url)`) show, at most the field's width. With
// `upload`, an image pasted, dropped or picked with an Image button is
// uploaded through the app's own storage and goes in as `![](url)`; while
// it uploads, a placeholder shows where it will go.
//
// With `onCreatePage`, "/page" (or Turn into page on selected words) asks
// for a title, has the app make the page, and puts in `[title](href)`.
// Pages may nest to any depth: a page's own note takes the same props.
// The Markdown stays plain links.
//
// `defaultValue` is read when it mounts, then followed: a new value the
// editor didn't report itself (a form's loaded record arriving after the
// editor, a reset) replaces the text, as if it opened with it. Its own
// edits, coming back as the value, change nothing, so the caret stays
// where it is. A caller that never feeds `onChange` back keeps its text.
//
// The editor (Milkdown) is loaded on first use, so a page that only reads
// Markdown never downloads it. Until it arrives the text shows as
// <Markdown> draws it, the field's size, so nothing moves when the editor
// takes its place; an empty one shows skeleton lines. An app that opens on
// an editor loads it ahead with `preloadRichTextEditor()`. Once loaded it's
// drawn at once; a load that failed is tried again by the next editor. Keys
// typed into an `autoFocus` editor while it loads are held and typed in
// once it's up (rich-text-held-keys.ts), and saved; so are keys typed
// before it mounted, after `holdKeysForNextEditor()` (a New Note press, an
// app's start; rich-text-hold-keys.ts).
//
// What Markdown can't hold isn't saved: spaces at a line's start or end
// (rich-text-empty-paragraph.ts; inline code keeps its own) and blank lines
// typed for spacing.
import { lazy, Suspense, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'
import type { ImageUpload } from '@/lib/image-file'
import type { CreatePage, PageLinkResolver } from '@/lib/page-link'
import { Markdown } from './markdown'
import type { MilkdownEditorProps } from './milkdown-editor'
import type { HeadingFrom, HeadingLevel, TableLook } from './prose-look'
import type { HeldKeys } from './rich-text-held-keys'
import { claimKeyHold, keyHoldWaiting, type ClaimedHold } from './rich-text-hold-keys'
import { loadedRichTextEditor, loadRichTextEditor } from './rich-text-load'

export type RichTextEditorProps = {
  /** The editable element's id, for a label's `htmlFor` or a test. */
  id?: string
  /**
   * The Markdown it opens with. A later value the editor didn't report
   * (a record loaded after it mounted, a reset) replaces the text; the
   * value it reported, passed back, changes nothing.
   */
  defaultValue: string
  /**
   * The Markdown to save, untouched blocks as originally written. Called a
   * short pause after typing stops (300 ms), not on every
   * key: turning a long note back into Markdown costs time in proportion
   * to its length. Always called first, synchronously, when the
   * text loses focus, on Esc and Ctrl/Cmd+Enter, when the page is hidden,
   * when it unmounts, and when anything calls `flushPendingEdits()`
   * (EntityForm's submit, the edit-in-place store's saves, the leave
   * guards), so a save never reads a value from before the last key.
   */
  onChange: (markdown: string) => void
  /**
   * Why the edit can't be saved as it stands, or `null` once it can. A form
   * sets it as the field's error and refuses submit while it stands. Left
   * out, the editor shows the message inside the field instead.
   */
  onProblem?: (message: string | null) => void
  /** Shown but not editable (while a save is in flight). */
  readOnly?: boolean
  /**
   * Takes focus as it mounts. `true`: the caret at the text's start;
   * `'end'`: after its last words (past a divider or an image that ends
   * it, and in a folded last section, at the end of its heading, which
   * stays folded), scrolled into view. Neither saves anything. Keys typed
   * while the editor's code is still loading are kept and typed in once
   * it's up.
   */
  autoFocus?: boolean | 'end'
  /**
   * Focuses the text again, the caret where it was, each time this
   * changes after the editor mounts: for an editor kept mounted while
   * hidden (a tab behind another) that comes back to the front. The
   * caret is put back as focus arrives, so a key typed at once lands
   * where it was; focusing the editable element yourself leaves the
   * caret at the start for a moment. A change before the editor is up
   * focuses it once it is.
   */
  focusKey?: string | number
  /**
   * Tab and Shift+Tab stay in the text, for an editor that is the page (a
   * notes app's note): in a list or code they indent as always, and on a
   * plain line they do nothing (Markdown holds no indent). Esc, then Tab,
   * moves on (Shift+Tab back); Alt+F10 still reaches the toolbar. The way
   * out is told through the field's description, and shown under it the
   * first time a Tab stays. Default `false`: Tab on a plain line leaves the
   * text, the keyboard's way on to the rest of the page.
   */
  tabStaysInText?: boolean
  /** Shown while the document is empty (and given to screen readers as `aria-placeholder`). */
  placeholder?: string
  /**
   * The field's limit on the saved Markdown's length. From 80% of it, a
   * count shows under the editor, in the destructive text tone once over.
   * Typing isn't stopped: the form's schema still refuses a save over it.
   */
  maxLength?: number
  /**
   * The formatting toolbars: one fixed above the text (bold, headings,
   * lists, link, …), each button with its shortcut, and one floating over
   * selected words (bold to link). Alt+F10 reaches them from the text.
   * With them, "/" at a line's start lists the blocks the line can become
   * (the slash menu). On by default; `'floating'` keeps the floating one
   * and the slash menu but no bar above the text (Notion-style, with
   * `inline`); `false` leaves the text alone, its shortcuts still working.
   */
  toolbar?: boolean | 'floating'
  /**
   * Looks like the text it edits: no border, no box, no padding, so it
   * sits where `<Markdown>` would and reads the same. For notes that are
   * always editable in place (`editInPlace`'s `inline`, which the control
   * gets as `props.inline`); give it `toolbar="floating"` and a
   * `placeholder`, which is all an empty one shows.
   */
  inline?: boolean
  /**
   * Images uploaded into the text: pasted, dropped, or picked with an
   * Image button (on the fixed toolbar; with `toolbar="floating"`, on the
   * "Editor Tools" strip shown while the field has focus; on a phone, in
   * the row pinned to the keyboard) or the slash menu's Image ("/image"). Each file goes
   * through this (the app's own storage: the package knows no endpoint) and goes in as
   * `![](url)`, from the result's `url`, else its `thumbUrl`. A
   * placeholder shows where it will go while it uploads (it isn't saved);
   * a refused file or a failed upload takes it away and says why in a
   * toast. Without it, the editor handles no files: a paste or drop does
   * what it always did.
   */
  upload?: ImageUpload
  /** The image types `upload` takes. Defaults to JPEG, PNG and WebP (`DEFAULT_IMAGE_TYPES`). */
  imageAccept?: readonly string[]
  /** The largest image `upload` takes, in bytes: a bigger one is refused before it's sent, with its size and the limit. */
  imageMaxSize?: number
  /**
   * The HTML level the text's `#` renders as, where the field sits in the
   * page's outline: 2 straight under the page's <h1> (a form), 3 (the
   * default) under a section's <h2>. `##` is one below it, `###` two
   * below, never past <h6>, as in `<Markdown>`. Only the element changes:
   * the look, and the Markdown saved (`#` stays `#`), don't. Read once,
   * when it mounts.
   */
  headingLevel?: HeadingLevel
  /**
   * Which heading takes `headingLevel`: `'hash'` (the default), `#`;
   * `'text'`, the text's own highest when it mounts, for notes that start
   * at `##`, as in `<Markdown>`. A heading added above it renders at
   * `headingLevel` too. The Markdown saved is never rewritten.
   */
  headingFrom?: HeadingFrom
  /**
   * Folds the text by its toggle headings, as `<Markdown>`'s `foldKey`
   * does: each toggle heading (`## Safety {toggle="true"}`) at the text's
   * top level has a button that folds what's under it (a plain heading
   * never folds), Ctrl/Cmd+Alt+[ folds the section the caret is in and
   * Ctrl/Cmd+Alt+] opens the heading it's on, and the caret moving into a
   * folded section opens it. Remembered on this device under this key,
   * and shared with `<Markdown>` and NotesOutline given the same one.
   * Only the view folds: the Markdown saved never changes. Read once,
   * when it mounts.
   */
  foldKey?: string
  /**
   * `false` keeps headings plain, with no fold buttons or shortcuts, even
   * with a `foldKey`, as on `<Markdown>`. Read once, when it mounts.
   * Default `true`.
   */
  foldable?: boolean
  /**
   * How tables look: `'compact'` (the default), a full grid of hairlines
   * with tight cells and the header row on the heading band, or
   * `'boxed'`, a rounded box with roomier cells, a muted header row and
   * zebra rows. The same on <Markdown>. Either way columns fit their words.
   */
  tableLook?: TableLook
  /**
   * Which links are the app's own pages, as on `<Markdown>`
   * (src/lib/page-link.ts): each link's address in, what the app knows of
   * the page (title, removed, `onRestore`) or `null` out. A page link
   * shows the page icon and its words in the page-link look, a row of its
   * own when alone in a paragraph; a click opens it in this tab (through
   * the router when there is one). A removed page is struck through, with
   * "Page removed" and, given `onRestore`, Restore. The Markdown is never
   * changed. Called again on each render, so pass the app's latest data.
   */
  pageLink?: PageLinkResolver
  /**
   * Lets the text make pages: "/page" in the slash menu, and Turn into
   * page on selected words, ask for a title (the selected words to start
   * with), call this with it, and once it resolves to the new page's
   * address put `[title](href)` where the "/page" or the words were. While
   * it's pending the title box waits; a rejection is shown in the box in
   * the gateway's words and the text is left as it was. Where the page
   * lives (under this record, or under a page, any depth) is the app's.
   */
  onCreatePage?: CreatePage
  className?: string
  /** The field's label. A rich-text area must have one: this, or `aria-labelledby`. */
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

// When the editor opens again: each time `defaultValue` changes to
// Markdown it didn't report. Adjusted while rendering (React's "storing
// information from previous renders"), so the new text never shows a
// frame late.
function useOpenings(defaultValue: string) {
  const [seen, setSeen] = useState(defaultValue)
  const [reported, setReported] = useState(defaultValue)
  const [opening, setOpening] = useState(0)
  if (defaultValue !== seen) {
    setSeen(defaultValue)
    if (defaultValue !== reported) {
      setReported(defaultValue)
      setOpening(opening + 1)
    }
  }
  return { opening, report: setReported }
}

export function RichTextEditor(props: RichTextEditorProps) {
  const { opening, report } = useOpenings(props.defaultValue)
  const { onChange } = props
  // The editor reports what was typed as it unmounts; one replaced
  // by a new value (a reset) has nothing left to say.
  const live = useRef(opening)
  useLayoutEffect(() => {
    live.current = opening
  })
  // Chosen once per mount: the editor itself when its code is here (drawn
  // at once, no loading view), else loaded behind Suspense. The lazy is
  // this mount's own, so a load that failed isn't kept for the next.
  const [MilkdownEditor] = useState<ComponentType<MilkdownEditorProps>>(() => loadedRichTextEditor()?.default ?? lazy(loadRichTextEditor))
  // Loading, focused: a textarea beside the loading view holds the keys
  // typed meanwhile, and the editor types them in once it's up
  // (rich-text-held-keys.ts). Beside the Suspense boundary, not in its
  // fallback, which goes the moment the editor's code arrives.
  // Keys held from before this editor mounted (`holdKeysForNextEditor()`,
  // rich-text-hold-keys.ts) are taken over instead, loaded or not.
  const [adopting] = useState(() => Boolean(props.autoFocus) && !props.readOnly && keyHoldWaiting())
  const [holding, setHolding] = useState(() => adopting || (loadedRichTextEditor() === null && Boolean(props.autoFocus) && !props.readOnly))
  const heldRef = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const claimed = useRef<ClaimedHold | null>(null)
  const [held] = useState<HeldKeys>(() => ({
    element: () => (adopting ? (claimed.current?.element() ?? null) : heldRef.current),
    composing: () => (adopting ? (claimed.current?.composing() ?? false) : composing.current),
    release: () => {
      claimed.current?.release()
      claimed.current = null
      setHolding(false)
    },
  }))
  useLayoutEffect(() => {
    if (!adopting) return
    claimed.current = claimKeyHold()
    return () => {
      claimed.current?.giveBack()
      claimed.current = null
    }
  }, [adopting])
  // The `focusKey` last acted on: kept here, so neither a load nor a
  // remount (a reset) takes an unchanged key for a new one.
  const focusHandled = useRef(props.focusKey)
  const [isNewFocus] = useState(() => (key: string | number | undefined) => {
    if (focusHandled.current === key) return false
    focusHandled.current = key
    return true
  })
  return (
    <>
      {holding && !adopting && (
        <textarea
          ref={heldRef}
          id={props.id}
          data-slot="rich-text-editor-held"
          autoFocus
          aria-label={props['aria-label']}
          aria-labelledby={props['aria-labelledby']}
          aria-describedby={props['aria-describedby']}
          className="sr-only"
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={() => (composing.current = false)}
        />
      )}
      <Suspense
        fallback={
          <div
            data-slot="rich-text-editor"
            data-state="loading"
            className={cn('flex w-full flex-col', !props.inline && 'rounded-lg border border-input', props.className)}
          >
            {/* The toolbar's height, so nothing moves when it arrives (none on
                a touch screen, whose toolbar is pinned to the keyboard). */}
            {(props.toolbar ?? true) === true && <div className="h-9 border-b border-input pointer-coarse:hidden" />}
            {/* The text itself while the editor loads: it's as tall as
                the editor will be, so nothing under it moves when the editor
                arrives (a phone's notes, edited in place above the facts).
                Skeleton lines only for an empty one. */}
            <div
              aria-busy="true"
              className={cn(
                'flex flex-col gap-2',
                props.inline ? 'py-0.5' : 'min-h-24 px-2.5 py-2',
                // The room of the add-row bar the editor draws under a table.
                !props.readOnly && '[&_table]:mb-5',
              )}
            >
              {props.defaultValue.trim() ? (
                <Markdown headingLevel={props.headingLevel} headingFrom={props.headingFrom} foldKey={props.foldable === false ? undefined : props.foldKey}>
                  {props.defaultValue}
                </Markdown>
              ) : (
                <>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </>
              )}
            </div>
          </div>
        }
      >
        <MilkdownEditor
          key={opening}
          {...props}
          onChange={(markdown) => {
            if (live.current !== opening) return
            report(markdown)
            onChange(markdown)
          }}
          foldKey={props.foldable === false ? undefined : props.foldKey}
          held={holding ? held : undefined}
          isNewFocus={isNewFocus}
        />
      </Suspense>
    </>
  )
}
