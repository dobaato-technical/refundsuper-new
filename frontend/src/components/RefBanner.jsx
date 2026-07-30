import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { getReferralCode } from "@/lib/referral";

/**
 * Warm banner shown when the current visitor arrived via ?ref=CODE (or has one
 * previously captured to localStorage) — greets them by the referrer's first name.
 */
export default function RefBanner() {
  const { t } = useTranslation();
  const [referrer, setReferrer] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const code = getReferralCode();
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/referrals/${encodeURIComponent(code)}`);
        if (!cancelled && data?.first_name) setReferrer(data);
      } catch (e) {
        /* unknown code — silently skip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!referrer || dismissed) return null;

  return (
    <div
      data-testid="ref-banner"
      className="relative bg-[#FFF6F2] border-b border-[#F3C8BB] text-[#0B2B40]"
    >
      <div className="px-6 md:px-12 lg:px-24 py-3 flex items-center gap-3">
        <Sparkles className="h-4 w-4 text-[#E05D43] shrink-0" />
        <p className="text-sm md:text-[15px] leading-snug">
          <strong data-testid="ref-banner-name">{referrer.first_name}</strong>{" "}
          {t("banner.body")}
        </p>
        <button
          data-testid="ref-banner-dismiss"
          onClick={() => setDismissed(true)}
          className="ml-auto text-[#4A5D68] hover:text-[#0B2B40]"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
