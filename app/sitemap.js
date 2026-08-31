import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { effectiveSiteSettings } from "@/lib/server/blog";

// Forced dynamic (generated per-request, not at build time) so this reflects
// freshly-published blog posts immediately and — just as importantly here —
// never touches the database during `next build`, when SUPABASE_* env vars
// may legitimately be unset.
export const dynamic = "force-dynamic";

export default async function sitemap() {
  let base = (process.env.SITE_URL || "https://refundsuper.com.au").replace(/\/$/, "");
  let posts = [];
  try {
    const settings = await effectiveSiteSettings();
    base = settings.site_url;
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("blog_posts").select("slug, updated_at").limit(500);
    posts = data || [];
  } catch (e) {
    console.error("sitemap: falling back to static entries —", e.message || e);
  }

  const entries = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.9 },
  ];
  for (const p of posts) {
    entries.push({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }
  return entries;
}
