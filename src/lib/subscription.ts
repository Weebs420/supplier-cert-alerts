import { pool } from "./pool";
const ALLOWED = new Set(["trialing", "active"]);
export interface OrgRow { subscription_status: string; subscription_plan: string; industry_vertical: string; }
export async function getOrgSubscription(organizationId: string): Promise<OrgRow | null> {
  const { rows } = await pool.query(`select subscription_status, subscription_plan, industry_vertical from organizations where id = $1`, [organizationId]);
  return (rows[0] as OrgRow) || null;
}
export async function assertSubscriptionActive(organizationId: string): Promise<OrgRow> {
  const org = await getOrgSubscription(organizationId);
  if (!org) throw Object.assign(new Error("Organization not found"), { status: 404 });
  if (!ALLOWED.has(org.subscription_status)) throw Object.assign(new Error(`Subscription ${org.subscription_status} — renew billing to continue`), { status: 402, code: "subscription_inactive" });
  return org;
}
export function requireFullSuite(org: OrgRow): void {
  if (org.subscription_plan !== "full_suite" && process.env.ENFORCE_FULL_SUITE === "true") throw Object.assign(new Error("Full suite plan required"), { status: 403, code: "upgrade_required" });
}
