// A settings page: its groups listed down the side, the one you're on
// beside them as a card of rows (design-language.md "A settings page").
// Parts an app puts together, not one component from a list:
//
// - SettingsPage is the layout route: the title, the groups' links and the
//   current group's content. The routes are the app's, one per group, the
//   first at the page's own address.
// - SettingsCard holds a group's rows; what else the group has (a table)
//   goes after it.
// - SettingsRow is one setting: its label and help, and its control beside
//   them or, with `layout="below"`, under them.
//
// Where a choice is kept, and any saving, is the control's own.
import { useId, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { cn } from 'cn'
import { Card } from '@/components/ui/card'
import { mostSpecificTo, navPathname } from './app-shell-nav'
import { usePageTrail } from './page-trail-context'

/** One group of settings: the address its route is at, and its name. */
export type SettingsGroup = { to: string; label: string }

export type SettingsPageProps = {
  /** The page's name: its heading, the groups' landmark and the top of the trail. */
  title: string
  /**
   * The groups, in order, each at its own route under the page. The first
   * is at the page's own address (the layout's index route). Leave out a
   * group that holds nothing.
   */
  groups: readonly SettingsGroup[]
  /** The current group: the layout route's `<Outlet />`. */
  children: ReactNode
  className?: string
}

// A group's link: marked as the sidebar marks its current entry, a tint and
// a 3px bar in the accent at its start. In a narrow box it is a finger's
// target.
const GROUP = cn(
  'flex items-center rounded-md px-2.5 py-1.75 type-body text-foreground outline-none',
  'focus-visible:ring-3 focus-visible:ring-ring/50',
  '@max-[40rem]/settings:min-h-10',
)
const CURRENT_GROUP = 'bg-primary/15 shadow-[inset_3px_0_0_0_var(--primary)]'

/**
 * The layout of a settings page, inside a router: `title`, the links to
 * `groups` down the side (in a row above, in a box under 40rem), and the
 * current group. Past the first group it puts the page's trail in the
 * shell's bar.
 *
 *   <Route path="settings" element={<SettingsPage title="Settings" groups={GROUPS}><Outlet /></SettingsPage>}>
 *     <Route index element={<LookSettings />} />
 *     <Route path="notifications" element={<NotificationSettings />} />
 *   </Route>
 */
export function SettingsPage({ title, groups, children, className }: SettingsPageProps) {
  const id = useId()
  const { pathname } = useLocation()
  const current = mostSpecificTo(groups, pathname)
  const currentId = current && `${id}-${groups.indexOf(current)}`
  // On a group's own page only: a page below one puts up its own trail,
  // which a parent's would win over.
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const onGroup = current && current !== groups[0] && navPathname(current.to) === trimmed
  usePageTrail(onGroup ? [{ label: title, href: groups[0].to }, { label: current.label }] : null)

  return (
    <div data-slot="settings-page" className={cn('@container/settings w-full min-w-0', className)}>
      <h1 className="mb-4 type-page-title text-foreground">{title}</h1>
      {/* By the box's own width, not the window's: the sidebar takes its
          share of the page. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @min-[40rem]/settings:grid-cols-[--spacing(45)_minmax(0,1fr)] @min-[40rem]/settings:gap-7">
        <nav data-slot="settings-groups" aria-label={title}>
          <ul className="flex flex-wrap gap-1 @min-[40rem]/settings:flex-col @min-[40rem]/settings:gap-0.5">
            {groups.map((group, index) => {
              const isCurrent = group === current
              return (
                <li key={group.to}>
                  <Link
                    to={group.to}
                    id={`${id}-${index}`}
                    data-slot="settings-group"
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cn(GROUP, isCurrent ? CURRENT_GROUP : 'hover:bg-muted')}
                  >
                    {group.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        {/* Caps no width: the card caps its own, so a table under it can
            be wider. */}
        <section data-slot="settings-content" aria-labelledby={currentId} className="flex min-w-0 flex-col gap-4">
          {children}
        </section>
      </div>
    </div>
  )
}

export type SettingsCardProps = {
  /** The group's `SettingsRow`s. */
  children: ReactNode
  className?: string
}

/**
 * A group's rows, in a bordered card that stops growing at 832px (a step
 * of the spacing scale, so it grows with the density). It has no heading:
 * the group's name is the link beside it. A table the group holds goes
 * after it.
 */
export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <Card data-slot="settings-card" className={cn('max-w-208 gap-0 divide-y divide-border py-0', className)}>
      {children}
    </Card>
  )
}

/** What names a row's control: spread it on the control. */
export type SettingsRowAria = {
  'aria-labelledby': string
  /** Only with `help`. */
  'aria-describedby'?: string
}

export type SettingsRowProps = {
  label: string
  /** One short line under the label. */
  help?: ReactNode
  /**
   * The setting's control, or a function handed the `aria-*` that name it
   * by the row's label and help, to spread on it.
   */
  control: ReactNode | ((aria: SettingsRowAria) => ReactNode)
  /**
   * `'beside'` (the default): the control at the row's end, dropping under
   * the words where they don't fit on a line. `'below'`: always under
   * them, at the row's full width, for a control with a size of its own
   * (tiles, a list).
   */
  layout?: 'beside' | 'below'
  /**
   * The control's id, where it is one thing a label can name (a select, a
   * switch): the label is then its `<label>`, and a click on the words
   * reaches it. A group of buttons or radios has none.
   */
  htmlFor?: string
  className?: string
}

/** One setting in a `SettingsCard`: what it is, and its control. */
export function SettingsRow({ label, help, control, layout = 'beside', htmlFor, className }: SettingsRowProps) {
  const id = useId()
  const labelId = `${id}-label`
  const helpId = `${id}-help`
  const aria: SettingsRowAria = { 'aria-labelledby': labelId, ...(help ? { 'aria-describedby': helpId } : {}) }
  const below = layout === 'below'
  return (
    <div
      data-slot="settings-row"
      data-layout={layout}
      className={cn(
        'flex px-4 py-3',
        below ? 'flex-col gap-2.5' : 'flex-wrap items-center justify-between gap-x-5 gap-y-2',
        className,
      )}
    >
      <div className={cn('flex min-w-0 flex-col items-start gap-0.5', !below && 'flex-[1_1_--spacing(60)]')}>
        {htmlFor ? (
          <label id={labelId} htmlFor={htmlFor} className="type-body font-medium">
            {label}
          </label>
        ) : (
          <span id={labelId} className="type-body font-medium">
            {label}
          </span>
        )}
        {help && (
          <div id={helpId} className="type-caption text-muted-foreground">
            {help}
          </div>
        )}
      </div>
      <div data-slot="settings-row-control" className={below ? 'w-full min-w-0' : 'max-w-full'}>
        {typeof control === 'function' ? control(aria) : control}
      </div>
    </div>
  )
}
