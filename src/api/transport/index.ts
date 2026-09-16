// The only file allowed to call fetch directly — see AGENTS.md ("NEVER
// import from api/transport/ outside api/gateway/") and the matching
// no-restricted-imports / no-restricted-syntax rules in eslint.config.js.
// Owns the base URL and the raw HTTP call; knows nothing about widgets,
// pagination, or error shapes — that translation is the gateway's job.

export type ApiResponse = {
  status: number;
  body: unknown;
};

const BASE_URL = "/api";

export async function apiFetch(path: string, init?: RequestInit): Promise<ApiResponse> {
  const response = await fetch(`${BASE_URL}${path}`, init);
  if (response.status === 204) {
    return { status: response.status, body: undefined };
  }
  const body = await response.json().catch(() => undefined);
  return { status: response.status, body };
}
