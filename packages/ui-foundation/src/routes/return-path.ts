// Where to go after logging in or registering: the protected page AppShell
// redirected away from (it passes `{ from }` as router state), else home.
// Router state can't be set by a link, but only accept an in-app path
// anyway ("/x", never "//host" or "https://..."), so this can't become an
// open redirect if a future caller ever feeds it from a query param.
export function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}
