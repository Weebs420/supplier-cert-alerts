export const EXTRACTION_SYSTEM_PROMPT = `You are a document-extraction assistant for a supplier compliance platform. Extract fields from a supplier certification document. Respond with ONLY a JSON object.
Fields: certificate_type, issuing_body, certificate_number, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD, most important), supplier_name, confidence (high/medium/low), notes.
Rules: null for missing fields, normalize dates, low confidence if unsure about expiry_date.`;
export interface ExtractedCert { certificate_type: string | null; issuing_body: string | null; certificate_number: string | null; issue_date: string | null; expiry_date: string | null; supplier_name: string | null; confidence: "high" | "medium" | "low"; notes: string | null; }
export async function extractCertificateData(fileBase64: string | ArrayBuffer, mediaType: string): Promise<ExtractedCert> {
  let base64Data = typeof fileBase64 === "string" ? fileBase64 : Buffer.from(fileBase64).toString("base64");
  const contentBlock = mediaType === "application/pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } } : { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } };
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 500, system: EXTRACTION_SYSTEM_PROMPT, messages: [{ role: "user", content: [contentBlock, { type: "text", text: "Extract the certificate fields." }] }] }) });
  if (!response.ok) throw new Error(`Extraction API error: ${response.status}`);
  const data = await response.json();
  const textBlock = data.content.find((b: { type: string }) => b.type === "text");
  try { return JSON.parse(textBlock.text) as ExtractedCert; } catch { return { certificate_type: null, issuing_body: null, certificate_number: null, issue_date: null, expiry_date: null, supplier_name: null, confidence: "low", notes: "Parse failed" }; }
}
