import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { runAutopilotOnce } from "@/lib/server/blog";

export const dynamic = "force-dynamic";
// Generates a full draft via the LLM (~20-30s) then publishes and pings search
// engines, so this needs well above Vercel's default function duration.
export const maxDuration = 60;

// TODO(cron): manual-trigger-only for now (admin UI button). Automatic scheduling
// (webhook-retry/min, weekly digest Mon 9am, autopilot Mon 10am) was explicitly
// deferred — revisit with Vercel Cron later.
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;
  const result = await runAutopilotOnce();
  return NextResponse.json(result);
}
