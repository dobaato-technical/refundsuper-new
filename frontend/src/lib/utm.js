const KEY = "ab_utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"];

/**
 * Read UTM params from the current URL and, if present, persist to localStorage
 * so attribution survives across sessions until the lead is submitted.
 */
export function captureUtmFromUrl() {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh = {};
    UTM_KEYS.forEach((k) => {
      const v = (params.get(k) || "").trim().slice(0, 120);
      if (v) fresh[k] = v;
    });
    if (Object.keys(fresh).length) {
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
  } catch (e) {
    /* ignore malformed URL */
  }
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

export function getUtm() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}
