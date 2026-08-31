"use client";
import { useEffect } from "react";
import { api } from "@/lib/api";

/**
 * Injects <meta name="google-site-verification"> into <head> at runtime.
 * Reads /api/site-config once on mount; when the token is unset the meta tag
 * is simply not added.
 */
export default function SiteVerification() {
  useEffect(() => {
    let cancelled = false;
    let el = null;
    (async () => {
      try {
        const { data } = await api.get("/site-config");
        if (cancelled || !data?.google_site_verification) return;
        const existing = document.querySelector('meta[name="google-site-verification"]');
        if (existing) return;
        el = document.createElement("meta");
        el.setAttribute("name", "google-site-verification");
        el.setAttribute("content", data.google_site_verification);
        document.head.appendChild(el);
      } catch (e) {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, []);
  return null;
}
