// The default QueryClient retries every failed query 3x with exponential
// backoff (~7s total) regardless of why it failed. That's right for a
// network blip but wrong for a 404, 401, or 422 — the gateway already
// classifies those as AppError.kind values that will never change on
// retry, so retrying just makes the user wait ~7s to see an error the
// first response already told us was final.
import { QueryClient } from "@tanstack/react-query";
import type { AppError } from "./contracts";

function isTransient(error: unknown): boolean {
  return (error as AppError).kind === "network";
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => isTransient(error) && failureCount < 2,
      },
    },
  });
}
