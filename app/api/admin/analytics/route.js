import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

const CHANNELS = ["download", "native", "copy", "story_download"];

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const supabase = getSupabaseAdmin();

  const channelCounts = {};
  for (const ch of CHANNELS) {
    const { count } = await supabase.from("share_events").select("*", { count: "exact", head: true }).eq("channel", ch);
    channelCounts[ch] = count || 0;
  }
  const totalShares = Object.values(channelCounts).reduce((a, b) => a + b, 0);

  const { data: referredRows } = await supabase
    .from("leads")
    .select("referred_by_lead_id, estimated_refund")
    .not("referred_by_lead_id", "is", null);
  const grouped = {};
  for (const row of referredRows || []) {
    const key = row.referred_by_lead_id;
    if (!grouped[key]) grouped[key] = { referred_count: 0, total_estimated: 0 };
    grouped[key].referred_count += 1;
    grouped[key].total_estimated += Number(row.estimated_refund || 0);
  }
  const topEntries = Object.entries(grouped)
    .sort((a, b) => b[1].referred_count - a[1].referred_count)
    .slice(0, 10);
  const top = [];
  for (const [leadId, agg] of topEntries) {
    const { data: ref } = await supabase
      .from("leads")
      .select("id, first_name, email, referral_code")
      .eq("id", leadId)
      .maybeSingle();
    if (!ref) continue;
    top.push({
      lead_id: ref.id,
      first_name: ref.first_name,
      email: ref.email,
      referral_code: ref.referral_code,
      referred_count: agg.referred_count,
      total_estimated: Math.round(agg.total_estimated * 100) / 100,
    });
  }

  const { count: referredLeadsTotal } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .not("referred_by_lead_id", "is", null);
  const { count: allLeadsTotal } = await supabase.from("leads").select("*", { count: "exact", head: true });

  const { data: utmRows } = await supabase
    .from("leads")
    .select("utm_source, estimated_refund")
    .not("utm_source", "is", null);
  const utmGrouped = {};
  for (const row of utmRows || []) {
    const key = row.utm_source;
    if (!utmGrouped[key]) utmGrouped[key] = { leads: 0, pipeline: 0 };
    utmGrouped[key].leads += 1;
    utmGrouped[key].pipeline += Number(row.estimated_refund || 0);
  }
  const utmSources = Object.entries(utmGrouped)
    .sort((a, b) => b[1].leads - a[1].leads)
    .slice(0, 10)
    .map(([source, agg]) => ({
      source: source || "unknown",
      leads: agg.leads,
      pipeline: Math.round(agg.pipeline * 100) / 100,
    }));

  return NextResponse.json({
    share_events: { by_channel: channelCounts, total: totalShares },
    referrals: {
      referred_leads_total: referredLeadsTotal || 0,
      all_leads_total: allLeadsTotal || 0,
      top_referrers: top,
    },
    utm_sources: utmSources,
  });
}
