import { useEffect, useState, useSyncExternalStore } from 'react'

// A clock for a screen that counts down or paces something for minutes.
// Elapsed time is read from the clock each animation frame, never added up
// from ticks, so it doesn't drift and a pause resumes exactly where it
// stopped: the time between pause and resume is banked, not counted.
// Reading the time each frame is also what makes Playwright's
// `clock.fastForward()` land a test on the right state
// (docs/foundation/timed-screens.md).
//
// A hidden tab draws no frames, so while it's hidden a slow timer reads
// the time instead (once a second, or as often as the browser lets a
// background tab's timers run), enough for a countdown in the tab's
// title; the first frame back catches up exactly (#193). A run can start
// from a given elapsed time and seek, for a run resumed from storage and
// for Skip and Back.
//
// The rules live in createSessionClock, React-free, so they're unit tested
// against a fake clock (tests/use-session-clock.test.ts).

export type SessionStatus = 'idle' | 'running' | 'done'

export type SessionClockState = {
  /** Milliseconds counted so far, paused time left out; `endsAt` at most. */
  elapsed: number
  /** `idle` until `start()`, `running` until `endsAt` is reached, then `done`. */
  status: SessionStatus
  /** Paused by `pause()`, while running. */
  paused: boolean
}

export type SessionClockStore = {
  /** Starts counting from `from` milliseconds (default 0), from any state. */
  start: (from?: number) => void
  /**
   * Moves a running clock to `elapsed` milliseconds, paused or not, without
   * changing either; at or past `endsAt` it's `done`. Ignored while idle or
   * done: `start(from)` begins again from a time.
   */
  seek: (elapsed: number) => void
  pause: () => void
  resume: () => void
  /** Back to `idle` at zero. */
  stop: () => void
  /** Whether time may count at all (the hook's `running`); false holds the clock still without pausing it. */
  setRunning: (running: boolean) => void
  setEndsAt: (endsAt: number | undefined) => void
  /** Reads the time; the hook calls it each animation frame. */
  tick: () => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => SessionClockState
}

export function createSessionClock(now: () => number): SessionClockStore {
  let status: SessionStatus = 'idle'
  let paused = false
  let running = true
  let endsAt: number | undefined
  // Time counted before the current stretch, and when that stretch began
  // (null while time isn't counting).
  let banked = 0
  let since: number | null = null
  let snapshot: SessionClockState = { elapsed: 0, status, paused }
  const listeners = new Set<() => void>()

  const counting = () => status === 'running' && !paused && running
  const bank = () => {
    if (since === null) return
    banked += now() - since
    since = null
  }
  const begin = () => {
    if (counting() && since === null) since = now()
  }
  const clamp = (ms: number) => Math.min(Math.max(Number.isFinite(ms) ? ms : 0, 0), endsAt ?? Infinity)

  const update = () => {
    let elapsed = banked + (since === null ? 0 : now() - since)
    if (status === 'running' && endsAt !== undefined && elapsed >= endsAt) {
      status = 'done'
      paused = false
      since = null
      banked = endsAt
      elapsed = endsAt
    }
    if (elapsed === snapshot.elapsed && status === snapshot.status && paused === snapshot.paused) return
    snapshot = { elapsed, status, paused }
    for (const listener of listeners) listener()
  }

  return {
    start(from = 0) {
      status = 'running'
      paused = false
      banked = clamp(from)
      since = null
      begin()
      update()
    },
    seek(elapsed) {
      if (status !== 'running') return
      banked = clamp(elapsed)
      since = null
      begin()
      update()
    },
    pause() {
      if (status !== 'running' || paused) return
      bank()
      paused = true
      update()
    },
    resume() {
      if (status !== 'running' || !paused) return
      paused = false
      begin()
      update()
    },
    stop() {
      status = 'idle'
      paused = false
      banked = 0
      since = null
      update()
    },
    setRunning(next) {
      if (next === running) return
      bank()
      running = next
      begin()
      update()
    },
    setEndsAt(next) {
      endsAt = next
      update()
    },
    tick: update,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
  }
}

export type SessionClockOptions = {
  /**
   * Whether time may count (default true). False holds the clock still
   * without pausing it: for time the session isn't on screen at all, such
   * as its view closed or a confirmation in front of it.
   */
  running?: boolean
  /** The elapsed milliseconds at which the session is `done`. Without it, it runs until stopped. */
  endsAt?: number
}

export type SessionClock = SessionClockState &
  Pick<SessionClockStore, 'seek' | 'pause' | 'resume' | 'stop'> & {
    /** Starts counting from zero, from any state (a click handler as is). */
    start: () => void
    /** Starts counting from `elapsed` milliseconds: a run resumed from storage. */
    startFrom: (elapsed: number) => void
  }

// How often a hidden tab reads the time. Browsers slow a background tab's
// timers (Chrome to once a minute after a while), so this is at most.
const HIDDEN_TICK_MS = 1000

/**
 * A drift-free clock with pause and resume, read from `performance.now()`
 * each animation frame. It re-renders once per frame only while counting.
 * A hidden tab draws no frames, but its time still counts: while hidden it
 * re-renders on a slow tick (once a second at most, for a countdown in the
 * tab's title), and coming back catches up exactly (and reaches `done` if
 * it's due). `startFrom(ms)` and `seek(ms)` begin from, and move to, a
 * given elapsed time.
 */
export function useSessionClock({ running = true, endsAt }: SessionClockOptions = {}): SessionClock {
  const [clock] = useState(() => createSessionClock(() => performance.now()))
  const state = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot)

  useEffect(() => clock.setRunning(running), [clock, running])
  useEffect(() => clock.setEndsAt(endsAt), [clock, endsAt])

  const counting = state.status === 'running' && !state.paused && running
  useEffect(() => {
    if (!counting) return
    let frame = requestAnimationFrame(function next() {
      clock.tick()
      frame = requestAnimationFrame(next)
    })
    let hiddenTick: ReturnType<typeof setInterval> | undefined
    const onVisibility = () => {
      clearInterval(hiddenTick)
      hiddenTick = document.hidden ? setInterval(clock.tick, HIDDEN_TICK_MS) : undefined
      clock.tick()
    }
    if (document.hidden) hiddenTick = setInterval(clock.tick, HIDDEN_TICK_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(hiddenTick)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [clock, counting])

  const [start] = useState(() => () => clock.start())
  return { ...state, start, startFrom: clock.start, seek: clock.seek, pause: clock.pause, resume: clock.resume, stop: clock.stop }
}
