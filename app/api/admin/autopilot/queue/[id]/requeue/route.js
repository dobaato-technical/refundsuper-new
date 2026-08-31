import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(_req, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: item } = await supabase.from("autopilot_queue").select("*").eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  if (item.status !== "failed") {
    return NextResponse.json({ detail: "Only failed items can be requeued" }, { status: 400 });
  }
  const { error } = await supabase
    .from("autopilot_queue")
    .update({ status: "queued", error: null, finished_at: null, started_at: null })
    .eq("id", id);
  if (error) return NextResponse.json({ detail: "Failed to requeue item" }, { status: 500 });
  return NextResponse.json({ ok: true, item_id: id });
}
