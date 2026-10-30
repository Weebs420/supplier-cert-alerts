import { createHmac, timingSafeEqual } from "node:crypto";

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";
const LS_STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID;
const LS_API_KEY = process.env.LEMON_SQUEEZY_API_KEY;

function authHeaders(): Record<string, string> {
  if (!LS_API_KEY) throw new Error("[lemonsqueezy] LEMON_SQUEEZY_API_KEY not configured");
  return {
    Authorization: `Bearer ${LS_API_KEY}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  };
}

export interface CheckoutParams {
  email: string;
  name: string;
  productId: string;
  returnUrl: string;
  organizationId?: string;
}

export async function createCheckoutSession(params: CheckoutParams): Promise<string> {
  if (!LS_STORE_ID) throw new Error("[lemonsqueezy] LEMON_SQUEEZY_STORE_ID not configured");

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        product: params.productId,
        store: LS_STORE_ID,
        email: params.email,
        name: params.name,
        custom_data: params.organizationId ? { organization_id: params.organizationId } : undefined,
        return_url: params.returnUrl,
      },
    },
  };

  const res = await fetch(`${LS_API_BASE}/checkouts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[lemonsqueezy] Checkout failed:", res.status, errText);
    throw new Error(`Lemon Squeezy checkout failed: ${res.status}`);
  }

  const data = await res.json();
  return data.data.attributes.url as string;
}

export async function resolveOrganizationFromCustomer(
  pgClient: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  params: {
    customerId?: string;
    email?: string;
    customData?: { organization_id?: string };
  },
): Promise<string | null> {
  if (params.customData?.organization_id) return params.customData.organization_id as string;

  if (params.customerId) {
    const byId = await pgClient.query(`select id from organizations where mor_customer_id = $1`, [params.customerId]);
    if (byId.rows.length > 0) return byId.rows[0].id;
  }

  if (params.email) {
    const byEmail = await pgClient.query(`select organization_id from users where email = $1 limit 1`, [params.email]);
    if (byEmail.rows.length === 0) return null;
    return byEmail.rows[0].organization_id as string;
  }

  return null;
}

export function verifyLemonSqueezyWebhook(body: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;

  const provided = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  const expected = createHmac("sha256", secret).update(body).digest("hex");

  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}
