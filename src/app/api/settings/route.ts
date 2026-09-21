import { getCurrentOrg } from "@/src/lib/tenancy";
import { getOrgSubscription } from "@/src/lib/subscription";
import { getVerticalPack } from "@/src/lib/extras";
import { apiError } from "@/src/lib/http";
export async function GET() { try { const { organization_id } = await getCurrentOrg(); const org = await getOrgSubscription(organization_id); if (!org) return Response.json({ error: "Not found" }, { status: 404 }); return Response.json({ organization_id, subscription_status: org.subscription_status, subscription_plan: org.subscription_plan, industry_vertical: org.industry_vertical, vertical: getVerticalPack(org.industry_vertical) }); } catch (e) { return apiError(e); } }
