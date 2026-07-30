import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Zap, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Inline lead-capture / conversion card embedded inside blog articles.
 * Uses the anchor #estimator on the landing page — smooth-scrolls straight to the funnel.
 */
export default function BlogCTA({ variant = "coral" }) {
  const { t } = useTranslation();

  const isCoral = variant === "coral";
  const bg = isCoral
    ? "bg-gradient-to-br from-[#E05D43] to-[#C8533B] text-white"
    : "bg-white border border-[#E8E6E1] text-[#0B2B40]";

  return (
    <aside
      data-testid="blog-cta"
      className={`rounded-2xl p-6 md:p-8 my-8 relative overflow-hidden ${bg}`}
    >
      <div className="absolute inset-0 ab-grain opacity-25 pointer-events-none" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 bg-white/15 text-xs uppercase tracking-[0.18em] rounded-full px-3 py-1 mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          {t("blog_cta.eyebrow")}
        </div>
        <h3
          className={`font-display text-2xl md:text-3xl font-medium mb-2 tracking-tight ${
            isCoral ? "text-white" : "text-[#0B2B40]"
          }`}
        >
          {t("blog_cta.title")}
        </h3>
        <p className={`text-sm md:text-base leading-relaxed mb-5 ${isCoral ? "text-white/85" : "text-[#4A5D68]"}`}>
          {t("blog_cta.body")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            data-testid="blog-cta-primary"
            className={
              isCoral
                ? "bg-white text-[#0B2B40] hover:bg-[#F7F5F0] h-12 px-6 rounded-lg hover:-translate-y-0.5 transition-all font-medium"
                : "bg-[#E05D43] hover:bg-[#C8533B] text-white h-12 px-6 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)] hover:-translate-y-0.5 transition-all"
            }
          >
            <Link to="/#estimator">
              {t("blog_cta.button")} <ChevronRight className="ml-1 h-5 w-5" />
            </Link>
          </Button>
          <div
            className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${
              isCoral ? "text-white/80" : "text-[#4A5D68]"
            }`}
          >
            <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> {t("blog_cta.badge_fast")}</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {t("blog_cta.badge_free")}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
