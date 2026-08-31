const KEY = "ab_ref";

/**
 * Read `?ref=XXX` from the current URL and, if present, persist it in localStorage
 * so a returning visitor's attribution survives across sessions and reloads.
 */
export function captureReferralFromUrl() {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get("ref") || "").trim().toUpperCase();
    if (ref) {
      localStorage.setItem(KEY, ref);
      return ref;
    }
  } catch (e) {
    /* ignore malformed URL */
  }
  return localStorage.getItem(KEY);
}

export function getReferralCode() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function clearReferralCode() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

/**
 * Build a full share URL that carries the given referral code so a friend who
 * clicks it can be attributed on submission.
 */
export function buildShareUrl(referralCode) {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  if (!referralCode) return origin;
  return `${origin}/?ref=${encodeURIComponent(referralCode)}`;
}
