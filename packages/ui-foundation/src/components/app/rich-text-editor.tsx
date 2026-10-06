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
// The editor (Milkdown) is loaded on first use, so a page that only reads
// Markdown never downloads it. Until it arrives, a placeholder the size of
// the field shows.
import { lazy, Suspense } from 'react'
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'

const MilkdownEditor = lazy(() => import('./milkdown-editor'))

export type RichTextEditorProps = {
  /** The editable element's id, for a label's `htmlFor` or a test. */
  id?: string
  /** The Markdown it opens with. Read once, when it mounts (uncontrolled). */
  defaultValue: string
  /** The Markdown to save, after every edit: untouched blocks as originally written. */
  onChange: (markdown: string) => void
  /** Why the edit can't be saved as it stands, or `null` once it can. */
  onProblem?: (message: string | null) => void
  /** Shown but not editable (while a save is in flight). */
  readOnly?: boolean
  autoFocus?: boolean
  className?: string
  /** The field's label. A rich-text area must have one: this, or `aria-labelledby`. */
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div
          data-slot="rich-text-editor"
          data-state="loading"
          className={cn('flex min-h-24 w-full flex-col gap-2 rounded-lg border border-input px-2.5 py-2', props.className)}
        >
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      }
    >
      <MilkdownEditor {...props} />
    </Suspense>
  )
}
