// MSW handlers for /files (openapi.yaml uploadFile, getFile,
// getFileContent) against an in-memory store: the picture is the request
// body, its type read from its first bytes as the backend does
// (foundation_backend.uploads.image_type), and served back with the same
// headers. Reset with the rest of the mock data (resetMockData in ./data).
import { http, HttpResponse } from "msw";
import type { components } from "../api/schema";

type StoredFile = components["schemas"]["File"];
type ContentType = StoredFile["contentType"];

const MAX_BYTES = 10 * 1024 * 1024;
const REFUSED = "Only a JPEG, PNG or WebP image can be uploaded.";
const EXTENSIONS: Record<ContentType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type MockFile = { record: StoredFile; bytes: Uint8Array };

let stored: MockFile[] = [];
let nextId = 1;

export function resetFilesData(): void {
  stored = [];
  nextId = 1;
}

// The type the bytes say, never the name or the request's Content-Type.
function imageType(bytes: Uint8Array): ContentType | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => bytes[i] === byte)) return "image/png";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function refuse(msg: string) {
  return HttpResponse.json({ detail: [{ loc: ["body", "file"], msg, type: "value_error" }] }, { status: 422 });
}

function notFound() {
  return HttpResponse.json({ detail: "File not found" }, { status: 404 });
}

function find(id: unknown): MockFile | undefined {
  return stored.find((file) => file.record.id === Number(id));
}

export const fileHandlers = [
  http.post("*/api/files", async ({ request }) => {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > MAX_BYTES) return HttpResponse.json({ detail: "The file is over 10 MB." }, { status: 413 });
    if (bytes.length === 0) return refuse("The file is empty.");
    const contentType = imageType(bytes);
    if (!contentType) return refuse(REFUSED);
    const record: StoredFile = {
      id: nextId++,
      contentType,
      byteSize: bytes.length,
      sha256: await sha256(bytes),
      createdAt: new Date().toISOString(),
    };
    stored.push({ record, bytes });
    return HttpResponse.json(record, { status: 201 });
  }),

  http.get("*/api/files/:id", ({ params }) => {
    const found = find(params.id);
    return found ? HttpResponse.json(found.record) : notFound();
  }),

  http.get("*/api/files/:id/content", ({ params }) => {
    const found = find(params.id);
    if (!found) return notFound();
    const { id, contentType } = found.record;
    return new HttpResponse(found.bytes.slice().buffer as ArrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${id}.${EXTENSIONS[contentType]}"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }),
];
