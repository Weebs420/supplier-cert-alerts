import { getCurrentOrg, withOrgContext } from "@/src/lib/tenancy";
import { assertSubscriptionActive } from "@/src/lib/subscription";
import { extractCertificateData } from "@/src/lib/extraction";
import { uploadCertificateFile } from "@/src/lib/r2";
import { apiError } from "@/src/lib/http";
export async function GET() { try { const { organization_id } = await getCurrentOrg(); await assertSubscriptionActive(organization_id); const u = await withOrgContext(organization_id, c => c.query(`SELECT u.id, u.file_name, u.status, u.confidence, u.raw_extraction, u.created_at, s.name AS supplier_name FROM certificate_uploads u LEFT JOIN suppliers s ON u.supplier_id = s.id ORDER BY u.created_at DESC`).then(r => r.rows)); return Response.json(u); } catch (e) { return apiError(e); } }
export async function POST(req: Request) {
  try {
    const { organization_id, user_id } = await getCurrentOrg(); await assertSubscriptionActive(organization_id);
    const form = await req.formData(); const file = form.get("file");
    if (!file || typeof file === "string") return Response.json({ error: "file required" }, { status: 400 });
    const f = file as File; const mediaType = f.type || "application/pdf"; const uploadId = crypto.randomUUID(); const buf = await f.arrayBuffer();
    const up = await uploadCertificateFile(organization_id, uploadId, buf, f.name, mediaType);
    let extracted: any = null; let conf: string | null = null;
    try { extracted = await extractCertificateData(buf, mediaType); conf = extracted.confidence ?? null; } catch (e) { console.error("Extraction failed:", e); }
    const row = await withOrgContext(organization_id, c => c.query(`INSERT INTO certificate_uploads (organization_id, uploaded_by, file_url, file_name, file_type, file_key, raw_extraction, extracted_data, confidence, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_review') RETURNING *`, [organization_id, user_id, up.key, f.name, mediaType, up.key, extracted ? JSON.stringify(extracted) : null, extracted ? JSON.stringify(extracted) : null, conf]).then(r => r.rows[0]));
    return Response.json(row, { status: 201 });
  } catch (e) { return apiError(e); }
}
