// AppShell's version entry: which build is live, and where it came from.
// The values are set at build time by `@tristan2828/ui-foundation/vite`.

export type AppShellVersion = {
  /** The full or short commit hash. Empty or missing: nothing is shown. */
  commit?: string
  /** The PR the build came from; links there instead of to the commit. */
  pr?: string | number
  /** The repository's web address, e.g. `https://github.com/me/app`. Missing: the commit shows unlinked. */
  repoUrl?: string
}

function prNumber(pr: AppShellVersion['pr']): string | null {
  const value = String(pr ?? '').trim()
  return /^\d+$/.test(value) ? value : null
}

/** What the entry says, or null when there's no commit (development). */
export function versionLabel({ commit, pr }: AppShellVersion): string | null {
  const hash = commit?.trim()
  if (!hash) return null
  const number = prNumber(pr)
  return number ? `Version ${hash.slice(0, 7)} · PR #${number}` : `Version ${hash.slice(0, 7)}`
}

/**
 * The PR's page, else the commit's, or null when there's no address to
 * trust: only an http(s) repository makes a link.
 */
export function versionHref({ commit, pr, repoUrl }: AppShellVersion): string | null {
  const hash = commit?.trim()
  const repo = repoUrl?.trim().replace(/\/+$/, '')
  if (!hash || !repo || !/^https?:\/\/[^/]/i.test(repo)) return null
  const number = prNumber(pr)
  return number ? `${repo}/pull/${number}` : `${repo}/commit/${encodeURIComponent(hash)}`
}
