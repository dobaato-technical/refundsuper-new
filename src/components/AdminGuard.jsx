"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Optional loading-flash guard for /admin/* pages. `middleware.js` is now the
 * real security boundary (it re-validates the session against Supabase Auth
 * server-side before the request ever reaches these pages) — this component
 * only avoids a flash of protected content while a client-side session check
 * resolves, and must NOT be relied on for security.
 */
export default function AdminGuard({ children }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
        await supabase.auth.getUser();
      } catch (e) {
        // Supabase not configured, or the check failed — middleware is the
        // real gate, so just stop blocking the render either way.
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) return null;
  return children;
}
