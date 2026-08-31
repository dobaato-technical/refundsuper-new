import axios from "axios";

// Relative, same-origin — the Next.js Route Handlers under app/api/** now
// serve everything, so there's no separate backend host to point at.
export const API = "/api";

export const api = axios.create({ baseURL: API });

// Session travels via cookies automatically (Supabase Auth), so there's no
// bearer-token request interceptor anymore. Keep a 401-response interceptor
// that redirects back to the login page.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (
      err?.response?.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin") &&
      window.location.pathname !== "/admin/login"
    ) {
      window.location.href = "/admin/login";
    }
    return Promise.reject(err);
  }
);
