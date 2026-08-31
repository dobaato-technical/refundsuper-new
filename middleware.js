import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Real server-side route protection for /admin (previously client-side only
 * via AdminGuard). Verifies the session against Supabase Auth (getUser()
 * re-validates with the auth server, not just decoding a cookie).
 *
 * When Supabase env vars are unset (no credentials yet in this environment),
 * `user` stays null and both branches below fail closed — 401 on admin API,
 * redirect-to-login on admin pages — instead of throwing.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request: { headers: request.headers } });
  let user = null;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (e) {
      user = null;
    }
  }

  if (isAdminApi) {
    if (!user) {
      return NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 });
    }
    return response;
  }

  if (isAdminPage) {
    if (!user && !isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    if (user && isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
