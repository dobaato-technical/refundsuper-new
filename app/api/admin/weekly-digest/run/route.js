import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { sendWeeklyDigest } from "@/lib/server/digest";

export const dynamic = "force-dynamic";

// TODO(cron): manual-trigger-only for now (admin UI button). Automatic scheduling
// (webhook-retry/min, weekly digest Mon 9am, autopilot Mon 10am) was explicitly
// deferred — revisit with Vercel Cron later.
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;
  const digest = await sendWeeklyDigest();
  return NextResponse.json({ ok: true, digest });
}
