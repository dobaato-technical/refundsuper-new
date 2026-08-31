import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { autopilotConfig } from "@/lib/server/blog";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const cfg = await autopilotConfig();
  const supabase = getSupabaseAdmin();
  const { data: queue } = await supabase
    .from("autopilot_queue")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(200);
  return NextResponse.json({ config: cfg, queue: queue || [], queue_length: (queue || []).length });
}

export async function PATCH(req) {
  const { response } = await requireAdmin();
  if (response) return response;
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ detail: "enabled must be a boolean" }, { status: 422 });
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "autopilot", value: { enabled: body.enabled }, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ detail: "Failed to update config" }, { status: 500 });
  return NextResponse.json({ ok: true, config: await autopilotConfig() });
}
