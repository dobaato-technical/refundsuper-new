import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Reached via the next.config.mjs rewrite for /<indexnow_key>.txt — Bing
// requires this exact key-verification file to exist at the site root.
// Only matches when the requested filename literally equals the configured
// INDEXNOW_KEY, so other *.txt paths still 404 correctly.
export async function GET(_req, { params }) {
  const { key } = await params;
  const indexnowKey = process.env.INDEXNOW_KEY || "";
  if (indexnowKey && key === indexnowKey) {
    return new NextResponse(indexnowKey, { headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ detail: "Not found" }, { status: 404 });
}
