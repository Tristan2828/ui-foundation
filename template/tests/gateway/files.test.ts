// Gateway contract tests for src/api/gateway/files.ts, derived from
// openapi.yaml's /files paths (uploadFile, getFile, getFileContent) and the
// foundation's ImageUploadResult, not from the gateway.
//
// uploadFile: the request body is the picture's own bytes (no multipart
// form), 201 with a File; 413 over 10 MB; 422 on "file" for anything not a
// JPEG, PNG or WebP. getFile: 200 File, 404. getFileContent's address is
// what an <img> or a Markdown image loads: /api/files/{id}/content, with
// size=thumb for a thumbnail.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "@tristan2828/ui-foundation";
import { fileContentUrl, getFile, uploadFile, uploadImage } from "../../src/api/gateway/files";
import type { components } from "../../src/api/schema";

type StoredFile = components["schemas"]["File"];

const STORED: StoredFile = {
  id: 7,
  contentType: "image/webp",
  byteSize: 182_344,
  sha256: "3f".repeat(32),
  createdAt: "2026-11-27T10:00:00Z",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function photo(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "IMG_0042.jpg", { type: "image/jpeg" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadFile", () => {
  it("POSTs the file itself as the body to /api/files, with its type, and resolves with the File", async () => {
    const fetchMock = stubFetch(jsonResponse(STORED, 201));
    const file = photo();

    const result = await uploadFile(file);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(String(url), "http://localhost").pathname).toBe("/api/files");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(file);
    expect(init?.body).not.toBeInstanceOf(FormData);
    expect(new Headers(init?.headers).get("content-type")).toBe("image/jpeg");
    expect(result).toEqual(STORED);
  });

  it("sends application/octet-stream when the browser gave the file no type", async () => {
    const fetchMock = stubFetch(jsonResponse(STORED, 201));

    await uploadFile(new File([new Uint8Array([1])], "photo"));

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("content-type")).toBe("application/octet-stream");
  });

  it("throws AppError{kind:'validation'} with the file's field error on a 422", async () => {
    stubFetch(
      jsonResponse({ detail: [{ loc: ["body", "file"], msg: "Only a JPEG, PNG or WebP image can be uploaded.", type: "value_error" }] }, 422),
    );

    await expect(uploadFile(photo())).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { file: ["Only a JPEG, PNG or WebP image can be uploaded."] },
    });
  });

  it("throws an AppError with the server's sentence on a 413", async () => {
    stubFetch(jsonResponse({ detail: "The file is over 10 MB." }, 413));

    await expect(uploadFile(photo())).rejects.toMatchObject({ message: "The file is over 10 MB." } satisfies Partial<AppError>);
  });

  it("throws AppError{kind:'network'} when the request never lands", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(uploadFile(photo())).rejects.toMatchObject({ kind: "network" } satisfies Partial<AppError>);
  });
});

describe("uploadImage (the foundation's ImageUpload)", () => {
  it("resolves to the file's id as a string, its thumbnail address and its full address", async () => {
    stubFetch(jsonResponse(STORED, 201));

    await expect(uploadImage(photo())).resolves.toEqual({
      id: "7",
      thumbUrl: "/api/files/7/content?size=thumb",
      url: "/api/files/7/content",
    });
  });

  it("sends the picked file as it is where the browser can't redraw it (no canvas here)", async () => {
    const fetchMock = stubFetch(jsonResponse(STORED, 201));
    const file = photo();

    await uploadImage(file);

    expect(fetchMock.mock.calls[0][1]?.body).toBe(file);
  });

  it("rejects with the file field's reason as the message, which ImageField and the editor show", async () => {
    stubFetch(
      jsonResponse({ detail: [{ loc: ["body", "file"], msg: "Only a JPEG, PNG or WebP image can be uploaded.", type: "value_error" }] }, 422),
    );

    await expect(uploadImage(photo())).rejects.toMatchObject({
      kind: "validation",
      message: "Only a JPEG, PNG or WebP image can be uploaded.",
    });
  });

  it("rejects with the 413's sentence as the message", async () => {
    stubFetch(jsonResponse({ detail: "The file is over 10 MB." }, 413));

    await expect(uploadImage(photo())).rejects.toMatchObject({ message: "The file is over 10 MB." });
  });
});

describe("getFile", () => {
  it("GETs /api/files/{id} and resolves with the File", async () => {
    const fetchMock = stubFetch(jsonResponse(STORED, 200));

    const result = await getFile(7);

    expect(new URL(String(fetchMock.mock.calls[0][0]), "http://localhost").pathname).toBe("/api/files/7");
    expect(result).toEqual(STORED);
  });

  it("throws AppError{kind:'notfound'} on a 404 (missing, or another user's)", async () => {
    stubFetch(jsonResponse({ detail: "File not found" }, 404));

    await expect(getFile(99)).rejects.toMatchObject({ kind: "notfound" } satisfies Partial<AppError>);
  });
});

describe("fileContentUrl", () => {
  it("is the content address under /api, with size only for a thumbnail", () => {
    expect(fileContentUrl(7)).toBe("/api/files/7/content");
    expect(fileContentUrl(7, "large")).toBe("/api/files/7/content");
    expect(fileContentUrl(7, "thumb")).toBe("/api/files/7/content?size=thumb");
  });
});
