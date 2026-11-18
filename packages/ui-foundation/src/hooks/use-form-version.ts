// A form's save that doesn't overwrite (add-an-entity.md "Saves that don't
// overwrite", forms): the edit form sends the version of the record it was
// opened with, as editing in place does, so a form left open on a record
// another tab, phone or chat has saved since is refused (a 409, AppError
// kind `conflict`) instead of replacing their save.
//
// - **The form keeps the record it opened with.** `record` is that one,
//   not the query's latest: feed the form's `values` from it, and a
//   refetch in the background (a window focus, another save's
//   invalidation) never resets what's typed. Only Show Saved does, on a
//   click.
// - **`send(update)`** adds the version the form was built on (the app's
//   `withVersion`, the one its `useRecordUpdate` takes).
// - **`refused(error)`**, first in the save's `onError`: true for a
//   conflict, which this hook now shows (the record is fetched again, and
//   `conflict` is set for EntityForm or FormDialog), so the app doesn't
//   also show it as a failed save. Anything else is false and the app
//   handles it as before.
// - **`conflict`** goes to EntityForm's or FormDialog's `conflict`: a
//   warning Notice in the bar, "This changed elsewhere", with Keep Mine
//   (save what's typed over it, now built on the newer version) and Show
//   Saved (the form takes the newer record; what was typed goes, as the
//   Notice says). What's typed stays until one is picked.
// - **`saved(record)`**, in the save's `onSuccess`, when the form stays
//   open after a save (a dialog that doesn't close): the next save builds
//   on the version this one wrote. A form that leaves can skip it.
//
// No `withVersion`, no hook: a form that doesn't use it sends no version
// and behaves as it always has.
import { useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { AppError } from '@/api/contracts'

type RecordId = string | number

/** What EntityForm's and FormDialog's `conflict` take: a save refused because the record changed elsewhere. */
export type FormConflict = {
  /** Save what's typed over the newer version (the form submits again). */
  onKeepMine: () => void
  /** Drop what's typed and show the newer version. */
  onShowSaved: () => void
  /** The newer version is still being fetched: both wait for it. */
  loading?: boolean
}

export type FormVersionOptions<TRecord extends { id: RecordId }, TUpdate> = {
  /** The record as the form's query has it now (its `data`); undefined on a create form or while loading. */
  record: TRecord | undefined
  /**
   * Adds the version to what's sent: `(update, widget) => ({ ...update,
   * baseUpdatedAt: widget.updatedAt })`, the same function the entity's
   * `useRecordUpdate` takes.
   */
  withVersion: (update: TUpdate, record: TRecord) => TUpdate
  /** Fetches the record again (the query's `refetch`), after a 409, so Keep Mine and Show Saved have the newer version. */
  refetch: () => Promise<unknown> | unknown
}

type Phase = 'none' | 'loading' | 'ready'

type Snapshot<TRecord> = {
  /** The record the form shows: what it opened with, or what Show Saved took. */
  opened: TRecord | undefined
  phase: Phase
}

/**
 * The state behind `useFormVersion`, outside React (exported for tests).
 * `latest` is the query's record, kept current by the hook; `opened` the
 * one the form's values came from; `base` the one the next save is built
 * on (Keep Mine moves it to the newer version without touching `opened`).
 */
export class FormVersionStore<TRecord extends { id: RecordId }, TUpdate> {
  private latest: TRecord | undefined
  private base: TRecord | undefined
  private snapshot: Snapshot<TRecord> = { opened: undefined, phase: 'none' }
  private listeners = new Set<() => void>()
  // Bumped by every conflict: a refetch that lands after a newer conflict
  // (or after a pick) doesn't mark it ready.
  private turn = 0

  private withVersion: (update: TUpdate, record: TRecord) => TUpdate
  private refetch: () => Promise<unknown> | unknown

  constructor(withVersion: (update: TUpdate, record: TRecord) => TUpdate, refetch: () => Promise<unknown> | unknown) {
    this.withVersion = withVersion
    this.refetch = refetch
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private set(next: Partial<Snapshot<TRecord>>) {
    this.snapshot = { ...this.snapshot, ...next }
    for (const listener of this.listeners) listener()
  }

  setOptions(withVersion: FormVersionStore<TRecord, TUpdate>['withVersion'], refetch: () => Promise<unknown> | unknown) {
    this.withVersion = withVersion
    this.refetch = refetch
  }

  /**
   * The query's record now. The first one (or one with another id: the
   * form moved to another record) is the one the form opens with; later
   * ones are only remembered, for Keep Mine and Show Saved.
   */
  sync(record: TRecord | undefined) {
    this.latest = record
    if (!record) return
    const opened = this.snapshot.opened
    if (!opened || opened.id !== record.id) {
      this.base = record
      this.turn++
      this.set({ opened: record, phase: 'none' })
    }
  }

  /** The record the form shows, given the query's record this render (before `sync` has run). */
  shown(record: TRecord | undefined): TRecord | undefined {
    const opened = this.snapshot.opened
    if (!record) return opened
    return opened && opened.id === record.id ? opened : record
  }

  /** `update` with the version the form's values were built on. No record yet (a create): unchanged. */
  send(update: TUpdate): TUpdate {
    const base = this.base ?? this.latest
    return base ? this.withVersion(update, base) : update
  }

  /** A save was refused: true when it's a conflict, which this now shows. */
  refused(error: AppError | unknown): boolean {
    if (!error || typeof error !== 'object' || (error as { kind?: unknown }).kind !== 'conflict') return false
    const turn = ++this.turn
    this.set({ phase: 'loading' })
    let fetched: Promise<unknown>
    try {
      fetched = Promise.resolve(this.refetch())
    } catch (failed) {
      fetched = Promise.reject(failed)
    }
    void fetched
      .catch(() => undefined)
      .then((result) => {
        // A TanStack refetch answers with the query's result: its record
        // is the newer version, before the next render syncs it.
        const data = (result as { data?: TRecord } | undefined)?.data
        const opened = this.snapshot.opened
        if (data && typeof data === 'object' && (!opened || data.id === opened.id)) this.latest = data
        // Ready either way: a refetch that failed leaves the older
        // version, and Keep Mine is refused again rather than overwriting.
        if (this.turn === turn) this.set({ phase: 'ready' })
      })
    return true
  }

  /** Keep Mine: the next save is built on the newer version; what's typed stays. */
  keepMine() {
    if (this.snapshot.phase !== 'ready') return
    if (this.latest) this.base = this.latest
    this.turn++
    this.set({ phase: 'none' })
  }

  /** Show Saved: the form takes the newer record (its values reset to it). */
  showSaved() {
    if (this.snapshot.phase !== 'ready') return
    this.base = this.latest ?? this.base
    this.turn++
    this.set({ opened: this.latest ?? this.snapshot.opened, phase: 'none' })
  }

  /** A save went through: the next one builds on what it wrote. What the form shows is unchanged. */
  saved(record: TRecord) {
    this.latest = record
    this.base = record
    this.turn++
    if (this.snapshot.phase !== 'none') this.set({ phase: 'none' })
  }

  /** EntityForm's / FormDialog's `conflict` while one stands. */
  conflict(): FormConflict | undefined {
    const { phase } = this.snapshot
    if (phase === 'none') return undefined
    return { loading: phase === 'loading', onKeepMine: () => this.keepMine(), onShowSaved: () => this.showSaved() }
  }
}

export type FormVersion<TRecord, TUpdate> = {
  /** The record the form was opened with (or Show Saved took): the form's `values` come from it. */
  record: TRecord | undefined
  /** What to send: `update` with that record's version. */
  send: (update: TUpdate) => TUpdate
  /** First in the save's `onError`: true when the save was refused as a conflict, which `conflict` now shows. */
  refused: (error: AppError) => boolean
  /** In the save's `onSuccess` when the form stays open: the next save builds on this one. */
  saved: (record: TRecord) => void
  /** EntityForm's or FormDialog's `conflict`. */
  conflict: FormConflict | undefined
}

/**
 * An edit form's version check (see the top of this file):
 *
 * ```tsx
 * const version = useFormVersion({ record: widgetQuery.data, withVersion, refetch: widgetQuery.refetch })
 * useForm({ values: version.record && widgetToFormValues(version.record) })
 * updateWidget.mutate(version.send(formValuesToWidgetUpdate(values)), {
 *   onError: (error) => { if (!version.refused(error)) setSubmitError(error) },
 * })
 * <EntityForm conflict={version.conflict} … />
 * ```
 */
export function useFormVersion<TRecord extends { id: RecordId }, TUpdate>({
  record,
  withVersion,
  refetch,
}: FormVersionOptions<TRecord, TUpdate>): FormVersion<TRecord, TUpdate> {
  const [store] = useState(() => new FormVersionStore(withVersion, refetch))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useLayoutEffect(() => {
    store.setOptions(withVersion, refetch)
    store.sync(record)
  })
  // Before the effect has synced a new record: the one the form opened
  // with when it's the same record, else the new one.
  const { opened, phase } = snapshot
  const shown = !record ? opened : opened && opened.id === record.id ? opened : record
  return useMemo(
    () => ({
      record: shown,
      send: (update: TUpdate) => store.send(update),
      refused: (error: AppError) => store.refused(error),
      saved: (saved: TRecord) => store.saved(saved),
      conflict:
        phase === 'none'
          ? undefined
          : { loading: phase === 'loading', onKeepMine: () => store.keepMine(), onShowSaved: () => store.showSaved() },
    }),
    [store, shown, phase],
  )
}
