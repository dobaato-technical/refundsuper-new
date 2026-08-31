import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-aware Supabase client for verifying the logged-in admin's session
 * inside route handlers / Server Components (middleware.js has its own copy
 * of this logic since it can't use `next/headers`). Uses the anon key — auth
 * verification relies on Supabase re-validating the session server-side, not
 * on this client having elevated privileges.
 *
 * Credentials are read lazily so a missing NEXT_PUBLIC_SUPABASE_* env var
 * doesn't crash the build — only an actual auth check request fails.
 */
export async function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "supabaseServer: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set."
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch (e) {
          // Called from a Server Component render — cookies are read-only
          // there. Session refresh in that case is handled by middleware.js.
        }
      },
    },
  });
}
