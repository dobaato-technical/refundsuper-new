"use client";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function BlogShareButton({ title }) {
  const shareArticle = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch (e) {
      /* user cancelled */
    }
  };

  return (
    <Button
      data-testid="blog-share"
      onClick={shareArticle}
      variant="outline"
      size="sm"
      className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
    >
      <Share2 className="h-4 w-4 mr-2" /> Share
    </Button>
  );
}
