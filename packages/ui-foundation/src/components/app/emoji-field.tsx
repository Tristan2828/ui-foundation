// One emoji on a form: a routine's mark, a list's icon. The value is the
// emoji itself, or `''` for none. A button showing the choice (drawn as
// Noto's picture, <Emoji>), opening a picker of every Unicode emoji with
// no skin tones: a search box, a row of group tabs (Recent, Suggested and
// Unicode's nine groups) that scroll to their group and light up as you
// scroll, an 8-across grid, and Clear when `clearable`. On a laptop the
// picker is a Popover; below 768px the same content is a sheet from the
// bottom of the screen, with bigger emoji. Like DateField it is one
// control for a react-hook-form `Controller`.
//
// Every emoji (emoji-data.generated.ts, about 190 KB) loads only when a
// picker opens; Recent and Suggested show at once. Recent is this device's
// last 16 picks, kept in localStorage (a convenience, not per account).
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import {
  Clock,
  Flag,
  Hash,
  Leaf,
  Lightbulb,
  Plane,
  Smile,
  SmilePlus,
  Star,
  Trophy,
  User,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { Emoji } from './emoji'
import {
  SUGGESTED_EMOJI,
  addRecentEmoji,
  emojiKey,
  readRecentEmoji,
  writeRecentEmoji,
  mergeSuggestedKeywords,
  searchEmoji,
  type EmojiEntry,
  type EmojiGroup,
} from './emoji-field-data'

export type EmojiFieldProps = {
  /** The trigger button's id, for the field's `<FieldLabel htmlFor>`. */
  id?: string
  /** The emoji, or `''` for none. */
  value: string
  /** Called with the picked emoji, or `''` when cleared. */
  onChange: (value: string) => void
  /** What the button says with none picked. Defaults to "Pick an emoji". */
  placeholder?: string
  /** Offer Clear in the picker, for an optional field. */
  clearable?: boolean
  /** The value was refused: `aria-invalid` on the button. */
  invalid?: boolean
  /** Saving: the button shows the emoji but won't open. */
  readOnly?: boolean
  /** Open on mount (for stories and editing in place). */
  defaultOpen?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

// ------------------------------------------------------------ the data

let allGroups: Promise<EmojiGroup[]> | null = null
function loadAllGroups() {
  allGroups ??= import('./emoji-data.generated').then((module) => mergeSuggestedKeywords(module.EMOJI_GROUPS_ALL))
  return allGroups
}

function useAllGroups() {
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null)
  useEffect(() => {
    let live = true
    void loadAllGroups().then((loaded) => {
      if (live) setGroups(loaded)
    })
    return () => {
      live = false
    }
  }, [])
  return groups
}

// ------------------------------------------------------------- sections

type Tab = { key: string; label: string; icon: LucideIcon }

// Unicode's nine groups, in Unicode's order, as emoji-data.generated.ts names them.
const GROUP_ICONS: Record<string, LucideIcon> = {
  'Smileys and Emotion': Smile,
  'People and Body': User,
  'Animals and Nature': Leaf,
  'Food and Drink': Utensils,
  'Travel and Places': Plane,
  Activities: Trophy,
  Objects: Lightbulb,
  Symbols: Hash,
  Flags: Flag,
}
const GROUP_LABELS = Object.keys(GROUP_ICONS)

type Section = { key: string; label: string; emojis: EmojiEntry[] | null }

// Pictures are drawn a block of 8 rows at a time, once the block comes
// near the view: a browser's own lazy loading reaches far past a scrolled
// box and would fetch hundreds on opening. The buttons are always there
// (their names, the keyboard), only the pictures wait.
const BLOCK = 64
function blocks(emojis: EmojiEntry[]): EmojiEntry[][] {
  const out: EmojiEntry[][] = []
  for (let index = 0; index < emojis.length; index += BLOCK) out.push(emojis.slice(index, index + BLOCK))
  return out
}

const sectionId = (base: string, key: string) => `${base}${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

// ------------------------------------------------------------- the field

export function EmojiField({
  id,
  value,
  onChange,
  placeholder = 'Pick an emoji',
  clearable = false,
  invalid = false,
  readOnly = false,
  defaultOpen = false,
  className,
  ...aria
}: EmojiFieldProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(defaultOpen && !readOnly)

  const changeOpen = (next: boolean) => {
    if (next && readOnly) return
    setOpen(next)
  }
  const pick = (next: string) => {
    if (next) writeRecentEmoji(addRecentEmoji(readRecentEmoji(), next))
    onChange(next)
    changeOpen(false)
  }

  const trigger: ReactElement = (
    <Button
      id={id}
      type="button"
      variant="outline"
      aria-invalid={invalid || undefined}
      aria-readonly={readOnly || undefined}
      className={cn('w-full justify-start font-normal', !value && 'text-muted-foreground', className)}
      {...aria}
    />
  )
  const face = value ? (
    <Emoji emoji={value} label={value} className="size-5" />
  ) : (
    <>
      <SmilePlus aria-hidden="true" className="size-4" />
      {placeholder}
    </>
  )
  // Mounted only while open: the data loads, and Recent is read, on opening.
  const picker = open ? <EmojiPicker value={value} onPick={pick} clearable={clearable} large={isMobile} /> : null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={changeOpen}>
        <SheetTrigger render={trigger}>{face}</SheetTrigger>
        <SheetContent
          side="bottom"
          data-slot="emoji-field-popup"
          className="max-h-[80dvh] gap-2 px-4 pt-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="sr-only">Emoji</SheetTitle>
          {/* Room for the sheet's Close button beside the search box. */}
          <div className="flex flex-col gap-2 pt-8">{picker}</div>
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger render={trigger}>{face}</PopoverTrigger>
      <PopoverContent className="w-[330px] gap-2 p-2" align="start" data-slot="emoji-field-popup" aria-label="Emoji">
        {picker}
      </PopoverContent>
    </Popover>
  )
}

// ------------------------------------------------------------ the picker

function EmojiPicker({
  value,
  onPick,
  clearable,
  large,
}: {
  value: string
  onPick: (emoji: string) => void
  clearable: boolean
  large: boolean
}) {
  const base = useId()
  const [query, setQuery] = useState('')
  const [recent] = useState(readRecentEmoji)
  const groups = useAllGroups()
  const searching = query.trim() !== ''

  const sections: Section[] = useMemo(() => {
    if (searching) return [{ key: 'results', label: 'Results', emojis: searchEmoji(query, groups ?? [], SUGGESTED_EMOJI) }]
    const named = new Map<string, EmojiEntry>()
    for (const entry of [...(groups ?? []).flatMap((group) => group.emojis), ...SUGGESTED_EMOJI]) {
      if (!named.has(emojiKey(entry.emoji))) named.set(emojiKey(entry.emoji), entry)
    }
    const recentEntries = recent.map((emoji) => named.get(emojiKey(emoji)) ?? { emoji, name: emoji })
    return [
      ...(recentEntries.length > 0 ? [{ key: 'recent', label: 'Recent', emojis: recentEntries }] : []),
      { key: 'suggested', label: 'Suggested', emojis: SUGGESTED_EMOJI },
      ...GROUP_LABELS.map((label) => ({
        key: label,
        label,
        emojis: groups ? (groups.find((group) => group.label === label)?.emojis ?? []) : null,
      })),
    ]
  }, [searching, query, groups, recent])

  const tabs: Tab[] = [
    ...(recent.length > 0 ? [{ key: 'recent', label: 'Recent', icon: Clock }] : []),
    { key: 'suggested', label: 'Suggested', icon: Star },
    ...GROUP_LABELS.map((label) => ({ key: label, label, icon: GROUP_ICONS[label] })),
  ]

  const scroller = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState<string>(tabs[0].key)
  // After a tab's own scroll the pressed tab stays lit until the person
  // scrolls by hand: the last groups can't reach the top, so the observer
  // would light the one above instead.
  const pinned = useRef(false)

  const scrollTo = (key: string) => {
    const box = scroller.current
    const section = box?.querySelector<HTMLElement>(`#${CSS.escape(sectionId(base, key))}`)
    if (!box || !section) return
    pinned.current = true
    box.scrollTop = section.offsetTop
    setCurrent(key)
  }

  // The topmost section with any of it in view is the current tab.
  useEffect(() => {
    const box = scroller.current
    if (!box || searching || typeof IntersectionObserver === 'undefined') return
    const visible = new Set<string>()
    const elements = [...box.querySelectorAll<HTMLElement>('[data-emoji-section]')]
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          const key = (record.target as HTMLElement).dataset.emojiSection ?? ''
          // Ratio, not isIntersecting: a section whose edge only touches
          // the top of the view isn't in it.
          if (record.intersectionRatio > 0) visible.add(key)
          else visible.delete(key)
        }
        if (pinned.current) return
        const top = elements.find((element) => visible.has(element.dataset.emojiSection ?? ''))
        if (top) setCurrent(top.dataset.emojiSection ?? '')
      },
      { root: box, threshold: [0, 0.01] },
    )
    for (const element of elements) observer.observe(element)
    const unpin = () => {
      pinned.current = false
    }
    const byHand = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    for (const name of byHand) box.addEventListener(name, unpin, { passive: true })
    return () => {
      observer.disconnect()
      for (const name of byHand) box.removeEventListener(name, unpin)
    }
  }, [searching, sections])

  // The blocks near the view, kept once drawn.
  const [near, setNear] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const elements = [...box.querySelectorAll<HTMLElement>('[data-emoji-block]')]
    if (typeof IntersectionObserver === 'undefined') {
      setNear(new Set(elements.map((element) => element.dataset.emojiBlock ?? '')))
      return
    }
    const observer = new IntersectionObserver(
      (records) => {
        const reached = records.filter((record) => record.isIntersecting).map((record) => (record.target as HTMLElement).dataset.emojiBlock ?? '')
        if (reached.length === 0) return
        setNear((previous) => (reached.every((key) => previous.has(key)) ? previous : new Set([...previous, ...reached])))
      },
      { root: box, rootMargin: '160px 0px' },
    )
    for (const element of elements) observer.observe(element)
    return () => observer.disconnect()
  }, [sections])

  const pressTab = (key: string) => {
    // While searching, the groups come back first, then it scrolls.
    if (searching) flushSync(() => setQuery(''))
    scrollTo(key)
  }

  const selected = searching ? null : current
  const focusable = selected !== null && tabs.some((tab) => tab.key === selected) ? selected : tabs[0].key
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    const target = tabs[(next + tabs.length) % tabs.length]
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(target.key)}"]`)?.focus()
  }

  const nothing = searching && sections[0].emojis?.length === 0
  return (
    <>
      <Input
        type="search"
        autoComplete="off"
        aria-label="Search Emoji"
        placeholder="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {/* Eleven tabs fit a 330px popup only a little under 30px each, so they share the row. */}
      <div role="tablist" aria-label="Emoji groups" className="flex justify-between gap-px">
        {tabs.map((tab, index) => (
          <Button
            key={tab.key}
            type="button"
            variant="ghost"
            role="tab"
            data-tab={tab.key}
            aria-label={tab.label}
            title={tab.label}
            aria-selected={tab.key === selected}
            aria-controls={searching ? undefined : sectionId(base, tab.key)}
            tabIndex={tab.key === focusable ? 0 : -1}
            onClick={() => pressTab(tab.key)}
            onKeyDown={(event) => onTabKey(event, index)}
            className="h-[30px] min-w-0 max-w-[30px] flex-1 p-0 text-muted-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <tab.icon aria-hidden="true" className="size-4" />
          </Button>
        ))}
      </div>
      <div
        ref={scroller}
        data-slot="emoji-grid"
        className={cn('relative overflow-y-auto overscroll-contain', large ? 'max-h-[300px]' : 'max-h-64')}
      >
        {nothing ? (
          <p className="p-2 text-sm text-muted-foreground">No emoji match "{query.trim()}".</p>
        ) : (
          sections.map((section) => (
            <section
              key={section.key}
              id={sectionId(base, section.key)}
              data-emoji-section={section.key}
              role={searching ? undefined : 'tabpanel'}
              aria-label={section.label}
              className="pb-2 last:pb-0"
            >
              <h3 className="px-1 py-1 text-xs font-medium text-muted-foreground">{section.label}</h3>
              {section.emojis === null ? (
                <Skeleton delay={0} data-slot="emoji-loading" className={cn('mx-1', large ? 'h-40' : 'h-32')} />
              ) : (
                <div className="flex flex-col gap-0.5">
                  {blocks(section.emojis).map((block, index) => {
                    const blockKey = `${section.key}:${index}`
                    const drawn = near.has(blockKey)
                    return (
                      <div key={blockKey} data-emoji-block={blockKey} className="grid grid-cols-8 gap-0.5">
                        {block.map((entry) => (
                          <button
                            key={entry.emoji}
                            type="button"
                            aria-label={entry.name}
                            title={entry.name}
                            aria-pressed={entry.emoji === value}
                            onClick={() => onPick(entry.emoji)}
                            className={cn(
                              'flex aspect-square w-full items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-accent',
                              large && 'min-h-10',
                            )}
                          >
                            {drawn ? <Emoji emoji={entry.emoji} className={large ? 'size-7' : 'size-6'} /> : null}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          ))
        )}
      </div>
      {clearable && value && (
        <div className="flex justify-end border-t border-border pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onPick('')}>
            Clear
          </Button>
        </div>
      )}
    </>
  )
}
