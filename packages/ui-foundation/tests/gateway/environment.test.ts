// The gateway for GET /environment (openapi/foundation.yaml,
// getDataEnvironment): the backend's data label, or null for production
// data and for an app whose backend doesn't serve the optional path.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDataLabel } from "../../src/api/gateway/environment";

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDataLabel", () => {
  it("GETs /api/environment and resolves with the label", async () => {
    const fetchMock = stubFetch(json({ dataLabel: "dev" }));
    await expect(getDataLabel()).resolves.toBe("dev");
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/environment");
  });

  it("resolves null for production data", async () => {
    stubFetch(json({ dataLabel: null }));
    await expect(getDataLabel()).resolves.toBeNull();
  });

  it("resolves null for a blank label", async () => {
    stubFetch(json({ dataLabel: "  " }));
    await expect(getDataLabel()).resolves.toBeNull();
  });

  it("resolves null when the backend doesn't serve the path (404)", async () => {
    stubFetch(json({ detail: "Not Found" }, 404));
    await expect(getDataLabel()).resolves.toBeNull();
  });

  it("resolves null for a 200 that isn't JSON (a dev server's index.html)", async () => {
    stubFetch(new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } }));
    await expect(getDataLabel()).resolves.toBeNull();
  });

  it("rejects with a server AppError on a 500", async () => {
    stubFetch(json({ detail: "boom" }, 500));
    await expect(getDataLabel()).rejects.toEqual({ kind: "server", message: "boom" });
  });

  it("rejects with a network AppError when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(getDataLabel()).rejects.toMatchObject({ kind: "network" });
  });
});
