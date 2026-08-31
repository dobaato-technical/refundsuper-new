import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { forceRetry } from "@/lib/server/outbox";

export const dynamic = "force-dynamic";

export async function POST(_req, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;
  const ok = await forceRetry(id);
  if (!ok) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, row_id: id });
}
