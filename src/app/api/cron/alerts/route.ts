import { runAlertJob } from "@/src/lib/alert-job";

export async function GET() {
  return Response.json({ error: "Method not allowed. Use POST." }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret === "change-me") {
    return Response.json({ error: "Cron not configured" }, { status: 503 });
  }

  const authorization = req.headers.get("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const providedToken = authorization.slice("Bearer ".length).trim();
  if (providedToken !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAlertJob();
    if (!result.ok) {
      return Response.json(result, { status: 500 });
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: "failed", detail: (e as Error).message }, { status: 500 });
  }
}
