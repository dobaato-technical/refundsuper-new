// Forced dynamic for the same reason as app/sitemap.js — avoid a DB read
// during `next build`.
export const dynamic = "force-dynamic";

export default async function robots() {
  let siteUrl = (process.env.SITE_URL || "https://refundsuper.com.au").replace(/\/$/, "");
  try {
    const { effectiveSiteSettings } = await import("@/lib/server/blog");
    const settings = await effectiveSiteSettings();
    siteUrl = settings.site_url;
  } catch (e) {
    console.error("robots: falling back to env SITE_URL —", e.message || e);
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
