/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Expose CRA-style env vars to the browser so we don't need to churn every
  // `process.env.REACT_APP_*` reference across the codebase.
  env: {
    REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
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
    // Root-level SEO endpoints are served by FastAPI (see backend/routes/seo.py).
    // Ingress only routes /api/* to the backend, so we proxy the rest here so
    // Googlebot / IndexNow can reach them through the public origin.
    // MUST hit the backend on the pod-internal port to avoid re-entering ingress
    // (which would loop /sitemap.xml back to Next.js forever).
    const backend =
      process.env.INTERNAL_BACKEND_URL || "http://localhost:8001";
    return [
      { source: "/sitemap.xml", destination: `${backend}/sitemap.xml` },
      { source: "/robots.txt", destination: `${backend}/robots.txt` },
      { source: "/google:token(.*).html", destination: `${backend}/google:token.html` },
      { source: "/:key([0-9a-f]{16,128}).txt", destination: `${backend}/:key.txt` },
    ];
  },
};

export default nextConfig;
