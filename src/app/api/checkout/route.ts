import { getCurrentOrg } from "@/src/lib/tenancy";
import { createCheckoutSession } from "@/src/lib/payments";
import { pool } from "@/src/lib/pool";
import { apiError } from "@/src/lib/http";
export async function POST(req: Request) {
  try {
    const { organization_id } = await getCurrentOrg(); const body = await req.json(); const productId = body.productId || process.env.LEMON_PRODUCT_CORE;
    if (!productId) return Response.json({ error: "productId is required" }, { status: 400 });
    const { rows } = await pool.query(`select email, name from users where organization_id = $1 and role = 'admin' limit 1`, [organization_id]);
    if (!rows[0]) return Response.json({ error: "No admin user found for this organization" }, { status: 400 });
    const checkoutUrl = await createCheckoutSession({ email: rows[0].email, name: rows[0].name || rows[0].email, productId, returnUrl: `${process.env.APP_URL}/billing/success`, organizationId: organization_id });
    return Response.json({ checkoutUrl });
  } catch (e) { return apiError(e); }
}
