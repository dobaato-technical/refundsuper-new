import { NextResponse } from "next/server";
import { effectiveSiteSettings } from "@/lib/server/blog";

export const dynamic = "force-dynamic";

// Reached via the next.config.mjs rewrite for /google<token>.html — Google
// Search Console's HTML file-verification method.
export async function GET(_req, { params }) {
  const { token } = await params;
  let expected = "";
  try {
    const settings = await effectiveSiteSettings();
    expected = settings.google_site_verification || "";
  } catch (e) {
    expected = "";
  }
  if (expected && token === expected) {
    return new NextResponse(`google-site-verification: google${token}.html`, {
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ detail: "Not found" }, { status: 404 });
}
