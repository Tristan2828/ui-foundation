import { FlaskConicalIcon } from 'lucide-react'
import { IS_MOCK_MODE } from '@/lib/mock-mode'

// Rendered above the router, so it shows on every route including /login —
// which is the point. MSW's seeded user and small fixed fixture look
// identical to a real signed-in session at a glance, and in the first app
// built on this registry that cost a real user real time chasing what
// looked like a broken login before realising they were on the mock dev
// server rather than the backend origin.
export function MockModeBanner() {
  if (!IS_MOCK_MODE) return null

  return (
    // role="status": axe's landmark-region rule wants all page content
    // inside a landmark but exempts live-region roles, which is the right
    // fit anyway — this is a status message, not a page section.
    //
    // A solid bg-warning rather than the muted tokens used elsewhere is
    // deliberate: this has to read as *different* from the rest of the UI
    // at a glance, not blend into it.
    <div
      role="status"
      className="flex h-9 items-center justify-center gap-1.5 border-b border-border bg-warning px-4 text-sm font-semibold text-warning-foreground"
    >
      <FlaskConicalIcon className="size-4" aria-hidden="true" />
      Mock data — not connected to the real backend
    </div>
  )
}
