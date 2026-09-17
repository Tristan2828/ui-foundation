// Anti-corruption layer for auth — same shape as gateway/widgets.ts. A 401
// from getCurrentUser is the expected "not logged in" signal (the global
// QueryClient retry policy in api/query-client.ts already treats any
// non-network AppError as final, so this doesn't retry either).
import type { components } from "../schema";
import { safeFetch, toAppError } from "./errors";

type User = components["schemas"]["User"];
type LoginRequest = components["schemas"]["LoginRequest"];

export async function login(input: LoginRequest): Promise<User> {
  const res = await safeFetch("/auth/login", {
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
