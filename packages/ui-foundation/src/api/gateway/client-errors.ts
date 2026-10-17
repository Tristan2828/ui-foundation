// POST /client-errors (openapi/foundation.yaml, x-optional): a failure the
// browser saw, for the app's backend to forward to error reporting. Only
// error reporting calls this (src/error-reporting/), and never through
// TanStack Query, so a failed report can't itself be reported.
import type { components } from "../schema";
import { safeFetch } from "./errors";

export type ClientErrorReport = components["schemas"]["ClientErrorReport"];

/** Resolves whatever happens: a report that can't be sent is dropped. */
export async function reportClientError(report: ClientErrorReport): Promise<void> {
  try {
    await safeFetch("/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    });
  } catch {
    // Network down: nothing to do, and nothing to report it to.
  }
}
