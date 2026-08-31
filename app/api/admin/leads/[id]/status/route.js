import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { sendWebhook } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";

const LEAD_STATUSES = ["new_estimate", "contacted", "documents_received", "submitted_to_ato", "refund_paid"];

export async function PATCH(req, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  if (!LEAD_STATUSES.includes(body?.status)) {
    return NextResponse.json({ detail: "status must be a valid lead status" }, { status: 422 });
  }

  const supabase = getSupabaseAdmin();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) return NextResponse.json({ detail: "Lead not found" }, { status: 404 });

  const oldStatus = lead.status;
  const newStatus = body.status;
  if (oldStatus === newStatus) return NextResponse.json({ ok: true, unchanged: true });

  const now = new Date().toISOString();
  const { error } = await supabase.from("leads").update({ status: newStatus, updated_at: now }).eq("id", id);
  if (error) return NextResponse.json({ detail: "Failed to update status" }, { status: 500 });

  const updated = { ...lead, status: newStatus, updated_at: now };
  try {
    await sendWebhook("lead.status_changed", updated, { previous: { status: oldStatus } });
  } catch (e) {
    console.error("status webhook failed:", e);
  }
  return NextResponse.json({ ok: true });
}
