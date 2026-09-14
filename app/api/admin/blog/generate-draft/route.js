import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { generateArticleDraft } from "@/lib/server/anthropic";

export const dynamic = "force-dynamic";
// A full 500-900 word draft takes ~20-30s to generate, which exceeds Vercel's
// default function duration — without this the request is killed mid-flight.
export const maxDuration = 60;

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const topic = body?.topic;
  if (typeof topic !== "string" || topic.length < 3 || topic.length > 200) {
    return NextResponse.json({ detail: "topic must be 3-200 characters" }, { status: 422 });
  }
  const keywords = Array.isArray(body?.keywords) ? body.keywords : [];
  const category = body?.category || null;

  try {
    const draft = await generateArticleDraft(topic, keywords, category);
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    const status = e.status || 502;
    return NextResponse.json({ detail: e.message || "Draft generation failed" }, { status });
  }
}
