// Shared wire-error -> AppError translation for the gateway, plus a thin
// wrapper that turns a rejected apiFetch (network-level failure) into
// AppError{kind:'network'} instead of letting a raw fetch error escape. This
// is the anti-corruption layer's error seam (docs/ARCHITECTURE.md).
import { apiFetch, type ApiResponse } from "../transport";
import type { AppError } from "../contracts";
import type { components } from "../schema";

type ValidationErrorBody = components["schemas"]["ValidationErrorBody"];
type HTTPErrorBody = components["schemas"]["HTTPErrorBody"];

export async function safeFetch(path: string, init?: RequestInit): Promise<ApiResponse> {
  try {
    return await apiFetch(path, init);
  } catch {
    throw networkError();
  }
}

/**
 * Pass the response's `headers` so a 429 carries its Retry-After
 * (`retryAfterSeconds`); without them it's still `rate_limited`.
 */
// The HTTP status each AppError came from, kept beside it rather than on
// it, so AppError's shape (and every test comparing one) doesn't change.
// Error reporting reads it (src/error-reporting/reporter.ts).
const STATUS = new WeakMap<AppError, number>();

export function httpStatusOf(error: AppError): number | undefined {
  return STATUS.get(error);
}

export function toAppError(status: number, body: unknown, headers?: Headers): AppError {
  const error = translate(status, body, headers);
  STATUS.set(error, status);
  return error;
}

function translate(status: number, body: unknown, headers?: Headers): AppError {
  if (status === 422) {
    // A rule the server enforces (a cap, a status the change needs) is
    // often refused with FastAPI's HTTPException shape: a sentence, not a
    // list of field issues. That sentence is the message to show.
    const raw = (body as ValidationErrorBody | HTTPErrorBody | undefined)?.detail;
    if (typeof raw === "string") return { kind: "validation", message: raw, fieldErrors: {} };
    const detail = raw ?? [];
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of detail) {
      const field = fieldKey(issue.loc);
      (fieldErrors[field] ??= []).push(issue.msg);
    }
    return { kind: "validation", message: "Validation failed", fieldErrors };
  }

  const message = (body as HTTPErrorBody | undefined)?.detail ?? `Request failed with status ${status}`;
  if (status === 404) return { kind: "notfound", message };
  if (status === 401) return { kind: "auth", message };
  if (status === 429) {
    const retryAfterSeconds = parseRetryAfter(headers?.get("retry-after") ?? null);
    return retryAfterSeconds === undefined
      ? { kind: "rate_limited", message }
      : { kind: "rate_limited", message, retryAfterSeconds };
  }
  return { kind: "server", message };
}

// Retry-After is either whole seconds or an HTTP date (RFC 9110 10.2.3).
function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value.trim());
  const at = Date.parse(value);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

// The key a form binds a 422 to (react-hook-form's field path):
// - ["body", "price"] → "price"
// - ["body", "tags", 0] → "tags": an item of a list of values is the list's
//   error, never a position.
// - ["body", "checklist", 2, "text"] → "checklist.2.text": a field inside an
//   item of a list of objects, so it lands on that row's input.
// Anything else keeps the last string segment, as before nested paths
// existed (["body", "address", "city"] → "city").
function fieldKey(loc: readonly (string | number)[]): string {
  const path = loc.slice(1); // drop "body" / "query"
  const listIndex = path.findIndex((segment) => typeof segment === "number");
  if (listIndex > 0 && path.slice(listIndex + 1).some((segment) => typeof segment === "string")) {
    return path.join(".");
  }
  return String([...loc].reverse().find((segment) => typeof segment === "string") ?? loc[loc.length - 1]);
}

export function networkError(): AppError {
  return { kind: "network", message: "Network error — check your connection and try again." };
}
