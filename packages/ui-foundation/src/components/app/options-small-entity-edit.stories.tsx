import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import {
  BookOpenIcon,
  BriefcaseIcon,
  HeartIcon,
  HouseIcon,
  PencilIcon,
  PlaneIcon,
  PlusIcon,
  ShoppingCartIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type FormEvent, type ReactNode } from 'react'
import { createMemoryRouter, Link, RouterProvider, useLocation, useNavigate } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { DataTable } from './data-table'
import { EditInPlaceContext, editInPlace } from './edit-in-place'
import { EditInPlaceStore } from './edit-in-place-store'
import { EditableValue, LeaveGuard } from './editable-value'
import { EntityView } from './entity-view'

// Options page for issue #105 (not a component, not for merging): editing
// a small entity (a name, a colour, an icon) without a separate edit page.
// Each option is a working screen over the same data, built from the
// package's real components. Saves take ~0.6s; a name another category
// already has ("Home", "Work"…) is refused the way a server's 422 is, so
// the field error can be seen. The bar above each screen shows the URL the
// option would have.

// --- The entity --------------------------------------------------------

const ICONS = { house: HouseIcon, wallet: WalletIcon, briefcase: BriefcaseIcon, heart: HeartIcon, plane: PlaneIcon, cart: ShoppingCartIcon, book: BookOpenIcon } satisfies Record<string, LucideIcon>
type IconKey = keyof typeof ICONS
const ICON_LABELS: Record<IconKey, string> = { house: 'House', wallet: 'Wallet', briefcase: 'Briefcase', heart: 'Heart', plane: 'Plane', cart: 'Cart', book: 'Book' }

// Whole class names: Tailwind only generates the ones written out.
const SLOT_CLASS = [
  'text-category-1', 'text-category-2', 'text-category-3', 'text-category-4', 'text-category-5', 'text-category-6',
  'text-category-7', 'text-category-8', 'text-category-9', 'text-category-10', 'text-category-11', 'text-category-12',
]
const SLOT_LABELS = ['Blue', 'Purple', 'Olive', 'Teal', 'Magenta', 'Indigo', 'Lime', 'Sky', 'Deep teal', 'Plum', 'Deep olive', 'Violet']

type Category = { id: number; name: string; slot: number; icon: IconKey; widgets: number }
type Draft = Pick<Category, 'name' | 'slot' | 'icon'>
const BLANK: Draft = { name: '', slot: 1, icon: 'house' }

const SEED: Category[] = [
  { id: 1, name: 'Home', slot: 1, icon: 'house', widgets: 12 },
  { id: 2, name: 'Finance', slot: 2, icon: 'wallet', widgets: 4 },
  { id: 3, name: 'Work', slot: 3, icon: 'briefcase', widgets: 27 },
  { id: 4, name: 'Health', slot: 5, icon: 'heart', widgets: 3 },
  { id: 5, name: 'Travel', slot: 4, icon: 'plane', widgets: 8 },
]

// A tiny in-memory server: save and create answer after a wait, and a
// duplicate name is a 422 on `name`.
class CategoryServer {
  items = SEED
  private nextId = 6
  private listeners = new Set<() => void>()
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }
  snapshot = () => this.items
  private set(items: Category[]) {
    this.items = items
    for (const listener of this.listeners) listener()
  }
  private check(draft: Partial<Draft>, id?: number) {
    if (draft.name === undefined) return
    const taken = this.items.some((other) => other.id !== id && other.name.trim().toLowerCase() === draft.name!.trim().toLowerCase())
    if (taken) {
      const error: AppError = { kind: 'validation', message: 'Check the highlighted fields.', fieldErrors: { name: ['A category with this name already exists'] } }
      throw error
    }
  }
  save = (id: number, change: Partial<Draft>) =>
    new Promise<Category>((resolve, reject) =>
      setTimeout(() => {
        try {
          this.check(change, id)
        } catch (error) {
          return reject(error)
        }
        const saved = { ...this.items.find((item) => item.id === id)!, ...change }
        this.set(this.items.map((item) => (item.id === id ? saved : item)))
        resolve(saved)
      }, 600),
    )
  create = (draft: Draft) =>
    new Promise<Category>((resolve, reject) =>
      setTimeout(() => {
        try {
          this.check(draft)
        } catch (error) {
          return reject(error)
        }
        const created = { ...draft, id: this.nextId++, widgets: 0 }
        this.set([...this.items, created])
        resolve(created)
      }, 600),
    )
}

function useServer(server: CategoryServer) {
  return useSyncExternalStore(server.subscribe, server.snapshot)
}

// --- Shared pieces: the form's fields and the table ----------------------

function CategoryIcon({ category }: { category: Pick<Category, 'icon' | 'slot'> }) {
  const Icon = ICONS[category.icon]
  return <Icon aria-hidden="true" className={`size-4 shrink-0 ${SLOT_CLASS[category.slot - 1]}`} />
}

type SelectProps<T> = {
  id?: string
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
  // Editing in place opens the list with the field, and closing it gives up.
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function SlotSelect({ id, value, onChange, disabled, defaultOpen, onOpenChange, ...aria }: SelectProps<number>) {
  return (
    <Select
      value={String(value)}
      onValueChange={(next) => next && onChange(Number(next))}
      disabled={disabled}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={defaultOpen ? false : undefined}
    >
      <SelectTrigger id={id} className="w-full" {...aria}>
        <SelectValue>
          {(slot: string) => (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={`size-2.5 rounded-full bg-current ${SLOT_CLASS[Number(slot) - 1]}`} />
              {SLOT_LABELS[Number(slot) - 1]}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SLOT_LABELS.map((label, index) => (
          <SelectItem key={label} value={String(index + 1)}>
            <span aria-hidden="true" className={`size-2.5 rounded-full bg-current ${SLOT_CLASS[index]}`} />
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function IconSelect({ id, value, onChange, disabled, defaultOpen, onOpenChange, ...aria }: SelectProps<IconKey>) {
  return (
    <Select
      value={value}
      onValueChange={(next) => next && onChange(next as IconKey)}
      disabled={disabled}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={defaultOpen ? false : undefined}
    >
      <SelectTrigger id={id} className="w-full" {...aria}>
        <SelectValue>
          {(icon: IconKey) => {
            const Icon = ICONS[icon]
            return (
              <span className="inline-flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4" />
                {ICON_LABELS[icon]}
              </span>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ICONS) as IconKey[]).map((icon) => {
          const Icon = ICONS[icon]
          return (
            <SelectItem key={icon} value={icon}>
              <Icon aria-hidden="true" className="size-4" />
              {ICON_LABELS[icon]}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

// The entity's form fields, the same ones a separate edit page has today.
function CategoryFields({ draft, onChange, nameError, disabled }: { draft: Draft; onChange: (draft: Draft) => void; nameError?: string; disabled: boolean }) {
  const id = useId()
  return (
    <FieldGroup>
      <Field data-invalid={!!nameError}>
        <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
        <Input
          id={`${id}-name`}
          autoFocus
          value={draft.name}
          readOnly={disabled}
          aria-invalid={!!nameError}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
        {nameError && <FieldError>{nameError}</FieldError>}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-colour`}>Colour</FieldLabel>
        <SlotSelect id={`${id}-colour`} value={draft.slot} disabled={disabled} onChange={(slot) => onChange({ ...draft, slot })} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-icon`}>Icon</FieldLabel>
        <IconSelect id={`${id}-icon`} value={draft.icon} disabled={disabled} onChange={(icon) => onChange({ ...draft, icon })} />
      </Field>
    </FieldGroup>
  )
}

function nameCell(category: Category, link?: string) {
  return (
    <span className="inline-flex items-center gap-2 font-medium">
      <CategoryIcon category={category} />
      {link ? (
        <Link to={link} className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          {category.name}
        </Link>
      ) : (
        category.name
      )}
    </span>
  )
}

const colourCell = (category: Category) => (
  <span className="inline-flex items-center gap-2">
    <span aria-hidden="true" className={`size-2.5 rounded-full bg-current ${SLOT_CLASS[category.slot - 1]}`} />
    {SLOT_LABELS[category.slot - 1]}
  </span>
)

function CategoriesTable({ data, columns, toolbar }: { data: Category[]; columns: LegacyColumnDef<Category, unknown>[]; toolbar?: ReactNode }) {
  return (
    <DataTable<Category>
      columns={columns}
      data={data}
      total={data.length}
      page={1}
      pageSize={25}
      onPageChange={() => {}}
      sorting={[]}
      onSortingChange={() => {}}
      isLoading={false}
      emptyTitle="No categories yet"
      getRowId={(row) => String(row.id)}
      pinFirstColumn
      pinLastColumn
      toolbar={toolbar}
    />
  )
}

// --- Options 1 and 2: the form in a dialog or a sheet --------------------

type Target = { kind: 'new' } | { kind: 'edit'; id: number }

// The form's state for a dialog or a sheet: the draft, the server's field
// error, saving, and "Discard your changes?" when closing with edits.
function useFormSurface(server: CategoryServer) {
  const [target, setTarget] = useState<Target | null>(null)
  const [initial, setInitial] = useState<Draft>(BLANK)
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [nameError, setNameError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  const open = useCallback(
    (next: Target) => {
      const record = next.kind === 'edit' ? server.items.find((item) => item.id === next.id) : undefined
      const start = record ? { name: record.name, slot: record.slot, icon: record.icon } : BLANK
      setInitial(start)
      setDraft(start)
      setNameError(undefined)
      setTarget(next)
    },
    [server],
  )
  const close = () => {
    setConfirming(false)
    setTarget(null)
  }
  const requestClose = () => {
    if (saving) return
    if (dirty) setConfirming(true)
    else close()
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!target) return
    if (!draft.name.trim()) return setNameError('Give the category a name')
    setSaving(true)
    setNameError(undefined)
    try {
      if (target.kind === 'edit') await server.save(target.id, { ...draft, name: draft.name.trim() })
      else await server.create({ ...draft, name: draft.name.trim() })
      close()
    } catch (error) {
      setNameError((error as AppError).fieldErrors?.name?.[0] ?? (error as AppError).message)
    } finally {
      setSaving(false)
    }
  }
  const url = target === null ? '/categories' : target.kind === 'new' ? '/categories?new' : `/categories?edit=${target.id}`
  const title = target?.kind === 'new' ? 'New category' : 'Edit category'

  const form = (footer: (buttons: ReactNode) => ReactNode) => (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <CategoryFields draft={draft} onChange={setDraft} nameError={nameError} disabled={saving} />
      {footer(
        <>
          <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Spinner className="size-4" />}
            {target?.kind === 'new' ? 'Create' : 'Save changes'}
          </Button>
        </>,
      )}
    </form>
  )

  const confirm = (
    <Dialog open={confirming} onOpenChange={(next) => !next && setConfirming(false)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Discard your changes?</DialogTitle>
          <DialogDescription>This category has changes that haven't been saved.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={close}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { target, open, requestClose, form, confirm, url, title }
}

function surfaceColumns(open: (target: Target) => void): LegacyColumnDef<Category, unknown>[] {
  return [
    { id: 'name', header: 'Name', cell: ({ row }) => nameCell(row.original) },
    { id: 'colour', header: 'Colour', cell: ({ row }) => colourCell(row.original) },
    { id: 'widgets', header: 'Widgets', cell: ({ row }) => <span className="tabular-nums">{row.original.widgets}</span> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${row.original.name}`} onClick={() => open({ kind: 'edit', id: row.original.id })}>
          <PencilIcon />
        </Button>
      ),
    },
  ]
}

function NewButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <Button onClick={onClick}>
        <PlusIcon />
        New category
      </Button>
    </div>
  )
}

// Columns made once (`open` is stable): new column definitions every
// render remount the cells (DataTable's "stable columns" rule).
function useSurfaceColumns(open: (target: Target) => void) {
  return useMemo(() => surfaceColumns(open), [open])
}

function DialogOption({ server }: { server: CategoryServer }) {
  const data = useServer(server)
  const surface = useFormSurface(server)
  const columns = useSurfaceColumns(surface.open)
  return (
    <Screen url={surface.url}>
      <CategoriesTable data={data} columns={columns} toolbar={<NewButton onClick={() => surface.open({ kind: 'new' })} />} />
      <Dialog open={surface.target !== null} onOpenChange={(next) => !next && surface.requestClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{surface.title}</DialogTitle>
          </DialogHeader>
          {surface.form((buttons) => (
            <DialogFooter>{buttons}</DialogFooter>
          ))}
        </DialogContent>
      </Dialog>
      {surface.confirm}
    </Screen>
  )
}

function SheetOption({ server }: { server: CategoryServer }) {
  const data = useServer(server)
  const surface = useFormSurface(server)
  const columns = useSurfaceColumns(surface.open)
  return (
    <Screen url={surface.url}>
      <CategoriesTable data={data} columns={columns} toolbar={<NewButton onClick={() => surface.open({ kind: 'new' })} />} />
      <Sheet open={surface.target !== null} onOpenChange={(next) => !next && surface.requestClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{surface.title}</SheetTitle>
            <SheetDescription>Saved when you press Save; the table stays beside it.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {surface.form((buttons) => (
              <SheetFooter className="flex-row justify-end px-0">{buttons}</SheetFooter>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      {surface.confirm}
    </Screen>
  )
}

// --- Option 3: every cell edits in place -------------------------------

function RowOption({ server }: { server: CategoryServer }) {
  const data = useServer(server)
  const [store] = useState(() => new EditInPlaceStore())
  const openField = useSyncExternalStore(store.subscribe, () => store.open)
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState<string>()
  const [adding, setAdding] = useState(false)
  const newInput = useRef<HTMLInputElement>(null)

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!newName.trim()) return setNewError('Give the category a name')
    setAdding(true)
    try {
      await server.create({ ...BLANK, name: newName.trim() })
      setNewName('')
      setNewError(undefined)
      newInput.current?.focus()
    } catch (error) {
      setNewError((error as AppError).fieldErrors?.name?.[0])
    } finally {
      setAdding(false)
    }
  }

  // Made once (stable columns): the server is the same for the screen's life.
  const columns = useMemo(() => rowColumns(server), [server])
  return (
    <EditInPlaceContext.Provider value={store}>
      {openField !== null && <LeaveGuard store={store} />}
      <Screen url="/categories">
        <CategoriesTable
          data={data}
          columns={columns}
          toolbar={
            <form onSubmit={add} noValidate className="flex items-start gap-2">
              <Field data-invalid={!!newError} className="w-72">
                <Input
                  ref={newInput}
                  value={newName}
                  readOnly={adding}
                  placeholder="New category's name"
                  aria-label="New category's name"
                  aria-invalid={!!newError}
                  onChange={(event) => setNewName(event.target.value)}
                />
                {newError && <FieldError>{newError}</FieldError>}
              </Field>
              <Button type="submit" variant="outline" disabled={adding}>
                {adding ? <Spinner className="size-4" /> : <PlusIcon />}
                Add
              </Button>
            </form>
          }
        />
      </Screen>
    </EditInPlaceContext.Provider>
  )
}

function rowColumns(server: CategoryServer): LegacyColumnDef<Category, unknown>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <EditableValue
          label={`Name of ${row.original.name}`}
          layout="inline"
          edit={editInPlace<string>({
            kind: 'text',
            value: row.original.name,
            save: (name) => server.save(row.original.id, { name: name.trim() }),
            control: (props) => (
              <Input
                id={props.id}
                value={props.value}
                readOnly={props.disabled}
                aria-invalid={props.invalid || undefined}
                aria-label={props.label}
                aria-describedby={props.describedBy}
                onChange={(event) => props.onChange(event.target.value)}
              />
            ),
          })}
        >
          {nameCell(row.original)}
        </EditableValue>
      ),
    },
    {
      id: 'colour',
      header: 'Colour',
      cell: ({ row }) => (
        <EditableValue
          label={`Colour of ${row.original.name}`}
          layout="inline"
          edit={editInPlace<number>({
            kind: 'choice',
            value: row.original.slot,
            save: (slot) => server.save(row.original.id, { slot }),
            control: (props) => (
              <SlotSelect
                id={props.id}
                value={props.value}
                disabled={props.disabled}
                defaultOpen
                onChange={(slot) => props.commit(slot)}
                onOpenChange={(open) => !open && props.cancel()}
                aria-label={props.label}
                aria-describedby={props.describedBy}
              />
            ),
          })}
        >
          {colourCell(row.original)}
        </EditableValue>
      ),
    },
    {
      id: 'icon',
      header: 'Icon',
      cell: ({ row }) => (
        <EditableValue
          label={`Icon of ${row.original.name}`}
          layout="inline"
          edit={editInPlace<IconKey>({
            kind: 'choice',
            value: row.original.icon,
            save: (icon) => server.save(row.original.id, { icon }),
            control: (props) => (
              <IconSelect
                id={props.id}
                value={props.value}
                disabled={props.disabled}
                defaultOpen
                onChange={(icon) => props.commit(icon)}
                onOpenChange={(open) => !open && props.cancel()}
                aria-label={props.label}
                aria-describedby={props.describedBy}
              />
            ),
          })}
        >
          <span className="inline-flex items-center gap-2">
            <CategoryIcon category={row.original} />
            {ICON_LABELS[row.original.icon]}
          </span>
        </EditableValue>
      ),
    },
    { id: 'widgets', header: 'Widgets', cell: ({ row }) => <span className="tabular-nums">{row.original.widgets}</span> },
  ]
}

// --- Option 4: a small view page per record ------------------------------

const VIEW_LIST_COLUMNS: LegacyColumnDef<Category, unknown>[] = [
  { id: 'name', header: 'Name', cell: ({ row }) => nameCell(row.original, `/view/${row.original.id}`) },
  { id: 'colour', header: 'Colour', cell: ({ row }) => colourCell(row.original) },
  { id: 'widgets', header: 'Widgets', cell: ({ row }) => <span className="tabular-nums">{row.original.widgets}</span> },
]

function ViewOptionList({ server }: { server: CategoryServer }) {
  const data = useServer(server)
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const columns = VIEW_LIST_COLUMNS
  // New makes an untitled record and opens its page, the name ready to type.
  const create = async () => {
    setCreating(true)
    let n = 1
    while (server.items.some((item) => item.name === `Untitled ${n}`)) n++
    const created = await server.create({ ...BLANK, name: `Untitled ${n}` })
    navigate(`/view/${created.id}`)
  }
  return (
    <CategoriesTable
      data={data}
      columns={columns}
      toolbar={
        <div className="flex justify-end">
          <Button onClick={create} disabled={creating}>
            {creating ? <Spinner className="size-4" /> : <PlusIcon />}
            New category
          </Button>
        </div>
      }
    />
  )
}

function ViewOptionPage({ server }: { server: CategoryServer }) {
  const data = useServer(server)
  const id = Number(useLocation().pathname.split('/')[2])
  const category = data.find((item) => item.id === id)
  const save = (change: Partial<Draft>) => server.save(id, change)
  const choice = <T,>(label: string, value: T, Control: ComponentType<SelectProps<T>>, toChange: (value: T) => Partial<Draft>) =>
    editInPlace<T>({
      kind: 'choice',
      value,
      save: (next) => save(toChange(next)),
      control: (props) => (
        <Control
          id={props.id}
          value={props.value}
          disabled={props.disabled}
          defaultOpen
          onChange={(next) => props.commit(next)}
          onOpenChange={(open) => !open && props.cancel()}
          aria-label={label}
          aria-describedby={props.describedBy}
        />
      ),
    })
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/view', label: 'Categories' }}
      title={category?.name}
      titleEdit={
        category && {
          label: 'Name',
          ...editInPlace<string>({
            kind: 'text',
            value: category.name,
            save: (name) => save({ name: name.trim() }),
            control: (props) => (
              <Input
                id={props.id}
                value={props.value}
                readOnly={props.disabled}
                aria-invalid={props.invalid || undefined}
                aria-label={props.label}
                aria-describedby={props.describedBy}
                onChange={(event) => props.onChange(event.target.value)}
              />
            ),
          }),
        }
      }
      sections={
        category
          ? [
              {
                title: 'Details',
                fields: [
                  { label: 'Colour', value: colourCell(category), edit: choice('Colour', category.slot, SlotSelect, (slot) => ({ slot })) },
                  {
                    label: 'Icon',
                    value: (
                      <span className="inline-flex items-center gap-2">
                        <CategoryIcon category={category} />
                        {ICON_LABELS[category.icon]}
                      </span>
                    ),
                    edit: choice('Icon', category.icon, IconSelect, (icon) => ({ icon })),
                  },
                  { label: 'Widgets', value: <span className="tabular-nums">{category.widgets}</span> },
                ],
              },
            ]
          : []
      }
    />
  )
}

function ViewOptionScreen({ children }: { children: ReactNode }) {
  const location = useLocation()
  const onRecord = location.pathname.startsWith('/view/')
  return (
    <Screen url={onRecord ? location.pathname.replace('/view', '/categories') : '/categories'} heading={!onRecord}>
      {children}
    </Screen>
  )
}

// --- The page ------------------------------------------------------------

// A screen as the app shows it, under a bar with the URL it would have.
function Screen({ url, heading = true, children }: { url: string; heading?: boolean; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 border-b bg-muted px-3 py-1.5">
        <span className="type-caption text-muted-foreground">URL</span>
        <code className="type-caption rounded-sm bg-background px-2 py-0.5 font-mono text-foreground">{url}</code>
      </div>
      <div className="flex flex-col gap-4 bg-background p-6">
        {heading && <h2 className="type-page-title text-foreground">Categories</h2>}
        {children}
      </div>
    </div>
  )
}

const OPTIONS = [
  {
    id: 'dialog',
    label: '1. Dialog',
    how: 'The pencil opens the form’s own fields in a dialog over the table; New opens the same dialog empty.',
    notes: [
      'Save/Cancel as on the form today, the server’s field error under the field, and “Discard your changes?” when closing (Esc, ×, outside, Cancel) with edits.',
      'Focus returns to the row’s pencil. The URL can carry ?edit=7, so a link opens the table with the dialog up.',
      'The least new code: today’s form fields, moved into a dialog.',
    ],
  },
  {
    id: 'sheet',
    label: '2. Side sheet',
    how: 'The same form slides in from the right; the table stays visible (dimmed) beside it.',
    notes: [
      'Same guarantees as the dialog, with more room for a longer form later.',
      'On a phone it covers most of the screen, so it reads as a page anyway.',
    ],
  },
  {
    id: 'row',
    label: '3. Edit in the row',
    how: 'Each cell is an editable value (the view page’s kind): click a cell, change it, leave or pick to save. Add sits in the toolbar.',
    notes: [
      'Fastest for changing one thing, with no pencil and no form. Try a duplicate name: the reason shows in the cell.',
      'Create is a different shape (a name box in the toolbar), so the entity has two ways in; the URL can’t point at a record being edited.',
      'The most new structure: editing in place inside DataTable, keyboard paths through cells, axe on every cell state.',
    ],
  },
  {
    id: 'view',
    label: '4. Small view page',
    how: 'The name links to a small page per record, edited in place like the big entities; New makes an untitled one and opens it.',
    notes: [
      'Every record has its own URL, and it reuses EntityView as it is.',
      'Still a separate page, which is what the issue asked to avoid; New creates a record before you’ve typed anything.',
    ],
  },
] as const

function OptionsPage() {
  const [option, setOption] = useState<(typeof OPTIONS)[number]['id']>('dialog')
  // One server per option, so each starts from the same data.
  const [servers] = useState(() => ({ dialog: new CategoryServer(), sheet: new CategoryServer(), row: new CategoryServer(), view: new CategoryServer() }))
  const current = OPTIONS.find(({ id }) => id === option)!
  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="type-page-title text-foreground">#105 Small entities without a separate edit page: options</h1>
        <p className="type-body max-w-3xl text-muted-foreground">
          Each option is a working screen built from the package’s components. Edit a category, create one, try a name
          another category has (“Home”) to see the server’s refusal, and close with unsaved changes. Switch the theme in
          Storybook’s toolbar.
        </p>
      </header>
      <div role="group" aria-label="Option" className="flex flex-wrap gap-1.5">
        {OPTIONS.map(({ id, label }) => (
          <Button key={id} size="sm" variant={id === option ? 'default' : 'outline'} aria-pressed={id === option} onClick={() => setOption(id)}>
            {label}
          </Button>
        ))}
      </div>
      <section aria-label={current.label} className="flex flex-col gap-3">
        <p className="type-body text-foreground">{current.how}</p>
        <ul className="type-caption list-disc pl-5 text-muted-foreground">
          {current.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        {option === 'dialog' && <DialogOption server={servers.dialog} />}
        {option === 'sheet' && <SheetOption server={servers.sheet} />}
        {option === 'row' && <RowOption server={servers.row} />}
        {option === 'view' && (
          <ViewOptionScreen>
            <ViewRoutes server={servers.view} />
          </ViewOptionScreen>
        )}
      </section>
    </div>
  )
}

// Option 4 navigates between the list and a record's page.
function ViewRoutes({ server }: { server: CategoryServer }) {
  const location = useLocation()
  return location.pathname.startsWith('/view/') ? <ViewOptionPage server={server} /> : <ViewOptionList server={server} />
}

// A data router around the whole page: editing in place's leave prompt
// needs one, and option 4 moves between pages.
function InRouter() {
  const [router] = useState(() =>
    // One catch-all route, so moving between option 4's pages keeps the page's own state.
    createMemoryRouter([{ path: '*', element: <OptionsPage /> }]),
  )
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'options/105 Small entity edit',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Options: StoryObj = { render: () => <InRouter /> }
