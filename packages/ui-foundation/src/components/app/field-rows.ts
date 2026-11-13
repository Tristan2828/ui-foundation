// A record's label/value rows, shared by EntityView's fields cards and
// EqualItems (record standard R10), so a fact reads the same wherever a
// record shows it.
//
// Label beside value from `sm` up, once the list itself is 24rem wide;
// below either (a phone, or a narrow box on a wide screen: a panel, a
// dialog's column) the label sits above its value, so nothing is squeezed
// into a narrow second column (4.97: a value column squeezed to nothing
// cut off an editor's controls, ChoiceButtons' among them). In
// the rail the list's own width decides instead (a container query on the
// <dl>): label above value in the narrow rail, beside it once the rail's
// sections stack full width under the header.
// `railFields="beside"` (4.76) puts them side by side in the rail too,
// from an 18rem list (a rail card beside the main column is ~19rem
// inside), with a narrower label column, and stacked below that. Each
// container query needs an `@container/fields` on the <dl>.
export const FIELD_ROW = {
  page: 'sm:@sm/fields:grid sm:@sm/fields:grid-cols-[minmax(--spacing(32),--spacing(48))_minmax(0,1fr)] sm:@sm/fields:gap-6',
  rail: '@lg/fields:grid @lg/fields:grid-cols-[minmax(--spacing(32),--spacing(48))_1fr] @lg/fields:gap-6',
  railBeside:
    '@2xs/fields:grid @2xs/fields:grid-cols-[minmax(--spacing(24),--spacing(28))_minmax(0,1fr)] @2xs/fields:items-baseline @2xs/fields:gap-4 @2xs/fields:py-2.5 @lg/fields:grid-cols-[minmax(--spacing(32),--spacing(48))_1fr] @lg/fields:gap-6',
}

/** A row's own spacing, before its place's grid. */
export const FIELD_ROW_BASE = 'flex flex-col gap-1 py-3 first:pt-0 last:pb-0'
/** The label (`<dt>`): label type, muted. */
export const FIELD_LABEL = 'type-label text-muted-foreground'
/** The value (`<dd>`): body type, foreground, long words broken. */
export const FIELD_VALUE = 'min-w-0 type-body break-words text-foreground'
