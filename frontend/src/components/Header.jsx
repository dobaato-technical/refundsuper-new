import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Header({ onCtaClick }) {
  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 bg-[#F7F5F0]/85 backdrop-blur-md border-b border-[#E8E6E1]"
    >
      <div className="px-6 md:px-12 lg:px-24 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
          <div className="h-9 w-9 rounded-lg bg-[#E05D43] flex items-center justify-center text-white font-display font-semibold">
            A
          </div>
          <span className="font-display text-xl font-semibold text-[#0B2B40]">
            AussieBack
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-[#4A5D68]">
          <a href="#how" className="hover:text-[#0B2B40] transition-colors" data-testid="nav-how">
            How it works
          </a>
          <a href="#testimonials" className="hover:text-[#0B2B40] transition-colors" data-testid="nav-testimonials">
            Stories
          </a>
          <a href="#faq" className="hover:text-[#0B2B40] transition-colors" data-testid="nav-faq">
            FAQ
          </a>
          <Link to="/admin/login" className="hover:text-[#0B2B40] transition-colors" data-testid="nav-admin">
            Admin
          </Link>
        </nav>

        <Button
          data-testid="header-cta"
          onClick={onCtaClick}
          className="bg-[#E05D43] hover:bg-[#C8533B] text-white shadow-[0_4px_14px_0_rgba(224,93,67,0.39)] rounded-lg font-medium hover:-translate-y-0.5 transition-all"
        >
          Calculate my refund
        </Button>
      </div>
    </header>
  );
}
