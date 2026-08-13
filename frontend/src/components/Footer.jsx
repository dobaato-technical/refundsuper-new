"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Mail, Globe } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer
      data-testid="site-footer"
      className="bg-[#014E87] text-[#CBD5E1] mt-20"
    >
      <div className="px-6 md:px-12 lg:px-24 py-16 grid md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <BrandLogo size={40} />
            <div className="flex flex-col leading-tight">
              <span className="font-display text-[15px] font-bold text-white tracking-tight">
                SUPER REFUND
              </span>
              <span className="font-display text-[11px] font-semibold text-[#D5A31B] tracking-[0.28em]">
                AUSTRALIA
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-[#94A3B8]">
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3 font-semibold">{t("footer.product")}</h4>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            <li><a href="/#how" className="hover:text-white" data-testid="footer-how">{t("nav.how")}</a></li>
            <li><Link href="/blog" className="hover:text-white" data-testid="footer-blog">{t("nav.blog")}</Link></li>
            <li><a href="/#faq" className="hover:text-white" data-testid="footer-faq">{t("nav.faq")}</a></li>
            <li><Link href="/admin/login" className="hover:text-white" data-testid="footer-admin">{t("nav.admin")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3 font-semibold">{t("footer.contact")}</h4>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> hello@refundsuper.com.au</li>
            <li className="flex items-center gap-2"><Globe className="h-4 w-4" /> Sydney, Australia</li>
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#D5A31B]" /> 256-bit SSL secured</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3 font-semibold">{t("footer.compliance")}</h4>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {t("footer.compliance_body")}
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 md:px-12 lg:px-24 py-6 text-xs text-[#94A3B8] flex flex-col md:flex-row gap-2 justify-between">
        <div>© {new Date().getFullYear()} Super Refund Australia. {t("footer.rights")}</div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-white">{t("footer.privacy")}</a>
          <a href="#" className="hover:text-white">{t("footer.terms")}</a>
        </div>
      </div>
    </footer>
  );
}
