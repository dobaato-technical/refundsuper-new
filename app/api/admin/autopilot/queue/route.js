import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const topic = body?.topic;
  if (typeof topic !== "string" || topic.trim().length < 3 || topic.length > 200) {
    return NextResponse.json({ detail: "topic must be 3-200 characters" }, { status: 422 });
  }
  const doc = {
    topic: topic.trim(),
    keywords: Array.isArray(body.keywords) ? body.keywords : [],
    category: body.category || null,
    hero_image: body.hero_image || null,
    status: "queued",
  };
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("autopilot_queue").insert(doc).select("*").single();
  if (error) return NextResponse.json({ detail: "Failed to queue item" }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
