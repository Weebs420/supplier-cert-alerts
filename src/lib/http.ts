export function apiError(err: unknown): Response {
  const e = err as Error & { status?: number; code?: string };
  if (e.status) return Response.json({ error: e.message, code: e.code }, { status: e.status });
  if (e.message === "Not authenticated" || e.message?.startsWith("No app user")) return Response.json({ error: e.message }, { status: 401 });
  console.error("[api] Unhandled error:", e);
  return Response.json({ error: e.message ?? "Internal server error" }, { status: 500 });
}
