import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { code } = await params;
  const codeUp = (code || "").trim().toUpperCase();
  if (!codeUp) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("leads")
    .select("first_name, referral_code")
    .eq("referral_code", codeUp)
    .maybeSingle();
  if (!data) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  return NextResponse.json({ referral_code: data.referral_code, first_name: data.first_name || "" });
}
