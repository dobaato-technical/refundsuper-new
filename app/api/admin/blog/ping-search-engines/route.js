import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { notifySearchEnginesForSlug, effectiveSiteSettings } from "@/lib/server/blog";
import { pingSearchEnginesForSlug } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";

// Manually re-fire IndexNow + GSC for a single slug (or all posts when slug is omitted).
export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (slug) {
    const result = await notifySearchEnginesForSlug(slug);
    return NextResponse.json({ ok: true, slug, result });
  }
  const settings = await effectiveSiteSettings();
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("blog_posts").select("slug").limit(500);
  const slugs = (data || []).map((d) => d.slug);
  const result = await pingSearchEnginesForSlug(settings.site_url, slugs);
  return NextResponse.json({ ok: true, count: slugs.length, result });
}
