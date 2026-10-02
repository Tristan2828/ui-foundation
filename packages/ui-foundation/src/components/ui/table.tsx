import * as React from "react"
import { cn } from "cn"

// `containerRef`/`containerClassName` are this repo's patch to the upstream
// primitive. Upstream wraps the <table> in a scroll container that nothing
// outside can reach, so anything keyed to the scroll viewport — a sticky
// scrollbar, a pinned column, an IntersectionObserver — had to find that
// div with querySelector('[data-slot="table-container"]') and re-find it on
// every render. Forwarding a real ref is the same capability without the
// DOM lookup. See src/components/app/data-table.tsx's `pinFirstColumn`.
//
// A local patch to a shadcn primitive: re-running `shadcn add table` here
// would overwrite it. Diff against upstream before taking a new version.
function Table({
  className,
  containerRef,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & {
  containerRef?: React.Ref<HTMLDivElement>
  containerClassName?: string
}) {
  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      // Zebra striping, scoped to the body so the header is never tinted.
      // NOTE the specificity trap this creates: `tr:nth-child(even)` is
      // (0,2,1) while any `tr:hover` rule is (0,2,0), so the stripe
      // outranks hover and even rows would not light up — a whole-row
      // hover here lights only the odd rows. data-table.tsx handles this
      // by highlighting a single pinned cell instead of the row.
      className={cn(
        "[&_tr:last-child]:border-0 [&_tr:nth-child(even)]:bg-muted/40",
        className
      )}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

// Patched (ui-foundation): padding and header height come from the
// --table-* density tokens in styles/theme.css instead of upstream's fixed
// h-10 / p-2, so data-density on an ancestor retunes every table. The
// defaults equal upstream's values.
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-(--table-head-height) px-(--table-cell-px) text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-(--table-cell-px) py-(--table-cell-py) align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
