import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { MAX_ATTEMPTS } from "@/lib/server/outbox";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  const supabase = getSupabaseAdmin();
  let query = supabase.from("webhook_outbox").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) query = query.eq("status", status);
  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ detail: "Failed to list outbox" }, { status: 500 });

  const counts = {};
  for (const s of ["pending", "success", "dead"]) {
    const { count } = await supabase.from("webhook_outbox").select("*", { count: "exact", head: true }).eq("status", s);
    counts[s] = count || 0;
  }
  return NextResponse.json({ outbox: rows || [], counts, max_attempts: MAX_ATTEMPTS });
}
