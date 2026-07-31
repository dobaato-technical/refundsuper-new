"use client";
import { useCallback } from "react";

/**
 * Returns an async function that produces an X-Recaptcha-Token header value.
 * In the Next.js migration we dropped `react-google-recaptcha-v3` from the
 * bundle. When a site key is configured, the reCAPTCHA v3 script is loaded
 * from the CDN on demand and `grecaptcha.execute` is called; otherwise this
 * hook safely no-ops and returns `null` so the backend also skips verification.
 */
const SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "";
let scriptPromise = null;

function loadRecaptchaScript() {
  if (typeof window === "undefined" || !SITE_KEY) return Promise.resolve(null);
  if (window.grecaptcha) return Promise.resolve(window.grecaptcha);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.grecaptcha);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function useRecaptcha(action = "leads") {
  return useCallback(async () => {
    if (!SITE_KEY) return null;
    try {
      const grecaptcha = await loadRecaptchaScript();
      if (!grecaptcha) return null;
      await new Promise((r) => grecaptcha.ready(r));
      return await grecaptcha.execute(SITE_KEY, { action });
    } catch (e) {
      return null;
    }
  }, [action]);
}
