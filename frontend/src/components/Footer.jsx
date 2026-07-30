import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Mail, Globe } from "lucide-react";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer
      data-testid="site-footer"
      className="bg-[#0B2B40] text-[#D7E2EA] mt-20"
    >
      <div className="px-6 md:px-12 lg:px-24 py-16 grid md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-[#E05D43] flex items-center justify-center text-white font-display font-semibold">
              A
            </div>
            <span className="font-display text-xl font-semibold text-white">
              AussieBack
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[#A9BDCB]">
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3">{t("footer.product")}</h4>
          <ul className="space-y-2 text-sm text-[#A9BDCB]">
            <li><a href="/#how" className="hover:text-white" data-testid="footer-how">{t("nav.how")}</a></li>
            <li><Link to="/blog" className="hover:text-white" data-testid="footer-blog">{t("nav.blog")}</Link></li>
            <li><a href="/#faq" className="hover:text-white" data-testid="footer-faq">{t("nav.faq")}</a></li>
            <li><Link to="/admin/login" className="hover:text-white" data-testid="footer-admin">{t("nav.admin")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3">{t("footer.contact")}</h4>
          <ul className="space-y-2 text-sm text-[#A9BDCB]">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> hello@aussieback.com</li>
            <li className="flex items-center gap-2"><Globe className="h-4 w-4" /> Sydney, Australia</li>
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#E05D43]" /> 256-bit SSL secured</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3">{t("footer.compliance")}</h4>
          <p className="text-xs text-[#A9BDCB] leading-relaxed">
            {t("footer.compliance_body")}
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 md:px-12 lg:px-24 py-6 text-xs text-[#7A8E9C] flex flex-col md:flex-row gap-2 justify-between">
        <div>© {new Date().getFullYear()} AussieBack. {t("footer.rights")}</div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-white">{t("footer.privacy")}</a>
          <a href="#" className="hover:text-white">{t("footer.terms")}</a>
        </div>
      </div>
    </footer>
  );
}
