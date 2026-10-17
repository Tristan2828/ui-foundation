// Anti-corruption layer for auth — same shape as gateway/widgets.ts. A 401
// from getCurrentUser is the expected "not logged in" signal (the global
// QueryClient retry policy in api/query-client.ts already treats any
// non-network AppError as final, so this doesn't retry either).
import type { components } from "../schema";
import { safeFetch, toAppError } from "./errors";

type User = components["schemas"]["User"];
type LoginRequest = components["schemas"]["LoginRequest"];
type RegisterRequest = components["schemas"]["RegisterRequest"];
type TotpLoginRequest = components["schemas"]["TotpLoginRequest"];
type HTTPErrorBody = components["schemas"]["HTTPErrorBody"];

/** Signed in (200), or the password was right and a TOTP code is next (202). */
export type LoginStep = { user: User } | { next: "totp" };

// A 429 (too many failed attempts) is an AppError of kind 'rate_limited'
// with the Retry-After seconds, as on every endpoint (toAppError).
export async function login(input: LoginRequest): Promise<LoginStep> {
  const res = await safeFetch("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 202) return { next: "totp" };
  if (res.status !== 200) throw toAppError(res.status, res.body, res.headers);
  return { user: res.body as User };
}

/**
 * Signed in, or the pending sign-in is gone (410: expired, or out of tries)
 * and it starts again from the password, with the server's reason. A wrong
 * code is an AppError of kind 'auth' (401).
 */
export type TotpStep = { user: User } | { restart: string };

export async function loginTotp(input: TotpLoginRequest): Promise<TotpStep> {
  const res = await safeFetch("/auth/login/totp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 410) {
    const detail = (res.body as HTTPErrorBody | undefined)?.detail;
    return { restart: detail ?? "Your sign-in timed out. Enter your email and password again." };
  }
  if (res.status !== 200) throw toAppError(res.status, res.body, res.headers);
  return { user: res.body as User };
}

// Auto-logs in on success — the backend sets the same session cookie
// /auth/login does (see backend/app/routers/auth.py's _start_session), so
// the gateway shape is identical to login's: a User on 200, AppError
// otherwise (a duplicate email arrives as kind:'validation' with
// fieldErrors.email, same as any other field error).
export async function register(input: RegisterRequest): Promise<User> {
  const res = await safeFetch("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as User;
}

export async function logout(): Promise<void> {
  const res = await safeFetch("/auth/logout", { method: "POST" });
  if (res.status !== 204) throw toAppError(res.status, res.body);
}

export async function getCurrentUser(): Promise<User> {
  const res = await safeFetch("/auth/me");
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as User;
}
