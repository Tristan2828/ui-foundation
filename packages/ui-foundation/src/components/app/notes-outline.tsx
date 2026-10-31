// A long text's headings as a list to jump with, beside <Markdown> or the
// rich-text editor given the same `foldKey`: each heading a button that
// opens its section (and any it sits under) and brings it into view, with
// Fold all and Open all above. The text's top-level headings, as folding
// sees them (src/lib/markdown-fold.ts); the deepest levels are left out
// (`depth`), so a long text's outline stays a list of its parts.
//
// The jump lands on the heading's fold button, so from the keyboard the
// next Enter folds what was just opened. The outline reads the Markdown
// it's given: beside an editor, the text as last saved.
import { useMemo } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { useFolds } from '@/hooks/fold-store'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { allFoldable, markdownFoldPlan, openTo } from '@/lib/markdown-fold'

export type NotesOutlineProps = {
  /** The text whose headings are listed. */
  markdown: string
  /** The `foldKey` of the <Markdown> or RichTextEditor showing the text. */
  foldKey: string
  /**
   * How many heading levels are listed, from the text's highest down: 2
   * (the default) lists `#` and `##` in a text that starts at `#`.
   */
  depth?: number
  /** With fewer listed headings than this, the outline shows nothing. 2 by default. */
  minHeadings?: number
  /** Names the outline's landmark. "Outline" by default. */
  'aria-label'?: string
  className?: string
}

// Each level's indent, from the highest listed.
const INDENT = ['pl-2', 'pl-6', 'pl-10', 'pl-14', 'pl-18', 'pl-22']

// The element showing the heading `id` in the text under `foldKey`.
function headingElement(foldKey: string, id: string) {
  for (const scope of document.querySelectorAll<HTMLElement>('[data-fold-scope]')) {
    if (scope.dataset.foldScope !== foldKey) continue
    for (const heading of scope.querySelectorAll<HTMLElement>('[data-fold-id]')) if (heading.dataset.foldId === id) return heading
  }
  return null
}

export function NotesOutline({
  markdown,
  foldKey,
  depth = 2,
  minHeadings = 2,
  'aria-label': ariaLabel = 'Outline',
  className,
}: NotesOutlineProps) {
  const [folded, setFolded] = useFolds(foldKey)
  const reducedMotion = usePrefersReducedMotion()
  const plan = useMemo(() => markdownFoldPlan(markdown), [markdown])
  const top = Math.min(...plan.headings.map((heading) => heading.level))
  const listed = plan.headings.filter((heading) => heading.level < top + depth)
  if (listed.length < minHeadings) return null
  const foldable = allFoldable(plan)
  const anyFolded = [...folded].some((id) => foldable.has(id))
  const allFolded = [...foldable].every((id) => folded.has(id))

  const jump = (id: string) => {
    setFolded(openTo(plan, folded, id))
    // Once the text has opened up to it.
    requestAnimationFrame(() => {
      const heading = headingElement(foldKey, id)
      if (!heading) return
      heading.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' })
      const button = heading.querySelector<HTMLElement>('[data-slot="fold-button"]')
      if (button && getComputedStyle(button).visibility !== 'hidden') button.focus({ preventScroll: true })
    })
  }

  return (
    <nav aria-label={ariaLabel} data-slot="notes-outline" className={cn('flex min-w-0 flex-col gap-2', className)}>
      <div className="flex flex-wrap gap-1">
        <Button size="xs" variant="outline" disabled={allFolded} onClick={() => setFolded(foldable)}>
          Fold all
        </Button>
        <Button size="xs" variant="outline" disabled={!anyFolded} onClick={() => setFolded(new Set())}>
          Open all
        </Button>
      </div>
      <ul className="flex flex-col">
        {listed.map((heading) => {
          const isFolded = heading.foldable && folded.has(heading.id)
          return (
            <li key={heading.id}>
              <button
                type="button"
                onClick={() => jump(heading.id)}
                className={cn(
                  'flex w-full min-w-0 items-center gap-1 rounded-md py-1 pr-2 text-left type-body text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                  INDENT[Math.min(heading.level - top, INDENT.length - 1)],
                  heading.level > top && 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{heading.text || 'Untitled section'}</span>
                {isFolded && (
                  <>
                    <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="sr-only"> (folded)</span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
