// Long text written as Markdown, edited as formatted text where it's read
// (Notion-style), not as Markdown syntax in a textarea. The control for a
// `long text` field marked Markdown, on the form and in place on the view.
//
// It stays Markdown: it opens from Markdown and reports Markdown. Opening
// and saving round-trip exactly: an untouched document comes back byte for
// byte, and an edited one keeps every block the person didn't change as it
// was written (src/lib/markdown-merge.ts). If an edit can't be saved
// without rewriting another block, `onProblem` says so and `onChange`
// isn't called: the draft stays on screen, nothing is saved in its place.
//
// Raw HTML in the text shows as its characters, as <Markdown> shows it,
// and nothing pasted or typed can add markup.
//
// Headings in the text sit under the page's outline (`headingLevel`, from
// <h3> by default), as <Markdown>'s do. A table wider than the field
// scrolls sideways, and while it does, its box is a tab stop the arrow
// keys scroll.
//
// Images in the text (`![alt](url)`) show, at most the field's width.
// With `upload`, an image pasted, dropped or picked with the toolbar's
// Image button is uploaded through the app's own storage and goes in as
// `![](url)`; while it uploads, a placeholder shows where it will go.
//
// A table's columns fit their words. Grips on its column and row (or a
// right-click, or Shift+F10, in a cell) open menus to insert, move,
// delete, align, sort and colour; a header column and cell colours are
// kept as Markdown already writes them (src/lib/markdown-table.ts).
// `tableLook` picks compact (the default) or boxed, as on <Markdown>.
//
// With `foldKey`, the text folds by its toggle headings (NotesOutline
// lists every heading beside it), the Markdown untouched. A toggle heading
// is `## Safety {toggle="true"}` in the Markdown: typed as `>## `, picked
// from the slash menu (Toggle heading 1 to 3) or made from the heading the
// caret is in with the toolbar's Toggle heading. Plain is the default.
//
// With `pageLink`, links the app marks as its pages (src/lib/page-link.ts)
// draw as page links, as on <Markdown>: the page icon, a row of their own
// when alone in a paragraph, "Page removed" with Restore. A click opens the
// page in this tab. With `onCreatePage`, "/page" (or Turn into page on
// selected words) asks for a title, has the app make the page, and puts
// in `[title](href)`. Pages may nest to any depth: a page's own note takes
// the same props. The Markdown stays plain links.
//
// `defaultValue` is read when it mounts, then followed: a new value the
// editor didn't report itself (a form's loaded record arriving after the
// editor, a reset) replaces the text, as if it opened with it. Its own
// edits, coming back as the value, change nothing, so the caret stays
// where it is. A caller that never feeds `onChange` back keeps its text.
//
// The editor (Milkdown) is loaded on first use, so a page that only reads
// Markdown never downloads it. Until it arrives, a placeholder the size of
// the field shows.
import { lazy, Suspense, useState } from 'react'
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'
import type { ImageUpload } from '@/lib/image-file'
import type { CreatePage, PageLinkResolver } from '@/lib/page-link'
import type { HeadingFrom, HeadingLevel, TableLook } from './prose-look'

const MilkdownEditor = lazy(() => import('./milkdown-editor'))

export type RichTextEditorProps = {
  /** The editable element's id, for a label's `htmlFor` or a test. */
  id?: string
  /**
   * The Markdown it opens with. A later value the editor didn't report
   * (a record loaded after it mounted, a reset) replaces the text; the
   * value it reported, passed back, changes nothing.
   */
  defaultValue: string
  /** The Markdown to save, after every edit: untouched blocks as originally written. */
  onChange: (markdown: string) => void
  /** Why the edit can't be saved as it stands, or `null` once it can. */
  onProblem?: (message: string | null) => void
  /** Shown but not editable (while a save is in flight). */
  readOnly?: boolean
  autoFocus?: boolean
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
   * Image button on the fixed toolbar. Each file goes through this (the
   * app's own storage: the package knows no endpoint) and goes in as
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
  return (
    <Suspense
      fallback={
        <div
          data-slot="rich-text-editor"
          data-state="loading"
          className={cn('flex w-full flex-col', !props.inline && 'rounded-lg border border-input', props.className)}
        >
          {/* The toolbar's height, so nothing moves when it arrives. */}
          {(props.toolbar ?? true) === true && <div className="h-9 border-b border-input" />}
          <div className={cn('flex flex-col gap-2', props.inline ? 'py-0.5' : 'min-h-24 px-2.5 py-2')}>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      }
    >
      <MilkdownEditor
        key={opening}
        {...props}
        onChange={(markdown) => {
          report(markdown)
          onChange(markdown)
        }}
        foldKey={props.foldable === false ? undefined : props.foldKey}
      />
    </Suspense>
  )
}
