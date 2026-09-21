import { env } from "cloudflare:workers";
export async function uploadCertificateFile(orgId: string, uploadId: string, file: File | ArrayBuffer, filename: string, contentType: string): Promise<{ key: string; size: number; contentType: string }> {
  const key = `${orgId}/${uploadId}/${filename}`;
  if (env.CERT_BUCKET) { await env.CERT_BUCKET.put(key, file, { httpMetadata: { contentType } }); return { key, size: file instanceof File ? file.size : (file as ArrayBuffer).byteLength, contentType }; }
  if (process.env.BLOB_READ_WRITE_TOKEN) { const { put } = await import("@vercel/blob"); const result = await put(key, file, { access: "public", contentType, token: process.env.BLOB_READ_WRITE_TOKEN }); return { key: result.pathname, size: file instanceof File ? file.size : (file as ArrayBuffer).byteLength, contentType }; }
  throw new Error("No file storage configured");
}
export async function getCertificateFile(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  if (env.CERT_BUCKET) { const obj = await env.CERT_BUCKET.get(key); if (!obj) return null; return { body: obj.body, contentType: obj.httpMetadata?.contentType ?? "application/octet-stream" }; }
  return null;
}
export async function deleteCertificateFile(key: string): Promise<void> {
  if (env.CERT_BUCKET) { await env.CERT_BUCKET.delete(key); return; }
  if (process.env.BLOB_READ_WRITE_TOKEN) { const { del } = await import("@vercel/blob"); await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN }); }
}
