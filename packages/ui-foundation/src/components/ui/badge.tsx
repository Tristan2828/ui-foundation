import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/90",
        success:
          "bg-success text-success-foreground focus-visible:ring-success/20 dark:focus-visible:ring-success/40 [a]:hover:bg-success/90",
        warning:
          "bg-warning text-warning-foreground focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40 [a]:hover:bg-warning/90",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        // Three tones x three styles. The *-text tokens, never the solid
        // fill tokens: `border-destructive`/`text-destructive` would use
        // the shade chosen to carry white text, which is too light to read
        // against the page in light mode and too dark in dark mode. See
        // styles/theme.css and conventions/docs/design-language.md.
        "outline-success": "border-success-text text-success-text",
        "outline-warning": "border-warning-text text-warning-text",
        "outline-destructive": "border-destructive-text text-destructive-text",
        // The fill is the solid token at low alpha (a wash of the tone),
        // while the text is the *-text shade — mixing the two is the point.
        // Dark mode needs a little more alpha for the wash to register
        // against a near-black page.
        "tinted-success": "bg-success/15 text-success-text dark:bg-success/20",
        "tinted-warning": "bg-warning/15 text-warning-text dark:bg-warning/20",
        "tinted-destructive":
          "bg-destructive/15 text-destructive-text dark:bg-destructive/20",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
