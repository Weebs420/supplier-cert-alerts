import { Webhook } from "svix";
import { pool } from "@/src/lib/pool";
import { apiError } from "@/src/lib/http";
export async function POST(req: Request) {
  const payload = await req.text();
  const headers = { "svix-id": req.headers.get("svix-id"), "svix-timestamp": req.headers.get("svix-timestamp"), "svix-signature": req.headers.get("svix-signature") };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");
  let event; try { event = wh.verify(payload, headers); } catch { return Response.json({ error: "invalid" }, { status: 400 }); }
  if (event.type === "user.created") {
    const user = event.data; const clerkId = user.id;
    const email = user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address || user.email_addresses?.[0]?.email_address;
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
    if (!email) return Response.json({ error: "no email" }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const existing = await client.query(`select id from users where clerk_user_id = $1`, [clerkId]);
      if (existing.rows.length > 0) { await client.query("commit"); return Response.json({ received: true, skipped: true }); }
      const byEmail = await client.query(`select id, organization_id from users where email = $1`, [email]);
      if (byEmail.rows.length > 0) { await client.query(`update users set clerk_user_id = $1, name = coalesce(name, $2) where id = $3`, [clerkId, name, byEmail.rows[0].id]); await client.query("commit"); return Response.json({ received: true, linked: true }); }
      const orgName = (email.includes("@") ? email.split("@")[1].split(".")[0] : "Org") + " Manufacturing";
      const { rows: orgs } = await client.query(`insert into organizations (name, industry_vertical, subscription_plan, subscription_status) values ($1, 'food_beverage', 'core', 'trialing') returning id`, [orgName]);
      await client.query(`insert into users (organization_id, email, name, role, clerk_user_id) values ($1, $2, $3, 'admin', $4)`, [orgs[0].id, email, name, clerkId]);
      await client.query("commit");
    } catch (err) { await client.query("rollback"); return apiError(err); } finally { client.release(); }
  }
  return Response.json({ received: true });
}
