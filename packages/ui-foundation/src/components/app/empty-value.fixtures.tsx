import type { Meta, StoryObj } from '@/fixtures/types'
import { EmptyText } from './empty-value'

// EmptyText (4.96), the record's empty value, where an app draws it on its
// own: a strip of numbers, a summary line, a list's cells. The dash in the
// muted tone, read as "Not set" or the words given, and words instead of
// the dash. Axe in both themes (e2e/fixtures-visual.spec.ts); what a
// screen reader hears is tests/empty-text.test.tsx's.

const meta: Meta = {
  title: 'app/EmptyText',
  parameters: { controls: { disable: true } },
}

export default meta

export const Places: StoryObj = {
  render: () => (
    <div className="flex max-w-md flex-col gap-6">
      <dl className="grid grid-cols-3 gap-4 rounded-lg border p-4">
        <div>
          <dt className="type-label text-muted-foreground">Shelves</dt>
          <dd className="type-body">12</dd>
        </div>
        <div>
          <dt className="type-label text-muted-foreground">Last count</dt>
          <dd className="type-body">
            <EmptyText />
          </dd>
        </div>
        <div>
          <dt className="type-label text-muted-foreground">Budget</dt>
          <dd className="type-body">
            <EmptyText text="No budget yet" />
          </dd>
        </div>
      </dl>
      <p className="type-body">
        Paper Atlas · second floor · <EmptyText label="No reason given" />
      </p>
      <p className="type-label">
        Harbor Light · <EmptyText className="type-label text-muted-foreground" />
      </p>
    </div>
  ),
}
