import type { Meta, StoryObj } from '@/fixtures/types'
import { useState, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import type { AppError } from '@/api/contracts'
import type { PageLinkInfo } from '@/lib/page-link'
import { Markdown } from './markdown'
import { PageTrail, type PageCrumb } from './page-trail'
import { RichTextEditor } from './rich-text-editor'

// Page links (src/lib/page-link.ts) as the text is read and edited, and
// the trail back from a page (PageTrail), on screen at once in each story
// so axe checks every look's contrast and the token check every colour,
// in both themes. Behaviour: e2e/page-links.spec.ts.

type Page = { title: string; removed?: boolean; restorable?: boolean }

const PAGES: Record<string, Page> = {
  '/pages/3': { title: 'Getting Started' },
  '/pages/5': { title: 'Packing list' },
  '/pages/9': { title: 'Old plan', removed: true, restorable: true },
  '/pages/11': { title: 'Lost notes', removed: true },
}

const READ = `Notes for the move.

[Getting Started](/pages/3)

The [packing list](/pages/5) is a page too, and the [docs](https://example.com/docs) aren't.

[Old plan](/pages/9)

[Lost notes](/pages/11)
`

const EDIT = `Notes for the move.

[Getting Started](/pages/3)

The [packing list](/pages/5) is a page too.

[Old plan](/pages/9)

Type / and pick Page to add one.
`

// The app's side: its pages, how a link is told to be one, a restore
// that takes a moment, and a create that refuses a title with "fail" in it.
function usePages() {
  const [pages, setPages] = useState(PAGES)
  const [made, setMade] = useState(0)
  const pageLink = (href: string): PageLinkInfo | null => {
    const page = pages[href]
    if (!page) return null
    return {
      title: page.title,
      removed: page.removed,
      onRestore: page.restorable
        ? () =>
            new Promise<void>((resolve) =>
              setTimeout(() => {
                setPages((current) => ({ ...current, [href]: { title: page.title } }))
                resolve()
              }, 300),
            )
        : undefined,
    }
  }
  const onCreatePage = (title: string) =>
    new Promise<string>((resolve, reject) =>
      setTimeout(() => {
        if (/fail/i.test(title)) {
          const refusal: AppError = { kind: 'server', message: 'The server is down. Try again.' }
          reject(refusal)
          return
        }
        const href = `/pages/${100 + made}`
        setMade(made + 1)
        setPages((current) => ({ ...current, [href]: { title } }))
        resolve(href)
      }, 300),
    )
  return { pageLink, onCreatePage }
}

// Where a page link goes: a route of its own, saying which page it is.
function PageScreen() {
  const location = useLocation()
  return <p data-testid="page-screen">Page at {location.pathname}</p>
}

function InRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createMemoryRouter([
      { path: '/', element: children },
      { path: '/pages/:id', element: <PageScreen /> },
    ]),
  )
  return <RouterProvider router={router} />
}

function ReadStory() {
  const { pageLink } = usePages()
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Markdown pageLink={pageLink}>{READ}</Markdown>
      <Toaster />
    </div>
  )
}

function EditStory() {
  const { pageLink, onCreatePage } = usePages()
  const [saved, setSaved] = useState(EDIT)
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <RichTextEditor
        aria-label="Notes with pages"
        defaultValue={EDIT}
        onChange={setSaved}
        pageLink={pageLink}
        onCreatePage={onCreatePage}
      />
      <pre data-testid="saved-pages" className="sr-only">
        {saved}
      </pre>
      <Toaster />
    </div>
  )
}

const DEEP: PageCrumb[] = [
  { label: 'Notes', href: '/notes' },
  { label: 'Project plan', href: '/notes/12' },
  { label: 'Getting Started', href: '/pages/3' },
  { label: 'Setup', href: '/pages/4' },
  { label: 'Installing on a shared laptop with a long name', href: '/pages/6' },
  { label: 'Accounts', href: '/pages/7' },
  { label: 'First steps for everyone new' },
]

function TrailStory() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section className="flex flex-col gap-1">
        <h2 className="type-caption text-muted-foreground">One level</h2>
        <PageTrail aria-label="One level" crumbs={[DEEP[0], DEEP[1], { label: 'Getting Started' }]} />
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="type-caption text-muted-foreground">Five levels deep</h2>
        <PageTrail aria-label="Five levels deep" crumbs={DEEP} />
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="type-caption text-muted-foreground">Five levels deep, narrow</h2>
        <div className="w-72 rounded-lg border p-2">
          <PageTrail aria-label="Five levels deep, narrow" crumbs={DEEP} />
        </div>
      </section>
    </div>
  )
}

const meta: Meta = {
  title: 'app/PageLinks',
  parameters: { controls: { disable: true } },
}

export default meta

export const Read: StoryObj = {
  render: () => (
    <InRouter>
      <ReadStory />
    </InRouter>
  ),
}

export const Edit: StoryObj = {
  render: () => (
    <InRouter>
      <EditStory />
    </InRouter>
  ),
}

export const Trail: StoryObj = {
  render: () => (
    <InRouter>
      <TrailStory />
    </InRouter>
  ),
}
