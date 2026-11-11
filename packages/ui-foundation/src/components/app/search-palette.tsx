// Search in AppShell's bar (#N6): a box in the header (a button on a
// phone) and Ctrl K (⌘K on a Mac) open a palette that finds a page or a
// record by name, and Enter opens it. Before you type it lists the
// records you opened lately (useRecentRecord), then the first pages.
//
// A combobox over a listbox in a dialog (WAI-ARIA's "combobox with
// listbox popup"): focus stays in the box, the arrows move the
// highlighted option (aria-activedescendant), Enter opens it, Esc
// closes. Hand-rolled because shadcn's Command needs cmdk, which isn't
// on the package's allowlist; the dialog is the foundation's own.
import { SearchIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { cn } from 'cn'
import type { NavEntry } from '@/components/app/app-shell-nav'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import {
  groupRecords,
  matchPages,
  readRecentRecords,
  searchPages,
  type RecentRecord,
  type SearchRecord,
} from '@/lib/search-palette'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

export type { RecentRecord, SearchRecord } from '@/lib/search-palette'

/** AppShell's `search`: what the box says and how it finds records. */
export type AppShellSearch = {
  /** The box's words and the palette's field's name. Defaults to "Search". */
  placeholder?: string
  /**
   * Finds the app's records whose title has the text in it, from the
   * app's own search endpoint through its gateway (TanStack Query's
   * `queryClient.fetchQuery`, say). Called once typing pauses, never for
   * text of only spaces; `signal` aborts when the text changes again.
   * The results are listed under their `kind`, in the order given.
   * Without it the palette finds pages only.
   */
  findRecords?: (query: string, options: { signal: AbortSignal }) => Promise<readonly SearchRecord[]>
  /**
   * How many of the records opened lately (useRecentRecord) to list
   * before you type: 5 by default, `false` for none.
   */
  recent?: number | false
}

// How long typing pauses before findRecords is asked.
const SEARCH_DELAY_MS = 150
const PAGES_BEFORE_TYPING = 5
const PAGES_MATCHED = 6

type Option = { id: string; label: string; detail?: string; to: string }
type Group = { heading: string; options: Option[] }
type Found =
  | { query: string; status: 'loading' }
  | { query: string; status: 'error' }
  | { query: string; status: 'success'; records: readonly SearchRecord[] }

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

/** The box (md and up) and the button (a phone) that open the palette, and the palette. */
export function SearchPalette({ search, nav }: { search: AppShellSearch; nav: readonly NavEntry[] }) {
  const [open, setOpen] = useState(false)
  const placeholder = search.placeholder ?? 'Search'
  const shortcut = isMac() ? '⌘K' : 'Ctrl K'

  // Ctrl K or ⌘K from anywhere, unless something on the page (an
  // editor's link shortcut) has already taken it.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      setOpen((current) => !current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <button
        type="button"
        data-slot="app-shell-search"
        aria-keyshortcuts="Control+K Meta+K"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="hidden h-8 w-56 shrink-0 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:flex lg:w-64"
      >
        <SearchIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{placeholder}</span>
        <kbd className="shrink-0 rounded-sm border border-border px-1 font-mono text-xs text-muted-foreground">
          {shortcut}
        </kbd>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        data-slot="app-shell-search-button"
        aria-label={placeholder}
        aria-haspopup="dialog"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && <Palette search={search} nav={nav} placeholder={placeholder} onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  )
}

function Palette({
  search,
  nav,
  placeholder,
  onClose,
}: {
  search: AppShellSearch
  nav: readonly NavEntry[]
  placeholder: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const id = useId()
  const listId = `${id}-list`
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [found, setFound] = useState<Found | null>(null)
  // Read once, as the palette opens: the record you just left is there.
  const [recent] = useState<RecentRecord[]>(() =>
    search.recent === false ? [] : readRecentRecords().slice(0, search.recent ?? 5),
  )
  const pages = useMemo(() => searchPages(nav), [nav])
  const text = query.trim()
  const debounced = useDebouncedValue(text, SEARCH_DELAY_MS)
  const findRecords = search.findRecords
  // The latest findRecords without re-asking when only its identity changes.
  const findRef = useRef(findRecords)
  useEffect(() => {
    findRef.current = findRecords
  }, [findRecords])
  const canFind = findRecords !== undefined

  useEffect(() => {
    const find = findRef.current
    if (!find || !debounced) return
    const controller = new AbortController()
    // Through a microtask, so the effect itself doesn't set state.
    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) setFound({ query: debounced, status: 'loading' })
        return find(debounced, { signal: controller.signal })
      })
      .then(
        (records) => {
          if (!controller.signal.aborted) setFound({ query: debounced, status: 'success', records })
        },
        () => {
          if (!controller.signal.aborted) setFound({ query: debounced, status: 'error' })
        },
      )
    return () => controller.abort()
  }, [debounced])

  // What the records part says for the text on screen: found, still
  // looking (typing, or asked), or couldn't look.
  const records: Found | null = !canFind || !text ? null : found?.query === text ? found : { query: text, status: 'loading' }

  const groups: Group[] = []
  if (!text && recent.length > 0)
    groups.push({
      heading: 'Recent',
      options: recent.map((record, index) => ({ id: `${id}-recent-${index}`, label: record.title, detail: record.detail, to: record.to })),
    })
  const matched = matchPages(pages, text, text ? PAGES_MATCHED : PAGES_BEFORE_TYPING)
  if (matched.length > 0)
    groups.push({
      heading: 'Pages',
      options: matched.map((page, index) => ({ id: `${id}-page-${index}`, label: page.label, to: page.to })),
    })
  if (records?.status === 'success')
    groupRecords(records.records).forEach((group, groupIndex) =>
      groups.push({
        heading: group.kind,
        options: group.records.map((record, index) => ({
          id: `${id}-record-${groupIndex}-${index}`,
          label: record.title,
          detail: record.detail,
          to: record.to,
        })),
      }),
    )
  const options = groups.flatMap((group) => group.options)
  const activeIndex = options.length === 0 ? -1 : Math.min(active, options.length - 1)
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined

  useEffect(() => {
    if (activeOption) document.getElementById(activeOption.id)?.scrollIntoView({ block: 'nearest' })
  }, [activeOption])

  const go = (option: Option) => {
    onClose()
    void navigate(option.to)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (options.length === 0) return
    const move = (to: number) => {
      event.preventDefault()
      setActive((to + options.length) % options.length)
    }
    if (event.key === 'ArrowDown') move(activeIndex + 1)
    else if (event.key === 'ArrowUp') move(activeIndex - 1)
    else if (event.key === 'Home' && event.ctrlKey) move(0)
    else if (event.key === 'End' && event.ctrlKey) move(options.length - 1)
    else if (event.key === 'Enter' && activeOption) {
      event.preventDefault()
      go(activeOption)
    }
  }

  const nothing = text && options.length === 0 && records?.status !== 'loading'
  return (
    <DialogContent
      showCloseButton={false}
      data-slot="search-palette"
      className="top-[12vh] max-h-[76vh] translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-lg"
    >
      <DialogTitle className="sr-only">{placeholder}</DialogTitle>
      <DialogDescription className="sr-only">
        Type a page or a record's name; the arrows move through what's found and Enter opens it.
      </DialogDescription>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input
          role="combobox"
          aria-label={placeholder}
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption?.id}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder="Go to a page or find a record…"
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        {records?.status === 'loading' && <Spinner aria-label="Searching" className="size-4 text-muted-foreground" />}
      </div>
      <div className="min-h-0 overflow-y-auto p-1">
        <div role="listbox" id={listId} aria-label={placeholder}>
          {groups.map((group, groupIndex) => (
            <div key={`${groupIndex}:${group.heading}`} role="group" aria-labelledby={`${id}-group-${groupIndex}`}>
              <div id={`${id}-group-${groupIndex}`} className="px-2 pt-2 pb-1 type-caption text-muted-foreground">
                {group.heading}
              </div>
              {group.options.map((option) => {
                const selected = option.id === activeOption?.id
                return (
                  <div
                    key={option.id}
                    id={option.id}
                    role="option"
                    aria-selected={selected}
                    data-slot="search-palette-option"
                    // A pointer moving over an option highlights it; a
                    // click opens it, focus staying in the box.
                    onPointerMove={() => {
                      const index = options.indexOf(option)
                      if (index !== activeIndex) setActive(index)
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(option)}
                    className={cn(
                      'flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground',
                      selected && 'bg-muted',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.detail && (
                      // Muted, but the foreground on the highlight: the muted
                      // tone on bg-muted is under 4.5:1 in the light theme.
                      <span className={cn('shrink-0 type-caption', selected ? 'text-foreground' : 'text-muted-foreground')}>
                        {option.detail}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {records?.status === 'error' && (
          <p role="status" className="px-2 py-2 text-sm text-muted-foreground">
            Couldn't search records. Pages are still listed; try again in a moment.
          </p>
        )}
        {nothing && (
          <p role="status" className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nothing found for “{text}”.
          </p>
        )}
        {!text && options.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Type to find a page or a record.</p>
        )}
      </div>
    </DialogContent>
  )
}
