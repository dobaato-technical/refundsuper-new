import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { processOutbox } from "@/lib/server/outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Force the retry loop to run once immediately (handy for tests / manual flushes).
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;
  const result = await processOutbox();
  return NextResponse.json({ ok: true, ...result });
}
