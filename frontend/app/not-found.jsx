import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="bg-[#F7F5F0] min-h-screen text-[#0B2B40] flex flex-col">
      <Header />
      <div className="flex-1 px-6 md:px-12 lg:px-24 py-24 text-center">
        <div className="text-xs uppercase tracking-[0.18em] text-[#E05D43] mb-3 font-medium">
          404
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-3">
          We can&apos;t find that page
        </h1>
        <p className="text-[#4A5D68] mb-6">
          The link you followed is broken, or the page has moved.
        </p>
        <Button asChild className="bg-[#E05D43] hover:bg-[#C8533B] text-white h-11" data-testid="notfound-home">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to AussieBack
          </Link>
        </Button>
      </div>
      <Footer />
    </div>
  );
}
