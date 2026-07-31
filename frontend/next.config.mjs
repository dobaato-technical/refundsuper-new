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
};

export default nextConfig;
