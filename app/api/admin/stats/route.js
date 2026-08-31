import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = ["new_estimate", "contacted", "documents_received", "submitted_to_ato", "refund_paid"];

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const supabase = getSupabaseAdmin();

  const counts = {};
  for (const s of PIPELINE_STAGES) {
    const { count } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", s);
    counts[s] = count || 0;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const { data: pipelineRows } = await supabase
    .from("leads")
    .select("estimated_refund")
    .neq("status", "refund_paid");
  const pipelineValue = (pipelineRows || []).reduce((sum, r) => sum + Number(r.estimated_refund || 0), 0);

  const { data: paidRows } = await supabase.from("leads").select("estimated_refund").eq("status", "refund_paid");
  const recovered = (paidRows || []).reduce((sum, r) => sum + Number(r.estimated_refund || 0), 0);

  const converted = counts.refund_paid || 0;
  const conversionRate = total ? (converted / total) * 100 : 0;

  return NextResponse.json({
    total_leads: total,
    status_counts: counts,
    pipeline_value: Math.round(pipelineValue * 100) / 100,
    recovered_value: Math.round(recovered * 100) / 100,
    conversion_rate: Math.round(conversionRate * 10) / 10,
  });
}
