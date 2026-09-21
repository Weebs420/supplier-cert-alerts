import { getCurrentOrg, withOrgContext } from "@/src/lib/tenancy";
import { assertSubscriptionActive } from "@/src/lib/subscription";
import { deleteCertificateFile } from "@/src/lib/r2";
import { apiError } from "@/src/lib/http";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organization_id } = await getCurrentOrg(); await assertSubscriptionActive(organization_id);
    const { id } = await params; const fd = await req.formData();
    const supplier_id = fd.get("supplier_id") as string; const certificate_type = fd.get("certificate_type") as string;
    const issuing_body = (fd.get("issuing_body") as string) || null; const certificate_number = (fd.get("certificate_number") as string) || null;
    const issue_date = (fd.get("issue_date") as string) || null; const expiry_date = fd.get("expiry_date") as string;
    if (!supplier_id || !certificate_type || !expiry_date) return Response.json({ error: "supplier_id, certificate_type, expiry_date required" }, { status: 400 });
    const cert = await withOrgContext(organization_id, async (client) => {
      const { rows } = await client.query(`SELECT * FROM certificate_uploads WHERE id = $1 AND status IN ('pending', 'pending_review')`, [id]);
      if (!rows[0]) throw Object.assign(new Error("Upload not found or already reviewed"), { status: 404 });
      const upload = rows[0]; const raw = upload.raw_extraction || {};
      const confMap = { high: 0.95, medium: 0.7, low: 0.4 };
      const conf = typeof raw.confidence === "number" ? raw.confidence : confMap[raw.confidence as keyof typeof confMap] ?? null;
      const { rows: cr } = await client.query(`INSERT INTO certificates (organization_id, supplier_id, certificate_type, issuing_body, certificate_number, issue_date, expiry_date, file_url, extraction_source, extraction_confidence) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ai_extracted', $9) RETURNING *`, [organization_id, supplier_id, certificate_type, issuing_body, certificate_number, issue_date, expiry_date, upload.file_url, conf]);
      await client.query(`UPDATE certificate_uploads SET status = 'confirmed', confirmed_certificate_id = $1, reviewed_at = NOW(), supplier_id = $2 WHERE id = $3`, [cr[0].id, supplier_id, id]);
      return cr[0];
    });
    return Response.json(cert, { status: 201 });
  } catch (e) { return apiError(e); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organization_id } = await getCurrentOrg(); await assertSubscriptionActive(organization_id);
    const { id } = await params;
    await withOrgContext(organization_id, async (client) => {
      const { rows } = await client.query(`SELECT id, file_key, status FROM certificate_uploads WHERE id = $1`, [id]);
      if (!rows[0]) throw Object.assign(new Error("Upload not found"), { status: 404 });
      if (rows[0].status !== "pending" && rows[0].status !== "pending_review") throw Object.assign(new Error("Already reviewed"), { status: 409 });
      await client.query(`UPDATE certificate_uploads SET status = 'rejected', reviewed_at = NOW() WHERE id = $1`, [id]);
      if (rows[0].file_key) { try { await deleteCertificateFile(rows[0].file_key); } catch {} }
    });
    return Response.json({ ok: true });
  } catch (e) { return apiError(e); }
}
