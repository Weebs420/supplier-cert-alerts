import { env } from "cloudflare:workers";

const MAX_STORAGE_FILENAME_LENGTH = 120;

function sanitizeStorageFilename(filename: string): string {
  const base =
    filename
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, MAX_STORAGE_FILENAME_LENGTH) || "document";

  return base || "document";
}

function hasCloudflareBucket(): boolean {
  return !!(env && typeof env === "object" && "CERT_BUCKET" in env && env.CERT_BUCKET);
}

function hasBlobToken(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
}

export async function uploadCertificateFile(
  orgId: string,
  uploadId: string,
  file: File | ArrayBuffer,
  filename: string,
  contentType: string,
): Promise<{ key: string; size: number; contentType: string }> {
  if (!hasCloudflareBucket() && !hasBlobToken()) {
    throw new Error(
      "[storage] No file storage configured. Set CERT_BUCKET in Cloudflare or BLOB_READ_WRITE_TOKEN for Vercel Blob.",
    );
  }

  const safeFileName = sanitizeStorageFilename(filename);
  const key = `${orgId}/${uploadId}/${safeFileName}`;

  if (hasCloudflareBucket()) {
    await env.CERT_BUCKET.put(key, file, { httpMetadata: { contentType } });
    return {
      key,
      size: file instanceof File ? file.size : (file as ArrayBuffer).byteLength,
      contentType,
    };
  }

  const { put } = await import("@vercel/blob");
  const result = await put(key, file, {
    access: "public",
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });

  return {
    key: result.url ?? key,
    size: file instanceof File ? file.size : (file as ArrayBuffer).byteLength,
    contentType,
  };
}

export async function getCertificateFile(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  if (hasCloudflareBucket()) {
    const obj = await env.CERT_BUCKET.get(key);
    if (!obj) return null;
    return {
      body: obj.body,
      contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }

  return null;
}

export async function deleteCertificateFile(key: string): Promise<void> {
  if (hasCloudflareBucket()) {
    await env.CERT_BUCKET.delete(key);
    return;
  }

  if (hasBlobToken()) {
    const { del } = await import("@vercel/blob");
    await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN! });
  }
}
