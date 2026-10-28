// A table in written text, <Markdown>'s or the editor's, sits in a box
// that scrolls sideways when the table is wider than the text. A box that
// scrolls has to be reachable from the keyboard (axe's
// scrollable-region-focusable), or someone without a mouse can never see
// its right-hand columns. So, only while the table overflows, the box is
// a tab stop and a named region: "Table, scrolls sideways", then its
// columns, which tell two tables on a page apart (two regions with one
// name are axe's landmark-unique) and say which table it is. With the
// arrow keys it then scrolls. A table that fits is left alone: no tab
// stop and no region, nothing to reach that does nothing.
//
// It follows the table: a ResizeObserver on the box (the text's width
// changing) and on the table (a column added, a cell's text growing)
// checks again each time either changes size.

/** The box's focus ring, from the semantic tokens: on the box's own classes. */
export const TABLE_SCROLL_FOCUS = 'outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

// The columns named in the region's name; past them, an ellipsis.
const NAMED_COLUMNS = 3

/**
 * The region's accessible name: "Table, scrolls sideways", then the
 * header row's first few columns ("…: Part, Width, Depth"). Empty
 * headers are skipped; with none, the phrase alone.
 */
export function tableScrollName(columns: readonly string[]): string {
  const named = columns.map((column) => column.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (named.length === 0) return 'Table, scrolls sideways'
  const shown = named.slice(0, NAMED_COLUMNS).join(', ')
  return `Table, scrolls sideways: ${shown}${named.length > NAMED_COLUMNS ? ', …' : ''}`
}

/** What the box needs of its element: as much as tests can fake. */
type ScrollBox = Pick<HTMLElement, 'scrollWidth' | 'clientWidth' | 'setAttribute' | 'removeAttribute' | 'getAttribute'>

export type TableScrollRegion = {
  /** The header row's texts, for the name: called again when they change (the editor's edits). */
  setColumns: (columns: readonly string[]) => void
  /** Checks again whether the table overflows. The observers call it; a test can too. */
  check: () => void
  /**
   * Takes the tab stop off until `resume`, the rest kept: for a press in
   * the editor's box, whose focus belongs to the text, not the box.
   */
  suspend: () => void
  resume: () => void
  /** Stops watching. The box keeps whatever it last was. */
  destroy: () => void
}

// Set only when it differs, so a check that finds nothing new writes
// nothing (the editor reads its own DOM's mutations).
function set(box: ScrollBox, name: string, value: string | null) {
  if (box.getAttribute(name) === value) return
  if (value === null) box.removeAttribute(name)
  else box.setAttribute(name, value)
}

/**
 * Watches a table's scroll box: a tab stop and a named region while the
 * table is wider than the box, nothing while it fits. `table` is what
 * scrolls in it (observed for its size; the box alone when absent).
 */
export function watchTableScroll(
  box: ScrollBox,
  table?: Element | null,
  columns: readonly string[] = [],
): TableScrollRegion {
  let name = tableScrollName(columns)
  let suspended = false
  const check = () => {
    // scrollWidth counts what's hidden past the right edge; the two are
    // whole pixels, so a table that just fits measures equal.
    const overflows = box.scrollWidth > box.clientWidth
    set(box, 'tabindex', overflows && !suspended ? '0' : null)
    set(box, 'role', overflows ? 'region' : null)
    set(box, 'aria-label', overflows ? name : null)
  }
  // Server rendering and tests have no ResizeObserver: one check, then
  // whatever the box was.
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check)
  if (observer) {
    observer.observe(box as Element)
    if (table) observer.observe(table)
  }
  check()
  return {
    setColumns: (next) => {
      name = tableScrollName(next)
      check()
    },
    check,
    suspend: () => {
      suspended = true
      check()
    },
    resume: () => {
      suspended = false
      check()
    },
    destroy: () => observer?.disconnect(),
  }
}

/** A rendered table's header row, as texts: the header cells of its first row. */
export function headerTexts(table: Element | null | undefined): string[] {
  const row = table?.querySelector('tr')
  return row ? Array.from(row.querySelectorAll('th'), (cell) => cell.textContent ?? '') : []
}
