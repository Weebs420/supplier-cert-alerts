import { getCurrentOrg } from "@/src/lib/tenancy";
import { getDashboardData } from "@/src/lib/dashboard";
import { assertSubscriptionActive } from "@/src/lib/subscription";
import { apiError } from "@/src/lib/http";
export async function GET() { try { const { organization_id } = await getCurrentOrg(); await assertSubscriptionActive(organization_id); return Response.json(await getDashboardData(organization_id)); } catch (e) { return apiError(e); } }
