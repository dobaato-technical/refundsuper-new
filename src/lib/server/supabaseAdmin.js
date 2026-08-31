import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (bypasses Row Level Security). Used by nearly
 * every route handler to read/write the database. Never import this into a
 * client component — it must only be reachable from route handlers, Server
 * Components, or middleware.
 *
 * Credentials are read lazily (inside the function body, not at module import
 * time) so that `next build` / `next dev` never crash just because
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset in this environment — a
 * request that actually needs the database will legitimately fail with a
 * clear error instead.
 */
let _client = null;

export function getSupabaseAdmin() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "supabaseAdmin: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set to access the database."
    );
  }
  _client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}
