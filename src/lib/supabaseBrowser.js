import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client (anon key) — used only by the login page for
// signInWithPassword/signOut/getUser, and by AdminGuard/admin dashboard for a
// client-side session read. Credentials are read lazily so a missing
// NEXT_PUBLIC_SUPABASE_* env var doesn't crash the app at import time; a
// component that actually calls this without credentials configured gets a
// clear error instead.
let _client = null;

export function getSupabaseBrowser() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing)."
    );
  }
  _client = createBrowserClient(url, anonKey);
  return _client;
}
