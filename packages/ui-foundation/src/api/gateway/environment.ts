// Anti-corruption layer for GET /environment (openapi/foundation.yaml,
// operationId getDataEnvironment): which data the backend serves, for
// DataEnvironmentBanner. Resolves to the label, or null for production
// data. The path is optional in an app's contract, so an app whose
// backend doesn't serve it (a 404, or the dev server's index.html) reads
// as null too: no banner, not an error.
import type { components } from "../schema";
import { safeFetch, toAppError } from "./errors";

type DataEnvironment = components["schemas"]["DataEnvironment"];

export async function getDataLabel(): Promise<string | null> {
  const res = await safeFetch("/environment");
  if (res.status === 404) return null;
  if (res.status !== 200) throw toAppError(res.status, res.body);
  const label = (res.body as Partial<DataEnvironment> | undefined)?.dataLabel;
  return typeof label === "string" && label.trim() !== "" ? label.trim() : null;
}
