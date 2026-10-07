import { DatabaseIcon } from 'lucide-react'
import { useDataLabel } from '@/hooks/use-data-label'

// The real backend, on data that isn't production's: a dev branch of the
// hosted database, a local one. Locally the app looks exactly like the
// deployed one (same data, same login), and an edit made there lands in
// data that gets reset. Only the backend knows which database it's on, so
// the label is its DATA_LABEL, served from GET /environment. Unset in
// production: no label, no banner.
//
// Rendered above the router, inside FoundationProviders (it queries
// through TanStack Query), so it shows on every route including /login.
// In mock mode the mock handler answers null: MockModeBanner already says
// what the data is there.
export function DataEnvironmentBanner() {
  const label = useDataLabel()
  return <DataEnvironmentNotice label={label} />
}

/** The banner itself, for a label already known (Storybook, tests). Renders nothing for null. */
export function DataEnvironmentNotice({ label }: { label: string | null }) {
  if (label === null) return null

  return (
    // role="status" for the same reason as MockModeBanner's: a status
    // message, which axe's landmark-region rule exempts. bg-info, not the
    // mock banner's bg-warning, so the two never read as the same thing;
    // like it, a solid fill that stands apart from the rest of the UI.
    <div
      role="status"
      data-slot="data-environment-banner"
      className="flex h-9 items-center justify-center gap-1.5 border-b border-border bg-info px-4 text-sm text-info-foreground"
    >
      <DatabaseIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">
        <strong className="font-semibold">{`${dataName(label)}:`}</strong> changes here don&apos;t reach production
      </span>
    </div>
  )
}

// "dev" → "Dev data", "staging" → "Staging data".
function dataName(label: string): string {
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} data`
}
