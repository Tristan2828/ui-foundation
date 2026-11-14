// `@tristan2828/ui-foundation` — the foundation-owned layer every app shares.
// Primitives are imported one per path (`@tristan2828/ui-foundation/ui/button`);
// the gateway seam, MSW support and Playwright suites have their own entry
// points (`/gateway`, `/mocks`, `/testing`) so each stays behind its boundary.

// Composites
export {
  AppShell,
  type AppShellProps,
  type AppShellSearch,
  type RecentRecord,
  type SearchRecord,
  type AppShellVersion,
  type BottomBarItem,
  type NavEntry,
  type NavItem,
  type NavLook,
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
  type FillInQueueGroup,
  type FillInQueueProgress,
  type FillInQueueProps,
} from '@/components/app/fill-in-queue'
export {
  FillInField,
  FillInInput,
  FillInSelect,
  type FillInFieldKind,
  type FillInFieldProps,
  type FillInFieldSpec,
  type FillInInputKind,
  type FillInInputProps,
  type FillInSelectProps,
  type FillInSuggestion,
  type FillInValue,
} from '@/components/app/fill-in-field'
export {
  Artwork,
  ArtworkTag,
  ArtworkToggle,
  type ArtworkAspect,
  type ArtworkProps,
  type ArtworkToggleProps,
} from '@/components/app/artwork'
export { ColorSwatch, type ColorSwatchProps } from '@/components/app/color-swatch'
export { storedColor } from '@/lib/stored-color'
export { CountLink, type CountLinkProps } from '@/components/app/count-link'
export {
  DataTable,
  type DataTableCardLayout,
  type DataTableOpens,
  type DataTableOpensKind,
  type DataTableGrouping,
  type DataTableLook,
  type DataTableProps,
  type DataTableTotals,
  type DataTableWidth,
  type SortingState,
} from '@/components/app/data-table'
export {
  type DataTableColumnsMenu,
  type DataTablePhoneRow,
  type DataTableRowAction,
  type DataTableView,
  type DataTableViewAll,
} from '@/components/app/data-table-tools'
export { RelatedTable, type RelatedTableProps } from '@/components/app/related-table'
export { type RowGroup } from '@/components/app/table-groups'
export { byDay, type ByDayOptions } from '@/lib/group-by-day'
export { EntityForm, type EntityFormProps } from '@/components/app/entity-form'
export { countFormErrors } from '@/lib/form-errors'
export { FormSection, type FormSectionProps } from '@/components/app/form-section'
export { OptionSelect, type OptionSelectOption, type OptionSelectProps } from '@/components/app/option-select'
export { ChoiceButtons, type ChoiceButtonsOption, type ChoiceButtonsProps } from '@/components/app/choice-buttons'
export { ReferenceCombobox, type ReferenceComboboxProps, type ReferenceRecord } from '@/components/app/reference-combobox'
export { fieldRows, type FieldKind, type FieldRowItem, type FieldRowPlace, type FieldSize } from '@/lib/field-rows'
export { KeyStats, type KeyStat, type KeyStatsProps } from '@/components/app/key-stats'
export { StatusMark, type StatusMarkProps } from '@/components/app/status-mark'
export {
  STATUS_KINDS,
  STATUS_KIND_ICONS,
  STATUS_KIND_LABELS,
  STATUS_KIND_TONES,
  type StatusKind,
} from '@/lib/status-kinds'
// The record's empty value (4.96): a muted dash read as "Not set", for an
// app's own strips, summary lines and cells.
export { EmptyText, type EmptyTextProps } from '@/components/app/empty-value'
export { isEmptyValue } from '@/lib/empty-value'
export { IconAction, type IconActionProps } from '@/components/app/icon-action'
export {
  EntityView,
  type EntityViewEmptyFields,
  type EntityViewField,
  type EntityViewLayout,
  type EntityViewMobileOrder,
  type EntityViewPlacement,
  type EntityViewProps,
  type EntityViewRailFields,
  type EntityViewSection,
} from '@/components/app/entity-view'
export {
  type EntityViewFact,
  type EntityViewFactAction,
  type EntityViewFactBadge,
  type EntityViewFactListItem,
  type EntityViewFactValue,
} from '@/components/app/entity-view-facts'
export { entityViewTabSlug } from '@/lib/entity-view-tab'
export { usePrinting } from '@/components/app/print-context'
export {
  RecordDialogRoute,
  RecordLink,
  type RecordDialogRouteProps,
  type RecordLinkProps,
} from '@/components/app/record-dialog'
export {
  recordDialogState,
  useNewRecordDialog,
  useOpenRecord,
  useRecordDialog,
  type NewRecordDialogContextValue,
  type RecordDialogBackground,
  type RecordDialogContextValue,
  type RecordDialogState,
} from '@/components/app/record-dialog-context'
export { FormDialog, type FormDialogProps } from '@/components/app/form-dialog'
// The dialogs and feedback standard (4.90): one delete, toasts' words, an
// action's error beside it, a job's progress, and the offline bar.
export { DeleteAction, type DeleteActionProps, type DeleteKind, type DeleteReason } from '@/components/app/delete-action'
export { notify, doneMessage, pastTense, type NotifyDoneOptions } from '@/components/app/notify'
export { useAction, type ActionOutcome, type ActionState, type UseActionOptions } from '@/hooks/use-action'
export { ActionError, type ActionErrorProps } from '@/components/app/action-error'
export { JobStatus, type JobProgress, type JobStatusProps } from '@/components/app/job-status'
export { OfflineNotice, type OfflineNoticeProps } from '@/components/app/offline-notice'
export { useOffline } from '@/lib/connection'
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
export {
  inPlace,
  type InPlaceDateConfig,
  type InPlaceFieldsOptions,
  type InPlaceLinkConfig,
  type InPlaceLinkValue,
  type InPlaceMoneyConfig,
  type InPlaceMonthDayConfig,
  type InPlaceNumberConfig,
  type InPlaceOption,
  type InPlacePart,
  type InPlaceRecord,
  type InPlaceRecurrenceConfig,
  type InPlaceReferenceConfig,
  type InPlaceSaved,
  type InPlaceSelectConfig,
  type InPlaceTextConfig,
} from '@/components/app/edit-in-place-presets'
export { linkHost, linkHref, linkRule } from '@/lib/link-href'
export { TITLE_CASE_SMALL_WORDS, titleCase } from '@/lib/title-case'
export { DataEnvironmentBanner } from '@/components/app/data-environment-banner'
export { EditableValue, type EditableValueProps } from '@/components/app/editable-value'
export { editRowClass, onEditRowClick, SAVED_FOR_MS } from '@/components/app/edit-row'
export { ErrorState } from '@/components/app/error-state'
export { InlineCreate, type InlineCreateProps } from '@/components/app/inline-create'
export { FoundationProviders } from '@/components/app/foundation-providers'
export { Markdown, type MarkdownProps } from '@/components/app/markdown'
export { PageTrail, type PageCrumb, type PageTrailProps } from '@/components/app/page-trail'
export { usePageTrail } from '@/components/app/page-trail-context'
export { useRecentRecord } from '@/hooks/use-recent-record'
export type { CreatePage, PageLinkInfo, PageLinkResolver } from '@/lib/page-link'
export { countTasks, toggleTaskAt, type TaskCount } from '@/lib/markdown-tasks'
export { NotesOutline, type NotesOutlineProps } from '@/components/app/notes-outline'
export type { HeadingFrom, HeadingLevel, TableLook } from '@/components/app/prose-look'
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
  FilterBar,
  FilterSelect,
  type FilterBarProps,
  type FilterBarSearch,
  type FilterSelectOption,
  type FilterSelectProps,
} from '@/components/app/filter-bar'
export { FilterDate, type FilterDateProps } from '@/components/app/filter-date'
export { FactList, FactListItem, type FactListItemProps, type FactListProps } from '@/components/app/fact-list'
export {
  DATE_FILTER_PRESETS,
  DATE_FILTER_PRESET_LABELS,
  dateFilterKeeps,
  dateFilterText,
  dateRangeValue,
  parseDateFilter,
  resolveDateFilter,
  type DateFilter,
  type DateFilterBounds,
  type DateFilterPreset,
} from '@/lib/date-filter'
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
export { ValueList, type ValueListItem, type ValueListProps } from '@/components/app/value-list'
export {
  ListHeader,
  type ListHeaderAction,
  type ListHeaderLink,
  type ListHeaderProps,
  type ListHeaderSibling,
} from '@/components/app/list-header'
export { Timeline, type TimelineItem, type TimelineProps } from '@/components/app/timeline'
export {
  EqualItems,
  type EqualItem,
  type EqualItemField,
  type EqualItemState,
  type EqualItemTone,
  type EqualItemsLook,
  type EqualItemsProps,
} from '@/components/app/equal-items'
export { NeedsYou, type NeedsYouItem, type NeedsYouProps, type NeedsYouTone } from '@/components/app/needs-you'
export { Freshness, type FreshnessProps } from '@/components/app/freshness'
export { isStale } from '@/lib/freshness'
export { PartEmpty, type PartEmptyAction, type PartEmptyProps, type PartEmptyState } from '@/components/app/part-empty'
export { SourceCredit, type Source, type SourceCreditProps } from '@/components/app/source-credit'
export { ProgressRing, type ProgressRingProps } from '@/components/app/progress-ring'
export {
  LineChart,
  type LineChartMark,
  type LineChartPoint,
  type LineChartProps,
} from '@/components/app/line-chart'
export {
  MultiLineChart,
  type ChartSeries,
  type ChartTone,
  type MultiLineChartProps,
} from '@/components/app/multi-line-chart'
export { StepBar, type StepBarProps } from '@/components/app/step-bar'
export { RatingStar, type RatingStarProps, type RatingStarValue } from '@/components/app/rating-star'
export { DateField, type DateFieldProps } from '@/components/app/date-field'
export { EmojiField, type EmojiFieldProps } from '@/components/app/emoji-field'
export { MonthDayField, type MonthDayFieldProps } from '@/components/app/month-day-field'
export { ImageField, type ImageFieldProps } from '@/components/app/image-field'
export { DEFAULT_IMAGE_TYPES, type ImageUpload, type ImageUploadResult } from '@/lib/image-file'
export {
  formatPlainDate,
  parsePlainDate,
  plainDateExamples,
  unreadableDateMessage,
  type ParsePlainDateOptions,
  type PlainDate,
} from '@/lib/plain-date'
export { formatMonthDay, isMonthDay, monthDayProblem, type MonthDay } from '@/lib/month-day'
export { RecurrenceField, type RecurrenceFieldProps } from '@/components/app/recurrence-field'
export {
  atLocal,
  formatRule,
  nextAfterCompletion,
  nextOccurrence,
  nextOccurrences,
  normalizeRecurrence,
  parseRule,
  RecurrenceError,
  recurrenceFromWeekdays,
  recurrenceProblem,
  type Recurrence,
  type RuleParts,
} from '@/lib/recurrence'
export {
  parseRecurrencePhrase,
  recurrencePhrase,
  type PhraseOptions,
  type PhraseResult,
} from '@/lib/recurrence-phrase'
export {
  formatOccurrence,
  formatRecurrence,
  todayIn,
  type OccurrenceFormatOptions,
  type RecurrenceFormatOptions,
} from '@/lib/recurrence-format'
export {
  ChoiceCell,
  LinkCell,
  LinkOut,
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
  type ModuleStripMobile,
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
export { OverviewPage, type OverviewPageProps, type OverviewPart } from '@/components/app/overview-page'
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
export { useTableUrlState, type TableUrlStateOptions, type TableUrlStateViewOptions } from '@/hooks/use-table-url-state'
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
export { usePalette, type PaletteState } from '@/hooks/use-palette'
export {
  LIGHT_PALETTE_LABELS,
  LIGHT_PALETTES,
  PALETTE_LABELS,
  PALETTE_STORAGE_KEY,
  PALETTES,
  isLightPaletteName,
  isPaletteName,
  paletteColorScheme,
  type AppPaletteName,
  type LightPaletteName,
  type PaletteName,
} from '@/lib/palettes'
export { useRows, type RowsState } from '@/hooks/use-rows'
export { ROWS, ROWS_LABELS, ROWS_STORAGE_KEY, isRowsName, type RowsName } from '@/lib/rows'
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
