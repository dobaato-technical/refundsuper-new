import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { slugify, notifySearchEnginesForSlug, revalidateForSlug } from "@/lib/server/blog";

export const dynamic = "force-dynamic";

function validatePost(b) {
  if (!b) return "Request body required";
  if (typeof b.slug !== "string" || b.slug.length < 3 || b.slug.length > 140) return "slug must be 3-140 characters";
  if (typeof b.title !== "string" || b.title.length < 3 || b.title.length > 200) return "title must be 3-200 characters";
  if (typeof b.meta_description !== "string" || b.meta_description.length < 10 || b.meta_description.length > 320)
    return "meta_description must be 10-320 characters";
  if (typeof b.excerpt !== "string" || b.excerpt.length < 10 || b.excerpt.length > 600)
    return "excerpt must be 10-600 characters";
  if (typeof b.category !== "string" || b.category.length < 2 || b.category.length > 60)
    return "category must be 2-60 characters";
  if (typeof b.content !== "string" || b.content.length < 50) return "content must be at least 50 characters";
  return null;
}

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validatePost(body);
  if (validationError) return NextResponse.json({ detail: validationError }, { status: 422 });

  const now = new Date().toISOString();
  const slug = slugify(body.slug);
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("blog_posts").select("slug").eq("slug", slug).maybeSingle();

  const doc = {
    slug,
    title: body.title,
    meta_description: body.meta_description,
    excerpt: body.excerpt,
    category: body.category,
    tags: body.tags || [],
    keywords: body.keywords || [],
    hero_image: body.hero_image || null,
    author: body.author || "refundmysuper Team",
    reading_time_minutes: body.reading_time_minutes ?? 4,
    content: body.content,
    updated_at: now,
  };

  if (existing) {
    const { error } = await supabase.from("blog_posts").update(doc).eq("slug", slug);
    if (error) return NextResponse.json({ detail: "Failed to update post" }, { status: 500 });
  } else {
    doc.published_at = now;
    const { error } = await supabase.from("blog_posts").insert(doc);
    if (error) return NextResponse.json({ detail: "Failed to create post" }, { status: 500 });
  }

  // Fresh publish -> poke IndexNow + GSC + purge ISR cache. No BackgroundTasks
  // equivalent here, so these are awaited inline (each already soft-fails fast
  // when unconfigured).
  try {
    await notifySearchEnginesForSlug(slug);
  } catch (e) {
    console.error(`[SEO PING] failed for slug=${slug}:`, e);
  }
  try {
    await revalidateForSlug(slug);
  } catch (e) {
    console.error(`[REVALIDATE] failed for slug=${slug}:`, e);
  }

  return NextResponse.json({ ok: true, slug, created: !existing });
}
