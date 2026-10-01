import { Pool } from "pg";
import { Resend } from "resend";
import process from "node:process";

const pool = new Pool({ connectionString: process.env.ALERT_DATABASE_URL || process.env.DATABASE_URL, max: 3 });
if (!process.env.ALERT_DATABASE_URL) console.warn("[alert-job] WARNING: ALERT_DATABASE_URL not set.");

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not configured");
    _resend = new Resend(key);
  }
  return _resend;
}

const APP_URL = process.env.APP_URL || "https://yourapp.com";
const ALERT_FROM = process.env.ALERT_FROM_EMAIL || "alerts@yourdomain.com";

interface DueAlert {
  certificate_id: string;
  certificate_type: string;
  expiry_date: Date | string;
  supplier_name: string;
  recipient_email: string;
  days_before_expiry: number;
}

async function recomputeStatuses(): Promise<number> {
  const { rowCount } = await pool.query(`update certificates set status = case when expiry_date <= current_date then 'expired' when expiry_date <= current_date + interval '90 days' then 'expiring_soon' else 'active' end where expiry_date <= current_date + interval '90 days'`);
  return rowCount ?? 0;
}

async function findDueAlerts(): Promise<DueAlert[]> {
  const { rows } = await pool.query(`select c.id as certificate_id, c.certificate_type, c.expiry_date, s.name as supplier_name, u.email as recipient_email, ar.days_before_expiry from certificates c join suppliers s on s.id = c.supplier_id join users u on u.id = s.owner_user_id join alert_rules ar on ar.supplier_id = s.id where c.status = 'active' and c.expiry_date <= current_date + (ar.days_before_expiry || ' days')::interval`);
  return rows as DueAlert[];
}

async function sendAlert(row: DueAlert): Promise<void> {
  const expiry = row.expiry_date instanceof Date ? row.expiry_date.toISOString().slice(0, 10) : String(row.expiry_date).slice(0, 10);
  await getResend().emails.send({
    from: ALERT_FROM,
    to: row.recipient_email,
    subject: `${row.supplier_name}'s ${row.certificate_type} expires in ${row.days_before_expiry} days`,
    html: `<p><strong>${row.supplier_name}</strong> ${row.certificate_type} expires on ${expiry}.</p><p><a href="${APP_URL}">Review certificate</a></p>`,
  });
  await pool.query(`insert into alerts_sent (certificate_id, days_before_expiry, recipient_email) values ($1, $2, $3)`, [row.certificate_id, row.days_before_expiry, row.recipient_email]);
}

export async function runAlertJob(): Promise<{ refreshed: number; checked: number; sent: number; errors: string[] }> {
  const errors: string[] = [];
  let refreshed = 0;
  let sent = 0;

  try {
    refreshed = await recomputeStatuses();
  } catch (err) {
    errors.push(`Status refresh failed: ${(err as Error).message}`);
    if ((err as Error).message.includes("row-level security")) throw err;
  }

  let due: DueAlert[] = [];
  try {
    due = await findDueAlerts();
  } catch (err) {
    errors.push(`Alert query failed: ${(err as Error).message}`);
  }

  for (const row of due) {
    try {
      await sendAlert(row);
      sent++;
    } catch (err) {
      errors.push(`Send failed: ${(err as Error).message}`);
    }
  }

  return { refreshed, checked: due.length, sent, errors };
}
