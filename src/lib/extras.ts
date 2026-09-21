// Merged: risk scoring + vertical packs + PDF audit export
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
interface RiskInput { certificates?: { status: string }[]; audits?: { outcome: string }[] }
interface RiskOutput { score: number; band: "low" | "medium" | "high" | "critical"; factors: Record<string, unknown> }
export function computeRiskScore(input: RiskInput): RiskOutput {
  const certs = input.certificates ?? []; const audits = input.audits ?? [];
  let score = 100; const factors: Record<string, unknown> = {};
  const expired = certs.filter(c => c.status === "expired").length;
  const soon = certs.filter(c => c.status === "expiring_soon").length;
  score -= Math.min(50, expired * 25) + Math.min(30, soon * 10);
  factors.certificates = { expired, soon, valid: certs.filter(c => c.status === "valid").length };
  const fails = audits.filter(a => a.outcome === "fail").length;
  score -= Math.min(40, fails * 20);
  factors.audits = { fails };
  if (certs.length === 0) { score = Math.min(score, 40); factors.noCertificates = true; }
  score = Math.max(0, Math.min(100, score));
  let band: RiskOutput["band"] = "low";
  if (score < 40) band = "critical"; else if (score < 60) band = "high"; else if (score < 80) band = "medium";
  return { score, band, factors };
}
export const VERTICAL_PACKS: Record<string, { label: string; certificateTypes: string[]; positioning: string }> = {
  food_beverage: { label: "Food & Beverage", certificateTypes: ["BRCGS", "FSSC 22000", "HACCP", "ISO 22000", "COA"], positioning: "Never fail a BRCGS audit again." },
  pharmaceuticals: { label: "Pharma", certificateTypes: ["GMP", "GDP", "ISO 13485", "FDA"], positioning: "FDA/EMA supplier qualification." },
  aerospace: { label: "Aerospace", certificateTypes: ["AS9100", "NADCAP", "ISO 9001"], positioning: "AS9100 supplier tracking." },
  automotive: { label: "Automotive", certificateTypes: ["IATF 16949", "VDA 6.3", "PPAP"], positioning: "IATF 16949 compliance." },
};
export function getVerticalPack(key?: string | null) { return VERTICAL_PACKS[key ?? ""] || VERTICAL_PACKS.food_beverage; }
const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN = 40, ROW_H = 18;
const COLUMNS = [{ key: "supplier_name", label: "Supplier", width: 110 }, { key: "certificate_type", label: "Cert Type", width: 80 }, { key: "issuing_body", label: "Issuing Body", width: 85 }, { key: "certificate_number", label: "Cert #", width: 70 }, { key: "issue_date", label: "Issued", width: 55 }, { key: "expiry_date", label: "Expires", width: 55 }, { key: "status", label: "Status", width: 60 }];
const STATUS_COLOR: Record<string, ReturnType<typeof rgb>> = { valid: rgb(0.11, 0.5, 0.22), expiring_soon: rgb(0.72, 0.53, 0.04), expired: rgb(0.75, 0.16, 0.16) };
function fmtDate(v: unknown): string { if (!v) return "—"; if (v instanceof Date) return v.toISOString().slice(0, 10); return String(v).slice(0, 10); }
export async function buildAuditPdf(params: { organization: { name?: string } | null; rows: any[]; counts?: { valid?: number; expiring_soon?: number; expired?: number } }): Promise<Uint8Array> {
  const { organization, rows, counts } = params;
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]); let y = PAGE_H - MARGIN; const pages = [page];
  page.drawText("Certificate Audit Evidence Pack", { x: MARGIN, y, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) }); y -= 20;
  page.drawText(organization?.name || "Organization", { x: MARGIN, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) }); y -= 22;
  if (counts) { page.drawText(`Valid: ${counts.valid || 0}  Expiring: ${counts.expiring_soon || 0}  Expired: ${counts.expired || 0}`, { x: MARGIN, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) }); y -= 24; }
  let x = MARGIN; page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_W - MARGIN * 2, height: ROW_H, color: rgb(0.93, 0.93, 0.93) });
  for (const col of COLUMNS) { page.drawText(col.label, { x: x + 4, y, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) }); x += col.width; } y -= ROW_H;
  for (const r of rows) {
    if (y < MARGIN + ROW_H) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); pages.push(page); y = PAGE_H - MARGIN; }
    x = MARGIN; const color = STATUS_COLOR[r.status] || rgb(0.2, 0.2, 0.2);
    const cells: Record<string, string> = { supplier_name: r.supplier_name, certificate_type: r.certificate_type, issuing_body: r.issuing_body, certificate_number: r.certificate_number, issue_date: fmtDate(r.issue_date), expiry_date: fmtDate(r.expiry_date), status: (r.status || "").replace("_", " ") };
    for (const col of COLUMNS) { const isS = col.key === "status"; const str = cells[col.key] || "—"; page.drawText(str.slice(0, 20), { x: x + 4, y, size: 8, font: isS ? bold : font, color: isS ? color : rgb(0.15, 0.15, 0.15) }); x += col.width; }
    y -= ROW_H;
  }
  return pdfDoc.save();
}
