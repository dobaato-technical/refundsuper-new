// Direct DB query functions for the public blog Server Components
// (app/blog/page.jsx, app/blog/[slug]/page.jsx) to call in-process — no HTTP
// round-trip to our own API, unlike the old apiFetch()-to-FastAPI pattern.
// The public /api/blog/posts* route handlers also call these so both paths
// share identical logic.
import { getSupabaseAdmin } from "./supabaseAdmin";

const LIST_COLUMNS =
  "slug,title,meta_description,excerpt,category,tags,hero_image,author,reading_time_minutes,published_at";

export async function listBlogPosts({ category, tag, limit = 20 } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("blog_posts")
    .select(LIST_COLUMNS)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (category) query = query.eq("category", category);
  if (tag) query = query.contains("tags", [tag]);
  const { data: posts, error } = await query;
  if (error) throw error;

  const { data: allPosts, error: catError } = await supabase.from("blog_posts").select("category");
  if (catError) throw catError;
  const counts = {};
  for (const p of allPosts || []) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  }
  const categories = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { posts: posts || [], count: (posts || []).length, categories };
}

export async function getBlogPostBySlug(slug) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("blog_posts").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data || null;
}
