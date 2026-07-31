import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import SiteVerification from "@/components/SiteVerification";
import PostHog from "@/components/PostHog";

const SITE_URL = process.env.REACT_APP_SITE_URL || "https://aussieback.com";
const OG_IMAGE =
  "https://images.pexels.com/photos/542811/pexels-photo-542811.jpeg?auto=compress&cs=tinysrgb&h=630&w=1200";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AussieBack — Claim Your Australian Super Refund (DASP) in 3 Minutes",
    template: "%s · AussieBack",
  },
  description:
    "Claim your Australian Super refund (DASP) in under 3 minutes. Free estimate for backpackers, working holiday makers and international students who've left Australia. Get up to 65% of your super back.",
  keywords: [
    "australian super refund",
    "super back australia",
    "DASP",
    "departing australia superannuation payment",
    "working holiday super refund",
    "student visa super",
    "backpacker tax refund",
  ],
  authors: [{ name: "AussieBack" }],
  robots: { index: true, follow: true, "max-image-preview": "large" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "AussieBack",
    title: "AussieBack — Claim Your Australian Super Refund",
    description:
      "Left Australia? Don't leave your cash behind. Estimate and claim your Australian Super refund in under 3 minutes.",
    url: SITE_URL,
    images: [OG_IMAGE],
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title: "AussieBack — Claim Your Australian Super Refund",
    description: "Estimate and claim your Australian Super refund (DASP) in under 3 minutes.",
    images: [OG_IMAGE],
  },
  other: {
    "theme-color": "#E05D43",
  },
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AussieBack",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    "AussieBack helps returning temporary residents claim their Australian Super refund (DASP) — for backpackers, working holiday makers and international students.",
  sameAs: [],
};

const SITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AussieBack",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/blog?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }}
        />
      </head>
      <body>
        <SiteVerification />
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors />
        <PostHog />
      </body>
    </html>
  );
}
