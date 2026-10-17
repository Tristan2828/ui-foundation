// Gateway contract tests for `login` and `loginTotp` (src/api/gateway/auth.ts),
// from openapi/foundation.yaml: POST /auth/login answers 200 (User), 202
// (LoginNextStep), 401, 422, 429 (with Retry-After) or 500; POST
// /auth/login/totp answers 200, 401, 410 (start again), 422, 429 or 500.
import { afterEach, describe, expect, it, vi } from "vitest";
import { login, loginTotp } from "../../src/api/gateway/auth";
import { toAppError } from "../../src/api/gateway/errors";
import type { AppError } from "../../src/api/contracts";

const USER = { id: 7, email: "a@example.com", name: "A" };

function stubFetch(body: unknown, status: number, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } }),
  );
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
  vi.useRealTimers();
});

describe("login", () => {
  it("resolves with the user on 200", async () => {
    const fetchMock = stubFetch(USER, 200);
    expect(await login({ email: USER.email, password: "secret-123" })).toEqual({ user: USER });
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/auth/login");
  });

  it("resolves with the next step on 202, signing nobody in", async () => {
    stubFetch({ next: "totp" }, 202);
    expect(await login({ email: USER.email, password: "secret-123" })).toEqual({ next: "totp" });
  });

  it("throws kind 'auth' on 401", async () => {
    stubFetch({ detail: "Invalid email or password" }, 401);
    expect(await rejection(login({ email: USER.email, password: "nope-nope" }))).toEqual({
      kind: "auth",
      message: "Invalid email or password",
    });
  });

  it("throws kind 'rate_limited' with Retry-After's seconds on 429", async () => {
    stubFetch({ detail: "Too many sign-in attempts. Try again in 15 minutes." }, 429, { "Retry-After": "900" });
    expect(await rejection(login({ email: USER.email, password: "secret-123" }))).toEqual({
      kind: "rate_limited",
      message: "Too many sign-in attempts. Try again in 15 minutes.",
      retryAfterSeconds: 900,
    });
  });
});

describe("loginTotp", () => {
  it("POSTs the code and resolves with the user on 200", async () => {
    const fetchMock = stubFetch(USER, 200);
    expect(await loginTotp({ code: "123456" })).toEqual({ user: USER });
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/auth/login/totp");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ code: "123456" });
  });

  it("throws kind 'auth' on a wrong code (401)", async () => {
    stubFetch({ detail: "That code isn't right." }, 401);
    expect((await rejection(loginTotp({ code: "000000" }))).kind).toBe("auth");
  });

  it("resolves with the server's reason to start again on 410", async () => {
    stubFetch({ detail: "Too many wrong codes. Enter your email and password again." }, 410);
    expect(await loginTotp({ code: "000000" })).toEqual({
      restart: "Too many wrong codes. Enter your email and password again.",
    });
  });

  it("throws kind 'rate_limited' on 429", async () => {
    stubFetch({ detail: "Too many sign-in attempts. Try again in 2 minutes." }, 429, { "Retry-After": "61" });
    expect(await rejection(loginTotp({ code: "000000" }))).toMatchObject({
      kind: "rate_limited",
      retryAfterSeconds: 61,
    });
  });
});

describe("toAppError 429", () => {
  it("is rate_limited without retryAfterSeconds when there's no Retry-After", () => {
    expect(toAppError(429, { detail: "Slow down" })).toEqual({ kind: "rate_limited", message: "Slow down" });
  });

  it("reads an HTTP-date Retry-After as the seconds from now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
    const headers = new Headers({ "Retry-After": "Fri, 16 Oct 2026 12:01:30 GMT" });
    expect(toAppError(429, { detail: "Slow down" }, headers).retryAfterSeconds).toBe(90);
  });

  it("ignores a Retry-After it can't read", () => {
    const headers = new Headers({ "Retry-After": "soon" });
    expect(toAppError(429, { detail: "Slow down" }, headers)).toEqual({ kind: "rate_limited", message: "Slow down" });
  });
});
