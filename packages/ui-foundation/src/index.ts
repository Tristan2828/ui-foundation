// `@tristan2828/ui-foundation` — the foundation-owned layer every app shares.
// Primitives are imported one per path (`@tristan2828/ui-foundation/ui/button`);
// the gateway seam, MSW support and Playwright suites have their own entry
// points (`/gateway`, `/mocks`, `/testing`) so each stays behind its boundary.

// Composites
export { AppShell, type AppShellProps, type NavItem } from '@/components/app/app-shell'
export { CountLink, type CountLinkProps } from '@/components/app/count-link'
export { DataTable, type DataTableProps, type SortingState } from '@/components/app/data-table'
export { EntityForm, type EntityFormProps } from '@/components/app/entity-form'
export {
  EntityView,
  type EntityViewField,
  type EntityViewLayout,
  type EntityViewPlacement,
  type EntityViewProps,
  type EntityViewSection,
} from '@/components/app/entity-view'
export {
  editInPlace,
  type EditControlProps,
  type EditInPlace,
  type EditInPlaceOptions,
  type EditKind,
} from '@/components/app/edit-in-place'
export { DataEnvironmentBanner } from '@/components/app/data-environment-banner'
export { EditableValue, type EditableValueProps } from '@/components/app/editable-value'
export { ErrorState } from '@/components/app/error-state'
export { FoundationProviders } from '@/components/app/foundation-providers'
export { Markdown, type MarkdownProps } from '@/components/app/markdown'
export { MockModeBanner } from '@/components/app/mock-mode-banner'
export { MultiChoice } from '@/components/app/multi-choice'
export { MultiReference } from '@/components/app/multi-reference'
export { ListEditor } from '@/components/app/list-editor'
export { PasswordInput } from '@/components/app/password-input'
export { RichTextEditor, type RichTextEditorProps } from '@/components/app/rich-text-editor'
export { RouteErrorBoundary } from '@/components/app/route-error-boundary'
export { SecondaryFilters, type ActiveFilter, type SecondaryFiltersProps } from '@/components/app/secondary-filters'
export {
  StageCircle,
  type StageCircleProps,
  type StageCircleStage,
  type StageCircleTone,
} from '@/components/app/stage-circle'
export { ThemeProvider } from '@/components/theme-provider'

// Screens outside the app shell
export { LoginRoute, type LoginRouteProps } from '@/routes/login'
export { RegisterRoute } from '@/routes/register'
export { returnPath } from '@/routes/return-path'

// Auth — useAuth() is the only way to read it; the provider's internals stay private.
export { AuthProvider, useAuth } from '@/auth/use-auth'
export type { AuthContextValue, AuthStatus, AuthUser } from '@/auth/auth-context'

// Data layer contracts
export type { AppError, Page, QuerySpec } from '@/api/contracts'
export { createQueryClient } from '@/api/query-client'

// Hooks
export { useTableUrlState } from '@/hooks/use-table-url-state'
export type { TableView, UrlChanges } from '@/hooks/table-url-changes'
export { useDebouncedValue } from '@/hooks/use-debounced-value'
export {
  useRecordUpdate,
  type RecordChange,
  type RecordUpdateOptions,
} from '@/hooks/use-record-update'
export { useIsMobile } from '@/hooks/use-mobile'

// Utilities
export { cn } from '@/lib/utils'
