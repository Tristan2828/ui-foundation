// UI-owned types. The gateway translates every backend response into these;
// nothing above the gateway may see a wire-shaped response (the
// anti-corruption layer — docs/ARCHITECTURE.md "The layers").

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AppError = {
  /**
   * `proxy_auth`: the answer came from something in front of the app (an
   * identity-aware proxy such as Cloudflare Access) whose own sign-in has
   * lapsed, not from the app: a page or a redirect where JSON was
   * expected. Only a full page load signs in again. Not the app's own
   * session, which is `auth`.
   *
   * `conflict` (a 409): the save was refused because the record changed
   * since the version it was built on (another tab, a phone, an AI chat
   * saved in between). Nothing was written: fetch the record again and
   * let the person choose. `useRecordUpdate` refetches it, and editing in
   * place asks "This changed elsewhere" (docs/foundation/add-an-entity.md
   * "Saves that don't overwrite").
   */
  kind: "validation" | "notfound" | "auth" | "rate_limited" | "conflict" | "server" | "network" | "proxy_auth";
  message: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * kind "rate_limited" (a 429): seconds until another attempt is allowed,
   * from the response's Retry-After. Absent when the server didn't say.
   */
  retryAfterSeconds?: number;
};

export type QuerySpec = {
  page: number;
  pageSize: number;
  sort?: { field: string; dir: "asc" | "desc" };
  filters?: Record<string, unknown>;
};
