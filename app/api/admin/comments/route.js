import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const approvedParam = searchParams.get("approved");
  const supabase = getSupabaseAdmin();
  let query = supabase.from("comments").select("*").order("created_at", { ascending: false }).limit(500);
  if (approvedParam !== null) query = query.eq("approved", approvedParam === "true");
  const { data, error } = await query;
  if (error) return NextResponse.json({ detail: "Failed to list comments" }, { status: 500 });
  return NextResponse.json({ comments: data || [], count: (data || []).length });
}
