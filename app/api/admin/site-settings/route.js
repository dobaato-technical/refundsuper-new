import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { effectiveSiteSettings } from "@/lib/server/blog";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("settings").select("value").eq("key", "site_config").maybeSingle();
  const doc = data?.value || {};
  const effective = await effectiveSiteSettings();
  return NextResponse.json({
    effective,
    db_overrides: {
      site_url: doc.site_url || null,
      google_site_verification: doc.google_site_verification || null,
    },
    env_defaults: {
      site_url: (process.env.SITE_URL || "https://refundsuper.com.au").replace(/\/$/, ""),
      google_site_verification: (process.env.GOOGLE_SITE_VERIFICATION || "").trim() || null,
    },
  });
}

export async function PUT(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  if (body.site_url != null && String(body.site_url).length > 200) {
    return NextResponse.json({ detail: "site_url must be at most 200 characters" }, { status: 422 });
  }
  if (body.google_site_verification != null && String(body.google_site_verification).length > 200) {
    return NextResponse.json({ detail: "google_site_verification must be at most 200 characters" }, { status: 422 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("settings").select("value").eq("key", "site_config").maybeSingle();
  const updates = { ...(existing?.value || {}) };
  if (body.site_url !== undefined) {
    updates.site_url = (body.site_url || "").trim().replace(/\/$/, "") || null;
  }
  if (body.google_site_verification !== undefined) {
    updates.google_site_verification = (body.google_site_verification || "").trim() || null;
  }
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "site_config", value: updates, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ detail: "Failed to save settings" }, { status: 500 });
  return NextResponse.json({ ok: true, effective: await effectiveSiteSettings() });
}
