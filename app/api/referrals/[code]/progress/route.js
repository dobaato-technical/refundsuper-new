import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";

// Kept identical to backend/deps.py::REFERRAL_TIERS.
const REFERRAL_TIERS = [
  { threshold: 1, reward: "Priority WhatsApp support" },
  { threshold: 3, reward: "Free premium claim review" },
  { threshold: 5, reward: "$50 travel voucher" },
  { threshold: 10, reward: "Full concierge claim (we do everything)" },
];

export async function GET(req, { params }) {
  const { code } = await params;
  const ip = getClientIp(req);
  const allowed = await checkAndRecordRateLimit(`referral_progress:${ip}`, 60, 60);
  if (!allowed) {
    return NextResponse.json({ detail: "Too many requests. Please try again later." }, { status: 429 });
  }
  const codeUp = (code || "").trim().toUpperCase();
  const supabase = getSupabaseAdmin();
  const { data: ref } = await supabase
    .from("leads")
    .select("id, referral_code, first_name")
    .eq("referral_code", codeUp)
    .maybeSingle();
  if (!ref) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("referred_by_lead_id", ref.id);
  const referredCount = count || 0;
  const nextTier = REFERRAL_TIERS.find((t) => t.threshold > referredCount) || null;
  const unlocked = REFERRAL_TIERS.filter((t) => t.threshold <= referredCount);
  return NextResponse.json({
    referral_code: ref.referral_code,
    referred_count: referredCount,
    tiers: REFERRAL_TIERS,
    unlocked_tiers: unlocked,
    next_tier: nextTier,
    remaining_to_next: nextTier ? nextTier.threshold - referredCount : 0,
  });
}
