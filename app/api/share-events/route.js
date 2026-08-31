import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/server/rateLimit";
import { sendWebhook } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";

const CHANNELS = ["download", "native", "copy", "story_download"];
const ASPECTS = ["feed", "story"];

export async function POST(req) {
  const ip = getClientIp(req);
  const allowed = await checkAndRecordRateLimit(`share_events:${ip}`, 60, 60);
  if (!allowed) {
    return NextResponse.json({ detail: "Too many requests. Please try again later." }, { status: 429 });
  }
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const { channel, referral_code, lead_id, aspect } = body || {};
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json(
      { detail: "channel must be one of download, native, copy, story_download" },
      { status: 422 }
    );
  }
  if (referral_code != null && String(referral_code).length > 32) {
    return NextResponse.json({ detail: "referral_code must be at most 32 characters" }, { status: 422 });
  }
  if (lead_id != null && String(lead_id).length > 64) {
    return NextResponse.json({ detail: "lead_id must be at most 64 characters" }, { status: 422 });
  }
  if (aspect != null && !ASPECTS.includes(aspect)) {
    return NextResponse.json({ detail: "aspect must be one of feed, story" }, { status: 422 });
  }
  const doc = {
    id: randomUUID(),
    channel,
    referral_code: (referral_code || "").trim().toUpperCase() || null,
    lead_id: lead_id || null,
    aspect: aspect || null,
    user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
    created_at: new Date().toISOString(),
  };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("share_events").insert(doc);
  if (error) {
    console.error("share_events insert failed:", error);
    return NextResponse.json({ detail: "Failed to record event" }, { status: 500 });
  }
  try {
    await sendWebhook("share_event.created", doc);
  } catch (e) {
    console.error("share_event webhook failed:", e);
  }
  return NextResponse.json({ ok: true, id: doc.id });
}
