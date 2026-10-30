export const EXTRACTION_SYSTEM_PROMPT = `You are a document-extraction assistant for a supplier compliance platform. Extract fields from a supplier certification document. Respond with ONLY a JSON object. Fields: certificate_type, issuing_body, certificate_number, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD, most important), supplier_name, confidence (high/medium/low), notes. Rules: null for missing fields, normalize dates, low confidence if unsure about expiry_date.`;

export interface ExtractedCert {
  certificate_type: string | null;
  issuing_body: string | null;
  certificate_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  supplier_name: string | null;
  confidence: "high" | "medium" | "low" | null;
  notes: string | null;
}

const ALLOWED_MEDIA_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_EXTRACTION_BYTES = 12 * 1024 * 1024;

function normalizeExtractionResult(raw: any): ExtractedCert {
  const result = raw ?? {};
  return {
    certificate_type: typeof result.certificate_type === "string" ? result.certificate_type : null,
    issuing_body: typeof result.issuing_body === "string" ? result.issuing_body : null,
    certificate_number: typeof result.certificate_number === "string" ? result.certificate_number : null,
    issue_date: typeof result.issue_date === "string" ? result.issue_date : null,
    expiry_date: typeof result.expiry_date === "string" ? result.expiry_date : null,
    supplier_name: typeof result.supplier_name === "string" ? result.supplier_name : null,
    confidence:
      result.confidence === "high" || result.confidence === "medium" || result.confidence === "low"
        ? result.confidence
        : null,
    notes: typeof result.notes === "string" ? result.notes : null,
  };
}

export async function extractCertificateData(fileBase64: string | ArrayBuffer, mediaType: string): Promise<ExtractedCert> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("[extraction] ANTHROPIC_API_KEY is missing");
  }

  const normalizedType = mediaType || "application/pdf";
  if (!ALLOWED_MEDIA_TYPES.has(normalizedType)) {
    throw new Error(`[extraction] Unsupported media type: ${normalizedType}`);
  }

  const rawData = typeof fileBase64 === "string" ? Buffer.from(fileBase64, "base64") : Buffer.from(fileBase64);
  if (rawData.length === 0) {
    throw new Error("[extraction] File payload is empty");
  }

  if (rawData.length > MAX_EXTRACTION_BYTES) {
    throw new Error("[extraction] File is too large for extraction");
  }

  const base64Data = typeof fileBase64 === "string" ? fileBase64 : rawData.toString("base64");
  const contentBlock =
    normalizedType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: normalizedType, data: base64Data },
        };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: EXTRACTION_SYSTEM_PROMPT }, contentBlock],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Extraction API error: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const textBlock = data?.content?.find((block: { type?: string }) => block?.type === "text");
  if (!textBlock?.text) {
    throw new Error("Extraction API returned no text result");
  }

  try {
    const parsed = JSON.parse(textBlock.text);
    const normalized = normalizeExtractionResult(parsed);

    const hasContent = Boolean(
      normalized.certificate_type ||
        normalized.issuing_body ||
        normalized.certificate_number ||
        normalized.expiry_date ||
        normalized.supplier_name,
    );

    if (!hasContent) {
      throw new Error("Extraction result does not contain usable certificate fields");
    }

    return normalized;
  } catch (error) {
    throw new Error(`Extraction result was not valid JSON: ${(error as Error).message}`);
  }
}
