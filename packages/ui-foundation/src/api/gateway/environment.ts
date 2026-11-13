// Anti-corruption layer for GET /environment (openapi/foundation.yaml,
// operationId getDataEnvironment): which data the backend serves, for
// DataEnvironmentBanner. Resolves to the label, or null for production
// data. The path is optional in an app's contract, so an app whose
// backend doesn't serve it (a 404, or the dev server's index.html) reads
// as null too: no banner, not an error. A page where JSON was expected
// (safeFetch's kind "proxy_auth") is the dev server's index.html as often
// as a proxy's sign-in, so it's null here too; the screen's own requests
// say "Sign In Again" when it's the proxy.
import type { AppError } from "../contracts";
import type { components } from "../schema";
import { safeFetch, toAppError } from "./errors";

type DataEnvironment = components["schemas"]["DataEnvironment"];

export async function getDataLabel(): Promise<string | null> {
  let res: Awaited<ReturnType<typeof safeFetch>>;
  try {
    res = await safeFetch("/environment");
  } catch (error) {
    if ((error as AppError).kind === "proxy_auth") return null;
    throw error;
  }
  if (res.status === 404) return null;
  if (res.status !== 200) throw toAppError(res.status, res.body);
  const label = (res.body as Partial<DataEnvironment> | undefined)?.dataLabel;
  return typeof label === "string" && label.trim() !== "" ? label.trim() : null;
}
