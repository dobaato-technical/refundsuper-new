/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Expose CRA-style env vars to the browser so we don't need to churn every
  // `process.env.REACT_APP_*` reference across the codebase.
  env: {
    REACT_APP_RECAPTCHA_SITE_KEY: process.env.REACT_APP_RECAPTCHA_SITE_KEY,
    REACT_APP_SUPPORT_WHATSAPP: process.env.REACT_APP_SUPPORT_WHATSAPP,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "aussieback.com" },
    ],
  },
  eslint: {
    // Preview deploys shouldn't fail on lint — we run eslint separately.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // Root-level SEO crawler files (Google Search Console + IndexNow
    // verification) are now served by our own Next.js Route Handlers under
    // /api/seo/* instead of the old FastAPI backend. sitemap.xml/robots.txt
    // no longer need a rewrite — they use Next's native app/sitemap.js and
    // app/robots.js conventions.
    return [
      { source: "/google:token(.*).html", destination: "/api/seo/google-verification/:token" },
      { source: "/:key([0-9a-f]{16,128}).txt", destination: "/api/seo/indexnow/:key" },
    ];
  },
};

export default nextConfig;
