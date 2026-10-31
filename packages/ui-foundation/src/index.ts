// `@tristan2828/ui-foundation` — the foundation-owned layer every app shares.
// Primitives are imported one per path (`@tristan2828/ui-foundation/ui/button`);
// the gateway seam, MSW support and Playwright suites have their own entry
// points (`/gateway`, `/mocks`, `/testing`) so each stays behind its boundary.

// Composites
export {
  AppShell,
  type AppShellProps,
  type AppShellVersion,
  type BottomBarItem,
  type NavEntry,
  type NavItem,
  type NavSection,
} from '@/components/app/app-shell'
export type { IconComponent } from '@/components/app/icon-component'
export { Board, type BoardColumn, type BoardMoveTarget, type BoardProps } from '@/components/app/board'
export { SpinWheel, type SpinWheelProps } from '@/components/app/spin-wheel'
export { pickSpinWheelIndex, type SpinWheelItem } from '@/components/app/spin-wheel-pick'
export {
  FillInChoice,
  FillInQueue,
  type FillInChoiceProps,
  type FillInQueueProgress,
  type FillInQueueProps,
} from '@/components/app/fill-in-queue'
export {
  Artwork,
  ArtworkTag,
  ArtworkToggle,
  type ArtworkAspect,
  type ArtworkProps,
  type ArtworkToggleProps,
} from '@/components/app/artwork'
export { CountLink, type CountLinkProps } from '@/components/app/count-link'
export {
  DataTable,
  type DataTableCardLayout,
  type DataTableGrouping,
  type DataTableProps,
  type DataTableTotals,
  type DataTableWidth,
  type SortingState,
} from '@/components/app/data-table'
export { type RowGroup } from '@/components/app/table-groups'
export { byDay, type ByDayOptions } from '@/lib/group-by-day'
export { EntityForm, type EntityFormProps } from '@/components/app/entity-form'
export { KeyStats, type KeyStat, type KeyStatsProps } from '@/components/app/key-stats'
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
  type EditInPlaceList,
  type EditInPlaceListOptions,
  type EditInPlaceOptions,
  type EditKind,
  type EditListAddProps,
  type EditListItemProps,
} from '@/components/app/edit-in-place'
export { DataEnvironmentBanner } from '@/components/app/data-environment-banner'
export { EditableValue, type EditableValueProps } from '@/components/app/editable-value'
export { ErrorState } from '@/components/app/error-state'
export { InlineCreate, type InlineCreateProps } from '@/components/app/inline-create'
export { FoundationProviders } from '@/components/app/foundation-providers'
export { Markdown, type MarkdownProps } from '@/components/app/markdown'
export type { HeadingFrom, HeadingLevel } from '@/components/app/prose-look'
export { MockModeBanner } from '@/components/app/mock-mode-banner'
export { MultiChoice } from '@/components/app/multi-choice'
export { MultiPick, type MultiPickOption, type MultiPickProps } from '@/components/app/multi-pick'
export { MultiReference } from '@/components/app/multi-reference'
export { ListEditor } from '@/components/app/list-editor'
export { PasswordInput } from '@/components/app/password-input'
export { RichTextEditor, type RichTextEditorProps } from '@/components/app/rich-text-editor'
export { RouteErrorBoundary } from '@/components/app/route-error-boundary'
export { PillFilter, type PillFilterOption, type PillFilterProps } from '@/components/app/pill-filter'
export { SecondaryFilters, type ActiveFilter, type SecondaryFiltersProps } from '@/components/app/secondary-filters'
export {
  SessionStage,
  SessionView,
  sessionStageLit,
  sessionStageMain,
  sessionStageQuiet,
  type SessionStageProps,
  type SessionStageTone,
  type SessionViewProps,
} from '@/components/app/session-view'
export { AllowReminders, type AllowRemindersProps } from '@/components/app/allow-reminders'
export {
  StageCircle,
  type StageCircleProps,
  type StageCircleStage,
  type StageCircleTone,
} from '@/components/app/stage-circle'
export { Notice, type NoticeProps, type NoticeTone } from '@/components/app/notice'
export { SourceCredit, type Source, type SourceCreditProps } from '@/components/app/source-credit'
export { ProgressRing, type ProgressRingProps } from '@/components/app/progress-ring'
export {
  LineChart,
  type LineChartMark,
  type LineChartPoint,
  type LineChartProps,
} from '@/components/app/line-chart'
export { StepBar, type StepBarProps } from '@/components/app/step-bar'
export { RatingStar, type RatingStarProps, type RatingStarValue } from '@/components/app/rating-star'
export { DateField, type DateFieldProps } from '@/components/app/date-field'
export { ImageField, type ImageFieldProps } from '@/components/app/image-field'
export { DEFAULT_IMAGE_TYPES, type ImageUpload, type ImageUploadResult } from '@/lib/image-file'
export { formatPlainDate, type PlainDate } from '@/lib/plain-date'
export {
  ChoiceCell,
  LinkCell,
  NameCell,
  type ChoiceCellProps,
  type LinkCellProps,
  type NameCellProps,
} from '@/components/app/row-edit-cells'
export {
  ModuleCard,
  ModuleStrip,
  type CategorySlot,
  type ModuleCardLink,
  type ModuleCardPlace,
  type ModuleCardProps,
  type ModuleStripProps,
} from '@/components/app/module-card'
export {
  WidgetCard,
  WidgetCardGroup,
  WidgetList,
  WidgetListItem,
  type WidgetCardGroupProps,
  type WidgetCardLink,
  type WidgetCardProps,
  type WidgetListItemProps,
} from '@/components/app/widget-card'
export { WidgetLayoutSheet, type WidgetLayoutSheetProps } from '@/components/app/widget-layout-sheet'
export { ThemeProvider } from '@/components/theme-provider'

// Screens outside the app shell
export { LoginRoute, type LoginRouteProps } from '@/routes/login'
export { RegisterRoute } from '@/routes/register'
export { returnPath } from '@/routes/return-path'

// Auth — useAuth() is the only way to read it; the provider's internals stay private.
export { AuthProvider, useAuth } from '@/auth/use-auth'
export type { AuthContextValue, AuthStatus, AuthUser, SignInResult } from '@/auth/auth-context'

// Data layer contracts
export type { AppError, Page, QuerySpec } from '@/api/contracts'
export type { ErrorReportingOptions } from '@/error-reporting/reporter'
export { createQueryClient } from '@/api/query-client'

// Hooks
export { useTableUrlState, type TableUrlStateOptions } from '@/hooks/use-table-url-state'
export { useTableLayout, type TableLayoutOptions } from '@/hooks/use-table-layout'
export {
  useWidgetLayout,
  createWidgetLayoutStore,
  mergeWidgetLayout,
  type SavedWidgetLayout,
  type WidgetLayout,
  type WidgetLayoutOptions,
  type WidgetLayoutStore,
} from '@/hooks/use-widget-layout'
export type { TableView, UrlChanges } from '@/hooks/table-url-changes'
export { useDebouncedValue } from '@/hooks/use-debounced-value'
export { useDocumentTitle } from '@/hooks/use-document-title'
export {
  useRecordUpdate,
  type RecordChange,
  type RecordUpdateOptions,
} from '@/hooks/use-record-update'
export { useIsMobile } from '@/hooks/use-mobile'
// Timed screens (docs/foundation/timed-screens.md)
export { useWakeLock } from '@/hooks/use-wake-lock'
export {
  useSessionClock,
  type SessionClock,
  type SessionClockOptions,
  type SessionClockState,
  type SessionStatus,
} from '@/hooks/use-session-clock'
export { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
export { useMuted } from '@/hooks/use-muted'
export {
  createPushController,
  usePushPermission,
  type PushController,
  type PushControllerOptions,
  type PushEnvironment,
  type PushPermission,
  type PushStatus,
} from '@/hooks/use-push-permission'

// Utilities
export { cn } from '@/lib/utils'
export {
  canVibrate,
  cancelCues,
  chime,
  cuesInSync,
  hush,
  onCuesRecovered,
  say,
  sequence,
  unlockAudio,
  vibrate,
  type ChimeOptions,
  type Cue,
  type CueTime,
  type SayOptions,
  type SequenceOptions,
} from '@/lib/audio-cues'
export {
  keepAudioAlive,
  type KeepAudioAlive,
  type KeepAudioAliveOptions,
} from '@/lib/keep-audio-alive'
