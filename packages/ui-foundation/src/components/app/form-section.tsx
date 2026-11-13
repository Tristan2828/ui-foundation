// A group of a form's fields in a card (4.85, the form standard's F2),
// drawn as a record's section is (EntityView): the card surface, its title
// on the heading band. Only on a form of eight fields or more, and never
// in a dialog; a short form is one run of fields. Its fields are a
// FieldGroup of their own, so short ones share rows inside it as they do
// on the form.
import { useId, type ReactNode } from 'react'
import { cn } from 'cn'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'

export type FormSectionProps = {
  /** What the group is ("Reading", "Details"): Title Case, a word or two (design-language.md "Words on screen"). */
  title: string
  /** The group's fields. */
  children: ReactNode
  className?: string
}

export function FormSection({ title, children, className }: FormSectionProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} data-slot="form-section" className={cn('w-full', className)}>
      <Card>
        <CardHeader>
          <h2 id={headingId} className="type-section-title text-foreground">
            {title}
          </h2>
        </CardHeader>
        <CardContent>
          <FieldGroup>{children}</FieldGroup>
        </CardContent>
      </Card>
    </section>
  )
}
