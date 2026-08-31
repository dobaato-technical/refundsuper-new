import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import SiteVerification from "@/components/SiteVerification";
import PostHog from "@/components/PostHog";

const SITE_URL = process.env.REACT_APP_SITE_URL || "https://refundsuper.com.au";
const OG_IMAGE =
  "https://images.pexels.com/photos/542811/pexels-photo-542811.jpeg?auto=compress&cs=tinysrgb&h=630&w=1200";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "refundmysuper — Claim Your Australian Superannuation Refund (DASP)",
    template: "%s · refundmysuper",
  },
  description:
    "The trusted portal for former Australian residents from India, China and beyond to claim their superannuation refund (DASP). Free estimate, expert review, paid straight to your bank in under 4 weeks.",
  keywords: [
    "australian super refund",
    "super refund australia",
    "refundsuper",
    "DASP",
    "departing australia superannuation payment",
    "super refund india",
    "super refund china",
    "482 visa super refund",
    "student visa super refund",
  ],
  authors: [{ name: "refundmysuper" }],
  robots: { index: true, follow: true, "max-image-preview": "large" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "refundmysuper",
    title: "refundmysuper — Claim Your Australian Super Refund",
    description:
      "The trusted portal for former Australian residents from India, China and beyond to claim their superannuation refund.",
    url: SITE_URL,
    images: [OG_IMAGE],
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title: "refundmysuper — Claim Your Australian Super Refund",
    description: "Free estimate, expert review, refund paid straight to your bank in under 4 weeks.",
    images: [OG_IMAGE],
  },
  other: {
    "theme-color": "#014E87",
  },
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "refundmysuper",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/logo.png`,
  description:
    "refundmysuper is the trusted portal for former Australian residents from India, China and beyond to claim their superannuation refund (DASP).",
  sameAs: [],
};

const SITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "refundmysuper",
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
