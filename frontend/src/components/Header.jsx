"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import BrandLogo from "@/components/BrandLogo";

export default function Header({ onCtaClick }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const handleCta = () => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    if (pathname === "/") {
      const el = document.getElementById("estimator");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      router.push("/#estimator");
    }
  };
  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E5E7EB]"
    >
      <div className="px-6 md:px-12 lg:px-24 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" data-testid="logo-link">
          <BrandLogo size={38} />
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="font-display text-[15px] font-bold text-[#014E87] tracking-tight">
              SUPER REFUND
            </span>
            <span className="font-display text-[11px] font-semibold text-[#0076C2] tracking-[0.28em]">
              AUSTRALIA
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-[#475569] font-medium">
          <a href="/#how" className="hover:text-[#014E87] transition-colors" data-testid="nav-how">
            {t("nav.how")}
          </a>
          <Link href="/blog" className="hover:text-[#014E87] transition-colors" data-testid="nav-blog">
            {t("nav.blog")}
          </Link>
          <a href="/#faq" className="hover:text-[#014E87] transition-colors" data-testid="nav-faq">
            {t("nav.faq")}
          </a>
          <Link href="/admin/login" className="hover:text-[#014E87] transition-colors" data-testid="nav-admin">
            {t("nav.admin")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button
            data-testid="header-cta"
            onClick={handleCta}
            className="bg-[#014E87] hover:bg-[#013A66] text-white shadow-[0_4px_14px_0_rgba(1,78,135,0.28)] rounded-lg font-semibold hover:-translate-y-0.5 transition-all"
          >
            {t("nav.cta")}
          </Button>
        </div>
      </div>
    </header>
  );
}
