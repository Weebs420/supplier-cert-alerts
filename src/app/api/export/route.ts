import { getCurrentOrg, withOrgContext } from "@/src/lib/tenancy";
import { assertSubscriptionActive } from "@/src/lib/subscription";
import { buildAuditPdf } from "@/src/lib/extras";
import { apiError } from "@/src/lib/http";
export async function GET(req: Request) {
  try {
    const { organization_id } = await getCurrentOrg(); await assertSubscriptionActive(organization_id);
    const url = new URL(req.url); const format = url.searchParams.get("format") || "csv";
    const { organization, rows } = await withOrgContext(organization_id, async (client) => {
      const [o, c] = await Promise.all([client.query(`select name from organizations where id = $1`, [organization_id]), client.query(`select s.name as supplier_name, c.certificate_type, c.issuing_body, c.certificate_number, c.issue_date, c.expiry_date, c.status, c.extraction_source, c.updated_at from certificates c join suppliers s on s.id = c.supplier_id order by c.status = 'expired' desc, s.name, c.expiry_date`)]);
      return { organization: o.rows[0], rows: c.rows };
    });
    if (format === "pdf") { const counts = rows.reduce((a: any, r: any) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}); const pdf = await buildAuditPdf({ organization, rows, counts }); return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="audit.pdf"` } }); }
    const header = ["supplier_name", "certificate_type", "issuing_body", "certificate_number", "issue_date", "expiry_date", "status", "extraction_source", "updated_at"];
    const esc = (v: unknown) => { if (v == null) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [header.join(",")]; for (const r of rows) lines.push(header.map(h => esc(r[h])).join(","));
    return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="export.csv"` } });
  } catch (e) { return apiError(e); }
}
