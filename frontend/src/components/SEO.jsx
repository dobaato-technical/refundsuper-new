import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api } from "@/lib/api";

/**
 * SEO helper. Wraps react-helmet-async and injects sensible defaults for AussieBack.
 * Also supports injecting arbitrary JSON-LD structured data (Article, FAQPage, etc).
 * Reads /api/site-config once per mount to inject google-site-verification when set.
 */
export default function SEO({
  title,
  description,
  canonical,
  image,
  type = "website",
  jsonLd,
  keywords,
}) {
  const [siteConfig, setSiteConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/site-config");
        if (!cancelled) setSiteConfig(data);
      } catch (e) {
        /* silent — SEO defaults still work */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const finalTitle = title
    ? `${title} · AussieBack`
    : "AussieBack — Claim Your Australian Super Refund (DASP) in 3 Minutes";
  const finalDescription =
    description ||
    "Claim your Australian Super refund in under 3 minutes. Free estimate for backpackers, working holiday makers and international students who have left Australia.";
  const finalCanonical =
    canonical ||
    (typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : "https://aussieback.com/");
  const finalImage =
    image ||
    "https://images.pexels.com/photos/542811/pexels-photo-542811.jpeg?auto=compress&cs=tinysrgb&h=630&w=1200";

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={finalCanonical} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:url" content={finalCanonical} />
      <meta property="og:image" content={finalImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={finalImage} />

      {siteConfig?.google_site_verification && (
        <meta
          name="google-site-verification"
          content={siteConfig.google_site_verification}
        />
      )}

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
