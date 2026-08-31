// Postgres-backed rate limiting — replaces slowapi's in-memory limiter, which
// doesn't work across serverless invocations with no shared memory.
import { getSupabaseAdmin } from "./supabaseAdmin";

export async function checkAndRecordRateLimit(bucket, limit, windowMinutes = 60) {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count } = await supabase
    .from("rate_limit_hits")
    .select("*", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("created_at", since);
  if ((count || 0) >= limit) return false;
  await supabase.from("rate_limit_hits").insert({ bucket });
  return true;
}

export function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
