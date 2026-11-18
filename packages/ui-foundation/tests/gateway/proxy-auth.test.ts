// A lapsed sign-in at a proxy in front of the app (an identity-aware proxy
// such as Cloudflare Access): where the contract promises JSON, the answer
// is the proxy's page or a redirect. safeFetch turns each into one AppError,
// kind "proxy_auth", whatever gateway module made the request; the app's own
// JSON errors, every kind, are what they were.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "../../src/api/gateway/auth";
import { httpStatusOf, proxyAuthError, safeFetch, toAppError } from "../../src/api/gateway/errors";
import type { AppError } from "../../src/api/contracts";

const PROXY_PAGE = "<!doctype html><html><head><title>Sign in</title></head><body>Sign in to continue</body></html>";
const LAPSED: AppError = {
  kind: "proxy_auth",
  message: "Your sign-in has expired. Reload the page to sign in again.",
};

function htmlResponse(status: number): Response {
  return new Response(PROXY_PAGE, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

// A Response as fetch hands it back after following redirects, or with
// redirect: "manual": `redirected`, `url` and `type` can't be set through
// the constructor.
function withFetchState(response: Response, state: { redirected?: boolean; url?: string; type?: ResponseType }) {
  for (const [key, value] of Object.entries(state)) Object.defineProperty(response, key, { value });
  return response;
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error("expected a rejection");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a lapsed proxy sign-in becomes kind proxy_auth", () => {
  it("an HTML page with a 200", async () => {
    stubFetch(htmlResponse(200));
    const error = await rejection(safeFetch("/widgets"));
    expect(error).toEqual(LAPSED);
    expect(httpStatusOf(error)).toBe(200);
  });

  it.each([401, 403])("an HTML page with a %i", async (status) => {
    stubFetch(htmlResponse(status));
    const error = await rejection(safeFetch("/widgets"));
    expect(error).toEqual(LAPSED);
    expect(httpStatusOf(error)).toBe(status);
  });

  it.each([401, 403])("a %i whose body isn't JSON (a proxy's bare refusal)", async (status) => {
    stubFetch(new Response("Forbidden", { status, headers: { "content-type": "text/plain" } }));
    expect(await rejection(safeFetch("/widgets"))).toEqual(LAPSED);
  });

  it("a redirect followed to another origin", async () => {
    vi.stubGlobal("location", { origin: "https://app.example.com" });
    stubFetch(
      withFetchState(htmlResponse(200), { redirected: true, url: "https://login.example.net/sign-in?return=%2F" }),
    );
    expect(await rejection(safeFetch("/widgets", { redirect: "follow" }))).toEqual(LAPSED);
  });

  it("a redirect followed to another origin, even when the page there is JSON", async () => {
    vi.stubGlobal("location", { origin: "https://app.example.com" });
    stubFetch(withFetchState(jsonResponse({ ok: true }, 200), { redirected: true, url: "https://login.example.net/" }));
    expect(await rejection(safeFetch("/widgets", { redirect: "follow" }))).toEqual(LAPSED);
  });

  it("an opaque redirect (a redirect not followed)", async () => {
    stubFetch(withFetchState(new Response(null, { status: 200 }), { type: "opaqueredirect" }));
    expect(await rejection(safeFetch("/widgets"))).toEqual(LAPSED);
  });

  it("from any gateway module, the session check included", async () => {
    stubFetch(htmlResponse(200));
    expect(await rejection(getCurrentUser())).toEqual(LAPSED);
  });

  it("proxyAuthError is the same error, for an app's own mocks and tests", () => {
    expect(proxyAuthError()).toEqual(LAPSED);
  });
});

describe("what the request asks a proxy for", () => {
  it("asks for JSON as a script (Accept, X-Requested-With) and doesn't follow redirects", async () => {
    const fetchMock = stubFetch(jsonResponse([], 200));
    await safeFetch("/widgets");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
    expect(init.redirect).toBe("manual");
  });

  it("keeps the caller's own headers, method, body and redirect choice", async () => {
    const fetchMock = stubFetch(jsonResponse({ id: 1 }, 201));
    await safeFetch("/widgets", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/problem+json" },
      body: "{}",
      redirect: "follow",
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(init.redirect).toBe("follow");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/problem+json");
  });
});

describe("the app's own answers are unchanged", () => {
  it("a JSON 200 resolves with its body", async () => {
    stubFetch(jsonResponse([{ id: 1 }], 200));
    const res = await safeFetch("/widgets");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
    expect(res.foreign).toBeUndefined();
  });

  it("a 204 resolves with no body", async () => {
    stubFetch(new Response(null, { status: 204 }));
    const res = await safeFetch("/widgets/1", { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(res.body).toBeUndefined();
  });

  it("a same-origin redirect followed is the app's answer, not the proxy's", async () => {
    vi.stubGlobal("location", { origin: "https://app.example.com" });
    stubFetch(withFetchState(jsonResponse([], 200), { redirected: true, url: "https://app.example.com/api/widgets/" }));
    const res = await safeFetch("/widgets", { redirect: "follow" });
    expect(res.body).toEqual([]);
  });

  // Each of the foundation's error envelopes, through safeFetch and the
  // caller's toAppError, as an app's gateway module does it.
  it.each([
    [401, { detail: "Not authenticated" }, { kind: "auth", message: "Not authenticated" }],
    [403, { detail: "Not yours" }, { kind: "server", message: "Not yours" }],
    [404, { detail: "Widget not found" }, { kind: "notfound", message: "Widget not found" }],
    [
      422,
      { detail: [{ loc: ["body", "name"], msg: "Field required", type: "missing" }] },
      { kind: "validation", message: "Validation failed", fieldErrors: { name: ["Field required"] } },
    ],
    [500, { detail: "Internal Server Error" }, { kind: "server", message: "Internal Server Error" }],
  ] as const)("a JSON %i is the AppError it always was", async (status, body, expected) => {
    stubFetch(jsonResponse(body, status));
    const res = await safeFetch("/widgets");
    expect(res.foreign).toBeUndefined();
    expect(toAppError(res.status, res.body, res.headers)).toEqual(expected);
  });

  it("a JSON 429 keeps its Retry-After", async () => {
    stubFetch(jsonResponse({ detail: "Slow down" }, 429, { "retry-after": "30" }));
    const res = await safeFetch("/auth/login", { method: "POST" });
    expect(toAppError(res.status, res.body, res.headers)).toEqual({
      kind: "rate_limited",
      message: "Slow down",
      retryAfterSeconds: 30,
    });
  });

  it("an HTML 502 (a load balancer's page) is still a server error, not a sign-in", async () => {
    stubFetch(htmlResponse(502));
    const res = await safeFetch("/widgets");
    expect(toAppError(res.status, res.body, res.headers)).toEqual({
      kind: "server",
      message: "Request failed with status 502",
    });
  });

  it("an HTML 404 is still not found", async () => {
    stubFetch(htmlResponse(404));
    const res = await safeFetch("/widgets/9");
    expect(toAppError(res.status, res.body, res.headers).kind).toBe("notfound");
  });

  it("a fetch that fails outright is still a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect((await rejection(safeFetch("/widgets"))).kind).toBe("network");
  });
});
