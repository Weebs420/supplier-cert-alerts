import { pool } from "@/src/lib/pool";
import { resolveOrganizationFromCustomer, verifyLemonSqueezyWebhook } from "@/src/lib/payments";
import { apiError } from "@/src/lib/http";
const STATUS_MAP: Record<string, string> = { active: "active", on_trial: "trialing", cancelled: "canceled", expired: "canceled", past_due: "past_due", paused: "past_due", unpaid: "past_due" };
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-signature") || "";
    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "";
    if (!verifyLemonSqueezyWebhook(body, signature, secret)) return Response.json({ error: "invalid signature" }, { status: 401 });
    const event = JSON.parse(body);
    const eventName = event.meta?.event_name || "";
    const customData = event.meta?.custom_data || {};
    const customerEmail = event.data?.attributes?.user_email || event.meta?.customer_email;
    const customerId = String(event.data?.attributes?.customer_id || "");
    const variantId = String(event.data?.attributes?.variant_id || "");
    const coreProductIds = (process.env.LEMON_PRODUCT_CORE || "").split(",").filter(Boolean);
    const isCore = coreProductIds.includes(variantId);
    const plan = isCore ? "core" : "full_suite";
    let newStatus: string | null = null;
    if (eventName.startsWith("subscription_")) { const lsStatus = event.data?.attributes?.status || ""; newStatus = STATUS_MAP[lsStatus] || null; }
    else if (eventName === "order_created") { newStatus = "active"; }
    if (newStatus) {
      const client = await pool.connect();
      try {
        const orgId = await resolveOrganizationFromCustomer(client, { customerId, email: customerEmail, customData });
        if (orgId) { await client.query(`update organizations set subscription_status = $1, subscription_plan = $2 where id = $3`, [newStatus, plan, orgId]); console.log(`[ls-webhook] Updated org ${orgId} → ${newStatus} (${plan}) [event: ${eventName}]`); }
        else { console.warn("[ls-webhook] Could not resolve org", { customerId, email: customerEmail }); }
      } finally { client.release(); }
    }
    return Response.json({ received: true });
  } catch (err) { console.error("[ls-webhook] Failed:", err); return apiError(err); }
}
