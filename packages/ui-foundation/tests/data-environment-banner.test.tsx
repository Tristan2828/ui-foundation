// DataEnvironmentBanner names the backend's data label, and renders
// nothing for production data; the label survives a session change, which
// drops every user-scoped query. Rendered to HTML with the label already
// in the cache: no effect runs there, so nothing is fetched.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '../src/auth/auth-context'
import { AuthProvider, useAuth } from '../src/auth/use-auth'
import { DataEnvironmentBanner } from '../src/components/app/data-environment-banner'
import { DATA_LABEL_QUERY_KEY } from '../src/hooks/use-data-label'

function renderBanner(label: string | null): string {
  const client = new QueryClient()
  client.setQueryData(DATA_LABEL_QUERY_KEY, label)
  return renderToString(
    <QueryClientProvider client={client}>
      <DataEnvironmentBanner />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DataEnvironmentBanner', () => {
  it('names the label as data, as a status message', () => {
    const html = renderBanner('dev')
    expect(html).toContain('role="status"')
    expect(html).toContain('Dev data:</strong> changes here don&#x27;t reach production')
  })

  it('names any label the backend gives', () => {
    expect(renderBanner('staging')).toContain('Staging data:')
  })

  it('renders nothing for production data', () => {
    expect(renderBanner(null)).toBe('')
  })

  it('renders nothing before the backend has answered', () => {
    expect(
      renderToString(
        <QueryClientProvider client={new QueryClient()}>
          <DataEnvironmentBanner />
        </QueryClientProvider>,
      ),
    ).toBe('')
  })
})

describe('a session change', () => {
  it("drops the user's rows but keeps the data label", async () => {
    const client = new QueryClient()
    client.setQueryData(DATA_LABEL_QUERY_KEY, 'dev')
    client.setQueryData(['widgets', 'list'], { items: [], total: 0 })
    let auth: AuthContextValue | undefined
    function Capture() {
      auth = useAuth()
      return null
    }
    renderToString(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Capture />
        </AuthProvider>
      </QueryClientProvider>,
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await auth!.logout()

    expect(client.getQueryData(['widgets', 'list'])).toBeUndefined()
    expect(client.getQueryData(DATA_LABEL_QUERY_KEY)).toBe('dev')
  })
})
