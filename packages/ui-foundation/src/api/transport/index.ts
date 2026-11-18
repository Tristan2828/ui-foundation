// The only file allowed to call fetch directly — see AGENTS.md ("NEVER
// import from api/transport/ outside api/gateway/") and the matching
// no-restricted-imports / no-restricted-syntax rules in eslint.config.js.
// Owns the base URL and the raw HTTP call; knows nothing about widgets,
// pagination, or error shapes — that translation is the gateway's job.

export type ApiResponse = {
  status: number;
  body: unknown;
  /** The response's headers (a 429's Retry-After, for one). */
  headers: Headers;
  /**
   * Set when the answer can't be the app's own API speaking JSON, the way
   * an identity-aware proxy in front of the app answers once its sign-in
   * has lapsed: `html` (a page where JSON was expected), `not-json` (a
   * body that doesn't parse as JSON), `cross-origin-redirect` (followed to
   * another origin) or `opaque-redirect` (a redirect not followed). The
   * gateway decides what it means (`safeFetch`). Absent on every ordinary
   * response.
   */
  foreign?: "html" | "not-json" | "cross-origin-redirect" | "opaque-redirect";
};

const BASE_URL = "/api";

// Sent unless the caller set them: they tell a proxy in front of the app
// that this is a script asking for JSON, not a page, so a proxy that can
// answers a lapsed sign-in with a 401 rather than a redirect to its login
// page (Cloudflare Access reads X-Requested-With; others read Accept).
const DEFAULT_HEADERS: readonly (readonly [string, string])[] = [
  ["accept", "application/json"],
  ["x-requested-with", "XMLHttpRequest"],
];

export async function apiFetch(path: string, init?: RequestInit): Promise<ApiResponse> {
  const headers = new Headers(init?.headers);
  for (const [name, value] of DEFAULT_HEADERS) if (!headers.has(name)) headers.set(name, value);
  // A redirect is never part of the app's contract. A proxy's redirect to
  // its login page on another origin, if followed, fails as a network
  // error that can't be told from being offline; not followed, it comes
  // back as an opaque redirect the gateway can name. A caller can still
  // pass `redirect: "follow"`.
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers, redirect: init?.redirect ?? "manual" });
  if (response.type === "opaqueredirect") {
    return { status: response.status, body: undefined, headers: response.headers, foreign: "opaque-redirect" };
  }
  if (response.redirected && isOtherOrigin(response.url)) {
    return { status: response.status, body: undefined, headers: response.headers, foreign: "cross-origin-redirect" };
  }
  if (response.status === 204) {
    return { status: response.status, body: undefined, headers: response.headers };
  }
  const html = (response.headers.get("content-type") ?? "").toLowerCase().includes("text/html");
  let parsed = true;
  const body: unknown = await response.json().catch(() => {
    parsed = false;
    return undefined;
  });
  const foreign = html ? "html" : parsed ? undefined : "not-json";
  return foreign
    ? { status: response.status, body, headers: response.headers, foreign }
    : { status: response.status, body, headers: response.headers };
}

function isOtherOrigin(url: string): boolean {
  const here = (globalThis as { location?: { origin?: string } }).location?.origin;
  if (!here || !url) return false;
  try {
    return new URL(url).origin !== here;
  } catch {
    return false;
  }
}
