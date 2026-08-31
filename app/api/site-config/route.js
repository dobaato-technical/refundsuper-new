import { NextResponse } from "next/server";
import { effectiveSiteSettings } from "@/lib/server/blog";

export const dynamic = "force-dynamic";

// Polled client-side by SiteVerification.jsx on every page load, so this
// stays resilient (falls back to env defaults) rather than 500ing the whole
// page when the database isn't reachable yet.
export async function GET() {
  try {
    const settings = await effectiveSiteSettings();
    return NextResponse.json(settings);
  } catch (e) {
    const SITE_URL = (process.env.SITE_URL || "https://refundsuper.com.au").replace(/\/$/, "");
    return NextResponse.json({ site_url: SITE_URL, google_site_verification: null });
  }
}
