import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useCallback } from "react";

/**
 * Returns an async function that produces an X-Recaptcha-Token header value.
 * When the reCAPTCHA site key is not configured (env var absent), this hook
 * safely no-ops and returns `null` so the backend can also skip verification.
 */
export function useRecaptcha(action = "leads") {
  const { executeRecaptcha } = useGoogleReCaptcha() || {};

  const getToken = useCallback(async () => {
    if (!executeRecaptcha) return null;
    try {
      return await executeRecaptcha(action);
    } catch {
      return null;
    }
  }, [executeRecaptcha, action]);

  return getToken;
}
