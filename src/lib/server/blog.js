// Blog services: slug, autopilot runner, effective site settings, search-
// engine ping, ISR revalidation. Port of backend/services/blog.py (minus
// generate_article_draft, which lives in anthropic.js per the migration
// plan's module split).
import { getSupabaseAdmin } from "./supabaseAdmin";
import { generateArticleDraft } from "./anthropic";
import { pingSearchEnginesForSlug } from "./integrations";

const _SLUG_RE = /[^a-z0-9]+/g;

export function slugify(text) {
  const s = (text || "").toLowerCase().replace(_SLUG_RE, "-").replace(/^-+|-+$/g, "");
  return s.slice(0, 140) || `post-${Math.random().toString(16).slice(2, 10)}`;
}

export async function effectiveSiteSettings() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("settings").select("value").eq("key", "site_config").maybeSingle();
  const doc = data?.value || {};
  const SITE_URL = (process.env.SITE_URL || "https://refundsuper.com.au").replace(/\/$/, "");
  const GOOGLE_SITE_VERIFICATION = (process.env.GOOGLE_SITE_VERIFICATION || "").trim();
  return {
    site_url: (doc.site_url || SITE_URL).replace(/\/$/, ""),
    google_site_verification: doc.google_site_verification || (GOOGLE_SITE_VERIFICATION || null),
  };
}

export async function autopilotConfig() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("settings").select("value").eq("key", "autopilot").maybeSingle();
  const doc = data?.value || {};
  return { enabled: Boolean(doc.enabled) };
}

/** Fire IndexNow + GSC ping for a freshly-published blog post. */
export async function notifySearchEnginesForSlug(slug) {
  const settings = await effectiveSiteSettings();
  return pingSearchEnginesForSlug(settings.site_url, [slug]);
}

/**
 * Purge the Next.js ISR/data cache for a freshly-published post. Publish and
 * revalidation are now the same process (no more HTTP self-call to
 * /api/revalidate — that route stays in place as a harmless generic manual
 * hook, but nothing internal calls it anymore).
 */
export async function revalidateForSlug(slug) {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
    return { ok: true };
  } catch (e) {
    console.error("[REVALIDATE] failed:", e);
    return { error: String(e.message || e) };
  }
}

export async function runAutopilotOnce() {
  const supabase = getSupabaseAdmin();
  const cfg = await autopilotConfig();
  if (!cfg.enabled) {
    console.log("[AUTOPILOT] disabled — skipping run");
    return { skipped: true, reason: "disabled" };
  }

  const { data: queued } = await supabase
    .from("autopilot_queue")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  const item = queued && queued[0];
  if (!item) {
    console.log("[AUTOPILOT] queue empty — nothing to publish");
    return { skipped: true, reason: "empty_queue" };
  }

  await supabase
    .from("autopilot_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", item.id);

  try {
    const draft = await generateArticleDraft(item.topic, item.keywords || [], item.category);
    if (item.hero_image) draft.hero_image = item.hero_image;
    const now = new Date().toISOString();
    const postDoc = { ...draft, published_at: now, updated_at: now };
    await supabase.from("blog_posts").upsert(postDoc, { onConflict: "slug" });
    await supabase
      .from("autopilot_queue")
      .update({ status: "published", published_slug: draft.slug, finished_at: now })
      .eq("id", item.id);

    // Fresh article -> poke search engines + Next.js ISR cache
    try {
      await notifySearchEnginesForSlug(draft.slug);
    } catch (e) {
      console.error("[AUTOPILOT] search-engine ping failed:", e);
    }
    try {
      await revalidateForSlug(draft.slug);
    } catch (e) {
      console.error("[AUTOPILOT] Next.js revalidate failed:", e);
    }

    console.log(`[AUTOPILOT] published /blog/${draft.slug} from topic ${item.topic}`);
    return { ok: true, slug: draft.slug, topic: item.topic };
  } catch (e) {
    console.error(`[AUTOPILOT] failed to publish ${item.topic}:`, e);
    await supabase
      .from("autopilot_queue")
      .update({
        status: "failed",
        error: String(e.message || e).slice(0, 400),
        finished_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    return { ok: false, error: String(e.message || e) };
  }
}
