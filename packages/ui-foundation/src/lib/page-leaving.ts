// The page is going away (closing the tab, hidden on a phone): requests
// started now ask the browser to finish them after the page is gone
// (`keepalive`), so the last autosave still arrives. LeaveGuard
// marks it; the transport reads it. Only a body that fits the browser's
// keepalive budget (64 KB across the page's keepalive requests) goes
// that way: a longer note's save goes as an ordinary request, which the
// leave prompt (`beforeunload`) gives time to finish.

/** Under the browser's 64 KB keepalive budget, with room for a second save. */
export const KEEPALIVE_MAX_BYTES = 30_000

// How long after the mark a request still counts as made while leaving:
// the save goes through the mutation queue first.
const LEAVING_FOR_MS = 2_000

let leavingUntil = 0

/** The page is closing or hidden: requests started in the next moment use `keepalive`. */
export function markPageLeaving(now = Date.now()) {
  leavingUntil = now + LEAVING_FOR_MS
}

/** The page is back (visible again): requests are ordinary again. */
export function clearPageLeaving() {
  leavingUntil = 0
}

/** Whether a request with this body, started now, should be sent with `keepalive`. */
export function keepaliveFor(body: unknown, now = Date.now()): boolean {
  if (now >= leavingUntil) return false
  // A save's JSON; nothing else (a GET, an upload's form) needs it.
  if (typeof body !== 'string') return false
  return new TextEncoder().encode(body).length <= KEEPALIVE_MAX_BYTES
}
