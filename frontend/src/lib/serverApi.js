// Server-side helper to fetch from the FastAPI backend.
// Prefers an INTERNAL URL when configured (avoids ingress roundtrips during SSR).
const BACKEND_URL =
  process.env.INTERNAL_BACKEND_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:8001";

export const API_URL = `${BACKEND_URL}/api`;

export async function apiFetch(path, { params, ...init } = {}) {
  let url = `${API_URL}${path}`;
  if (params && Object.keys(params).length) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    );
    url += `?${qs.toString()}`;
  }
  const res = await fetch(url, {
    // Revalidate blog data every 60s so newly-published articles show up soon.
    next: { revalidate: 60 },
    ...init,
  });
  if (!res.ok) {
    const err = new Error(`Backend ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
