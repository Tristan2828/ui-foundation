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

export function toAppError(status: number, body: unknown): AppError {
  if (status === 422) {
    const detail = (body as ValidationErrorBody | undefined)?.detail ?? [];
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
  return { kind: "server", message };
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
