import { getCurrentOrg, withOrgContext } from "@/src/lib/tenancy";
import { assertSubscriptionActive } from "@/src/lib/subscription";
import { extractCertificateData } from "@/src/lib/extraction";
import { uploadCertificateFile } from "@/src/lib/r2";
import { apiError } from "@/src/lib/http";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function isAllowedUploadType(mediaType: string): boolean {
  return ALLOWED_UPLOAD_TYPES.has(mediaType);
}

export async function GET() {
  try {
    const { organization_id } = await getCurrentOrg();
    await assertSubscriptionActive(organization_id);
    const u = await withOrgContext(organization_id, (c) =>
      c.query(`select * from certificate_uploads order by created_at desc limit 50`),
    );
    return Response.json(u.rows);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { organization_id } = await getCurrentOrg();
    await assertSubscriptionActive(organization_id);

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "file required" }, { status: 400 });
    }

    const f = file as File;
    const originalType = f.type || "application/pdf";
    const mediaType = originalType.toLowerCase();

    if (!isAllowedUploadType(mediaType)) {
      return Response.json({ error: "Unsupported file type. Upload PDF, PNG, JPG, or WEBP." }, { status: 415 });
    }

    if (f.size === 0 || f.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: `Upload size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes.` }, { status: 413 });
    }

    const uploadId = crypto.randomUUID();
    const buf = await f.arrayBuffer();
    const safeName = (f.name || "certificate").replace(/[\\/]+/g, "_");

    const up = await uploadCertificateFile(organization_id, uploadId, buf, safeName, mediaType);

    let extracted: any = null;
    let extractionStatus = "failed";
    let extractionError: string | null = null;

    try {
      extracted = await extractCertificateData(buf, mediaType);
      extractionStatus = "completed";
    } catch (e) {
      extractionError = (e as Error).message;
      console.error("[uploads] Extraction failed:", extractionError);
    }

    const row = await withOrgContext(organization_id, (c) =>
      c.query(
        `INSERT INTO certificate_uploads
          (organization_id, uploaded_by, file_url, file_name, file_type, file_key, raw_extraction, extraction_status, extraction_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          organization_id,
          null,
          up.key,
          safeName,
          mediaType,
          up.key,
          extracted ? JSON.stringify(extracted) : null,
          extractionStatus,
          extracted?.confidence ?? null,
        ],
      ),
    );

    return Response.json(
      {
        ...row.rows[0],
        extraction: extracted,
        extractionError,
        fileStorage: up,
      },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
