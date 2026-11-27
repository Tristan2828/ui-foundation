// Anti-corruption layer for uploaded pictures (openapi.yaml /files):
// uploads and the records that describe them. Translates between the wire
// shapes and the foundation's UI-owned contracts (ImageUploadResult,
// AppError). Nothing above this module sees a wire response, or builds a
// file's address itself.
import { shrinkImage, type AppError, type ImageUploadResult } from "@tristan2828/ui-foundation";
import { safeFetch, toAppError } from "@tristan2828/ui-foundation/gateway";
import type { components } from "../schema";

export type StoredFile = components["schemas"]["File"];
export type FileSize = "large" | "thumb";

// openapi.yaml uploadFile's limit, for an ImageField's maxSize.
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

// The picture itself is the body: no multipart form. Its type is the
// browser's guess; the server reads the bytes and decides.
export async function uploadFile(file: Blob): Promise<StoredFile> {
  const res = await safeFetch("/files", {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  if (res.status !== 201) throw toAppError(res.status, res.body, res.headers);
  return res.body as StoredFile;
}

// The foundation's ImageUpload (ImageField, RichTextEditor's upload): the
// picture redrawn smaller and without its EXIF first where the browser
// can (shrinkImage), then stored, as its id and its addresses. A refusal's
// reason is the "file" field's, which is what the package shows.
export async function uploadImage(file: File): Promise<ImageUploadResult> {
  let stored: StoredFile;
  try {
    stored = await uploadFile(await shrinkImage(file));
  } catch (error) {
    const appError = error as AppError;
    const reason = appError.kind === "validation" ? appError.fieldErrors?.file?.[0] : undefined;
    throw (reason ? { ...appError, message: reason } : appError) satisfies AppError;
  }
  return { id: String(stored.id), thumbUrl: fileContentUrl(stored.id, "thumb"), url: fileContentUrl(stored.id) };
}

export async function getFile(id: number): Promise<StoredFile> {
  const res = await safeFetch(`/files/${id}`);
  if (res.status !== 200) throw toAppError(res.status, res.body, res.headers);
  return res.body as StoredFile;
}

// What an <img> or a Markdown image loads: same-origin, so the session
// cookie goes with it. The transport's base URL is /api. The full size is
// the bare address, the one stored in text (![](/api/files/7/content)).
export function fileContentUrl(id: number, size: FileSize = "large"): string {
  return size === "thumb" ? `/api/files/${id}/content?size=thumb` : `/api/files/${id}/content`;
}
