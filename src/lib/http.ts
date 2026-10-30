export function apiError(err: unknown): Response {
  const e = err as Error & { status?: number; code?: string };
  const status = e.status ?? 500;

  if (e.status && status < 500) {
    return Response.json({ error: e.message ?? "Request failed", code: e.code }, { status });
  }

  if (e.message === "Not authenticated" || e.message?.startsWith("No app user")) {
    return Response.json({ error: e.message }, { status: 401 });
  }

  console.error("[api] Unhandled error:", e);
  return Response.json(
    {
      error: status >= 500 ? "Internal server error" : e.message ?? "Request failed",
      code: e.code ?? "internal_error",
    },
    { status: 500 },
  );
}
