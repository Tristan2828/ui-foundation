// Shared wire-error -> AppError translation for the gateway, plus a thin
// wrapper that turns a rejected apiFetch (network-level failure) into
// AppError{kind:'network'} instead of letting a raw fetch error escape. See
// docs/BUILD-PLAN.md "Anti-Corruption Layer" — this is the ACL's error seam.
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
      // The field is the last *string* segment: integer segments index into
      // an array field (["body", "tags", 0] is a bad tag), and a form binds
      // errors by field name, never by position.
      const field = String([...issue.loc].reverse().find((segment) => typeof segment === "string") ?? issue.loc[issue.loc.length - 1]);
      (fieldErrors[field] ??= []).push(issue.msg);
    }
    return { kind: "validation", message: "Validation failed", fieldErrors };
  }

  const message = (body as HTTPErrorBody | undefined)?.detail ?? `Request failed with status ${status}`;
  if (status === 404) return { kind: "notfound", message };
  if (status === 401) return { kind: "auth", message };
  return { kind: "server", message };
}

export function networkError(): AppError {
  return { kind: "network", message: "Network error — check your connection and try again." };
}
