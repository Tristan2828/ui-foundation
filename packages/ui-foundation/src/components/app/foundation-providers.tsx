import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { createQueryClient } from '@/api/query-client'
import { AuthProvider } from '@/auth/use-auth'
import { MockModeBanner } from '@/components/app/mock-mode-banner'
import { ThemeProvider } from '@/components/theme-provider'
import { PaletteProvider } from '@/components/app/palette-provider'
import { RowsProvider } from '@/components/app/rows-provider'
import { paletteColorScheme, type AppPaletteName } from '@/lib/palettes'
import { ErrorReportingProvider } from '@/error-reporting/error-reporting-provider'
import { resolveErrorReporting, type ErrorReportingOptions } from '@/error-reporting/reporter'
import { browserStaleChunkReload } from '@/lib/stale-chunk-reload'

// Everything an app's root needs around its router, in the order that
// works: the theme outermost (and the palette, which forces it dark, or light for a light one), the mock-mode banner above the router so it
// shows on every route (/login included), and AuthProvider inside
// QueryClientProvider because it queries /auth/me through TanStack Query.
// An app's DataEnvironmentBanner goes first among the children, before its
// router: it queries too, and shows on every route like the mock banner.
// It also reloads the page once when a lazy chunk is gone after a deploy
// (lib/stale-chunk-reload.ts), so no app adds its own listener.
export function FoundationProviders({
  mockMode,
  queryClient,
  errorReporting,
  palette,
  palettePicker = false,
  rowsPicker = false,
  children,
}: {
  /** Whether the API is served by MSW — the app's own IS_MOCK_MODE. */
  mockMode: boolean
  /** Defaults to createQueryClient(); pass one to share it with code outside React. */
  queryClient?: QueryClient
  /**
   * Off by default. On, crashes, uncaught errors and server failures are
   * posted to the app's own POST /api/client-errors (while signed in),
   * which forwards them; see docs/deploy.md "Error reporting" for what a
   * report holds and never holds. `{ release }` names the build.
   */
  errorReporting?: boolean | ErrorReportingOptions
  /**
   * The app's palette (design-language.md "Palettes"). With one, the app
   * is always dark in that palette and the shell has no light/dark
   * toggle; printed notes still print light. A light palette
   * (`'palm-lcd'`), which an app opts into only here, forces light
   * instead. Without, light and dark follow the system, as before.
   */
  palette?: AppPaletteName
  /**
   * With `palette`: the shell offers all four palettes, and the one picked
   * is remembered on this device. A new device starts on `palette`.
   * Ignored with a light palette, which is never in the picker.
   */
  palettePicker?: boolean
  /**
   * The shell's look menu offers the table rows, Compact (the default) or
   * Regular, remembered on this device (design-language.md "Density",
   * "Rows on this device"). Off, every device is compact.
   */
  rowsPicker?: boolean
  children: ReactNode
}) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  const reporting = resolveErrorReporting(errorReporting)
  useEffect(() => browserStaleChunkReload().install(window), [])
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem forcedTheme={palette ? paletteColorScheme(palette) : undefined}>
      <PaletteProvider palette={palette} picker={palettePicker}>
      <RowsProvider picker={rowsPicker}>
      <MockModeBanner active={mockMode} />
      <QueryClientProvider client={client}>
        <AuthProvider>
          {reporting ? <ErrorReportingProvider options={reporting}>{children}</ErrorReportingProvider> : children}
        </AuthProvider>
      </QueryClientProvider>
      </RowsProvider>
      </PaletteProvider>
    </ThemeProvider>
  )
}
