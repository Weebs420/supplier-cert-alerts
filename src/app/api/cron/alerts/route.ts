import { runAlertJob } from "@/src/lib/alert-job";
export async function GET(req: Request) {
  const s = process.env.CRON_SECRET;
  if (!s || s === "change-me") return Response.json({ error: "Cron not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${s}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  try { return Response.json(await runAlertJob()); } catch (e) { return Response.json({ error: "failed", detail: (e as Error).message }, { status: 500 }); }
}
