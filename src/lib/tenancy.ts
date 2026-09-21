import { auth } from "@clerk/nextjs/server";
import { pool } from "./pool";
import type { PoolClient } from "pg";
export interface OrgContext { user_id: string; organization_id: string; }
export async function getCurrentOrg(): Promise<OrgContext> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const { rows } = await pool.query(`select id as user_id, organization_id from users where clerk_user_id = $1`, [userId]);
  if (rows.length === 0) throw new Error("No app user linked to this session");
  return rows[0] as OrgContext;
}
export async function withOrgContext<T>(organizationId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("begin"); await client.query(`select set_config('app.current_org_id', $1, true)`, [organizationId]); const result = await fn(client); await client.query("commit"); return result; }
  catch (err) { await client.query("rollback"); throw err; } finally { client.release(); }
}
export async function runScoped<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> { const { organization_id } = await getCurrentOrg(); return withOrgContext(organization_id, fn); }
