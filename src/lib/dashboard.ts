import { withOrgContext } from "./tenancy";
export async function getDashboardData(organizationId: string) {
  return withOrgContext(organizationId, async (client) => {
    const [statusCounts, needsAttention, supplierCount] = await Promise.all([
      client.query(`select status, count(*)::int as count from certificates group by status`),
      client.query(`select c.id, c.certificate_type, c.expiry_date::text, c.status, s.name as supplier_name from certificates c join suppliers s on s.id = c.supplier_id where c.status in ('expiring_soon', 'expired') order by c.expiry_date asc`),
      client.query(`select count(*)::int as count from suppliers`),
    ]);
    const counts = { valid: 0, expiring_soon: 0, expired: 0 };
    for (const row of statusCounts.rows) counts[row.status as keyof typeof counts] = row.count;
    return { counts, supplierCount: supplierCount.rows[0].count, needsAttention: needsAttention.rows };
  });
}
