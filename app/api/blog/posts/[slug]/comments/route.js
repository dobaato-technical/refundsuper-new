import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/server/rateLimit";
import { sendWebhook } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_req, { params }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase.from("blog_posts").select("slug").eq("slug", slug).maybeSingle();
  if (!post) return NextResponse.json({ detail: "Post not found" }, { status: 404 });
  const { data: comments, error } = await supabase
    .from("comments")
    .select("id, post_slug, author_name, body, parent_id, approved, created_at")
    .eq("post_slug", slug)
    .eq("approved", true)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ detail: "Failed to list comments" }, { status: 500 });
  return NextResponse.json({ comments: comments || [], count: (comments || []).length });
}

export async function POST(req, { params }) {
  const { slug } = await params;
  const ip = getClientIp(req);
  const allowed = await checkAndRecordRateLimit(`comments:${ip}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ detail: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase.from("blog_posts").select("slug").eq("slug", slug).maybeSingle();
  if (!post) return NextResponse.json({ detail: "Post not found" }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const { author_name, author_email, body: commentBody, parent_id } = body || {};
  if (typeof author_name !== "string" || author_name.length < 1 || author_name.length > 80) {
    return NextResponse.json({ detail: "author_name must be 1-80 characters" }, { status: 422 });
  }
  if (typeof author_email !== "string" || !EMAIL_RE.test(author_email)) {
    return NextResponse.json({ detail: "author_email must be a valid email address" }, { status: 422 });
  }
  if (typeof commentBody !== "string" || commentBody.length < 2 || commentBody.length > 4000) {
    return NextResponse.json({ detail: "body must be 2-4000 characters" }, { status: 422 });
  }
  if (parent_id) {
    const { data: parent } = await supabase
      .from("comments")
      .select("id")
      .eq("id", parent_id)
      .eq("post_slug", slug)
      .maybeSingle();
    if (!parent) return NextResponse.json({ detail: "Parent comment not found" }, { status: 400 });
  }

  const commentsAutoApprove = (process.env.COMMENTS_AUTO_APPROVE ?? "true").toLowerCase() === "true";
  const now = new Date().toISOString();
  const doc = {
    id: randomUUID(),
    post_slug: slug,
    author_name: author_name.trim(),
    author_email,
    body: commentBody.trim(),
    parent_id: parent_id || null,
    approved: commentsAutoApprove,
    created_at: now,
  };
  const { error } = await supabase.from("comments").insert(doc);
  if (error) return NextResponse.json({ detail: "Failed to create comment" }, { status: 500 });

  // Webhook: comment created (redacted for privacy — no author_email)
  const { author_email: _omit, ...redacted } = doc;
  try {
    await sendWebhook("comment.created", redacted);
  } catch (e) {
    console.error("comment webhook failed:", e);
  }

  return NextResponse.json({
    ok: true,
    comment: redacted,
    pending_moderation: !commentsAutoApprove,
  });
}
