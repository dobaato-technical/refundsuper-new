import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

const LEAD_STATUSES = ["new_estimate", "contacted", "documents_received", "submitted_to_ato", "refund_paid"];

export async function GET(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  const supabase = getSupabaseAdmin();
  let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status && LEAD_STATUSES.includes(status)) query = query.eq("status", status);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `first_name.ilike.${like},email.ilike.${like},whatsapp_number.ilike.${like},super_fund_name.ilike.${like}`
    );
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ detail: "Failed to list leads" }, { status: 500 });
  return NextResponse.json({ leads: data || [], count: (data || []).length });
}
