import { NextResponse } from "next/server";
import { getSupabaseServer } from "./supabaseServer";

/**
 * Equivalent of FastAPI's `Depends(get_current_admin)`. Every admin
 * route handler (under app/api/admin/) calls this first. This is
 * defense-in-depth alongside `middleware.js` (the primary security boundary),
 * mirroring the plan's two-layer protection.
 *
 * Usage:
 *   const { response } = await requireAdmin();
 *   if (response) return response;
 */
export async function requireAdmin() {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return {
        user: null,
        response: NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 }),
      };
    }
    return { user, response: null };
  } catch (e) {
    // Supabase not configured, or the auth check itself failed — fail closed.
    return {
      user: null,
      response: NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 }),
    };
  }
}
