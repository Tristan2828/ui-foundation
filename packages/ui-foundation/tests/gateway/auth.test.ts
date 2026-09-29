// Gateway contract tests for the `register` function in
// src/api/gateway/auth.ts — written TDD-style, derived only from
// openapi.yaml (operationId `register`, POST /auth/register) and
// src/api/contracts.ts. Do NOT make these pass by reading the gateway
// implementation.
//
// If src/api/gateway/auth.ts does not yet export `register`, these tests
// fail with a "no matching export" / type error rather than a false pass.

import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "../../src/api/gateway/auth";
import type { AppError } from "../../src/api/contracts";
import type { components } from "../../src/api/schema";

type User = components["schemas"]["User"];
type RegisterRequest = components["schemas"]["RegisterRequest"];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubFetchRejecting(error: unknown) {
  const fetchMock = vi.fn().mockRejectedValue(error);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function calledUrl(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): URL {
  const [urlArg] = fetchMock.mock.calls[callIndex];
  // The gateway may call fetch with a string, a URL, or a Request — coerce
  // to a URL against a dummy origin so relative "/api/..." paths parse.
  return new URL(String(urlArg), "http://localhost");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("register", () => {
  const input: RegisterRequest = {
    email: "new.user@example.com",
    name: "New User",
    password: "hunter22",
  };

  it("POSTs to /api/auth/register with the input as JSON and resolves with the User on 200", async () => {
    const user: User = { id: 5, email: input.email, name: input.name };
    const fetchMock = stubFetch(jsonResponse(user, 200));

    const result = await register(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/auth/register");
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(input);
    expect(result).toEqual(user);
  });

  it("throws AppError{kind:'validation'} with fieldErrors.email populated on a 422 duplicate-email response", async () => {
    const body = {
      detail: [
        {
          loc: ["body", "email"],
          msg: "a user with this email already exists",
          type: "value_error",
        },
      ],
    };
    stubFetch(jsonResponse(body, 422));

    let caught: AppError | undefined;
    try {
      await register(input);
      expect.unreachable("register should have thrown");
    } catch (err) {
      caught = err as AppError;
    }

    expect(caught?.kind).toBe("validation");
    expect(caught?.fieldErrors).toEqual({
      email: ["a user with this email already exists"],
    });
  });

  it("throws AppError{kind:'server'} on 500", async () => {
    stubFetch(jsonResponse({ detail: "Internal Server Error" }, 500));

    await expect(register(input)).rejects.toMatchObject({
      kind: "server",
    } satisfies Partial<AppError>);
  });

  it("throws AppError{kind:'network'} on a network-level failure, never resolving", async () => {
    stubFetchRejecting(new TypeError("Failed to fetch"));

    await expect(register(input)).rejects.toMatchObject({
      kind: "network",
    } satisfies Partial<AppError>);
  });
});
