import { Link } from "react-router-dom";
import { ShieldCheck, Mail, Globe } from "lucide-react";

export default function Footer() {
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
            Helping returning temporary residents recover their Australian
            Super refund — fast, simple, secure.
          </p>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3">Product</h4>
          <ul className="space-y-2 text-sm text-[#A9BDCB]">
            <li><a href="#how" className="hover:text-white" data-testid="footer-how">How it works</a></li>
            <li><a href="#faq" className="hover:text-white" data-testid="footer-faq">FAQ</a></li>
            <li><Link to="/admin/login" className="hover:text-white" data-testid="footer-admin">Admin login</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3">Contact</h4>
          <ul className="space-y-2 text-sm text-[#A9BDCB]">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> hello@aussieback.com</li>
            <li className="flex items-center gap-2"><Globe className="h-4 w-4" /> Sydney, Australia</li>
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#E05D43]" /> 256-bit SSL secured</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-white text-base mb-3">Compliance</h4>
          <p className="text-xs text-[#A9BDCB] leading-relaxed">
            AussieBack operates as a facilitation platform. Formal DASP claims
            are managed in partnership with TPB-registered tax agents. Estimates
            shown are indicative and not financial advice. Always consult your
            super fund and the ATO.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 md:px-12 lg:px-24 py-6 text-xs text-[#7A8E9C] flex flex-col md:flex-row gap-2 justify-between">
        <div>© {new Date().getFullYear()} AussieBack. All rights reserved.</div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-white">Privacy</a>
          <a href="#" className="hover:text-white">Terms</a>
        </div>
      </div>
    </footer>
  );
}
