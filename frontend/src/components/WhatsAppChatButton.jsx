import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, X } from "lucide-react";
import { formatAUD } from "@/lib/format";

const SUPPORT_PHONE_RAW = (process.env.REACT_APP_SUPPORT_WHATSAPP || "+61400000000")
  .replace(/[^\d]/g, ""); // wa.me expects no +/spaces

const INACTIVITY_MS = 20_000;

/**
 * Floating WhatsApp chat button + inactivity nudge bubble.
 * Props:
 *   estimateAmount?: number — if provided, the pre-filled WhatsApp message references it.
 *   watchInactivity?: boolean — if true, the nudge bubble auto-opens after 20s idle.
 */
export default function WhatsAppChatButton({ estimateAmount, watchInactivity = false }) {
  const { t } = useTranslation();
  const [showBubble, setShowBubble] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const prefill = estimateAmount
    ? t("chat.prefill_with_estimate", { amount: formatAUD(estimateAmount) })
    : t("chat.prefill_generic");

  const waHref = `https://wa.me/${SUPPORT_PHONE_RAW}?text=${encodeURIComponent(prefill)}`;

  const armIdle = useCallback(() => {
    if (!watchInactivity || dismissed) return null;
    return setTimeout(() => setShowBubble(true), INACTIVITY_MS);
  }, [watchInactivity, dismissed]);

  useEffect(() => {
    if (!watchInactivity || dismissed) return undefined;
    let timer = armIdle();
    const reset = () => {
      if (timer) clearTimeout(timer);
      setShowBubble(false);
      timer = armIdle();
    };
    const events = ["mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [watchInactivity, dismissed, armIdle]);

  const dismiss = () => {
    setShowBubble(false);
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {showBubble && (
        <div
          data-testid="whatsapp-nudge"
          className="max-w-[280px] bg-white border border-[#E8E6E1] rounded-2xl shadow-[0_18px_40px_-14px_rgba(11,43,64,0.25)] p-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="font-display font-medium text-[#0B2B40]">
              {t("chat.bubble_title")}
            </div>
            <button
              data-testid="whatsapp-nudge-dismiss"
              onClick={dismiss}
              className="text-[#4A5D68] hover:text-[#0B2B40]"
              aria-label={t("chat.dismiss")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-[#4A5D68] leading-relaxed mb-3">
            {t("chat.bubble_body")}
          </p>
          <a
            data-testid="whatsapp-nudge-cta"
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1FBA57] text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm w-full justify-center"
          >
            <MessageCircle className="h-4 w-4" />
            {t("chat.bubble_cta")}
          </a>
        </div>
      )}

      <a
        data-testid="whatsapp-float"
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("chat.float_label")}
        className="group relative bg-[#25D366] hover:bg-[#1FBA57] text-white h-14 w-14 rounded-full shadow-[0_10px_28px_-6px_rgba(37,211,102,0.6)] flex items-center justify-center transition-all hover:-translate-y-0.5"
      >
        <MessageCircle className="h-6 w-6" fill="currentColor" strokeWidth={0} />
        <span className="absolute right-full mr-3 whitespace-nowrap bg-[#0B2B40] text-white text-xs px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
          {t("chat.float_label")}
        </span>
      </a>
    </div>
  );
}
