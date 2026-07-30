import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Share2, Link as LinkIcon, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatAUD } from "@/lib/format";

const CARD_W = 1080;
const CARD_H = 1350;

/**
 * Renders a shareable PNG summarising the user's DASP refund estimate.
 * Uses HTML5 Canvas — no external deps.
 */
export default function ShareCardModal({ open, onOpenChange, amount, visaType, firstName }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const visaLabel =
    visaType === "working_holiday"
      ? t("share.card_visa_wh")
      : t("share.card_visa_other");

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://aussieback.com";

  useEffect(() => {
    if (!open) return;
    // Defer one animation frame so the Radix Dialog portal commits and the canvas ref binds.
    const raf = requestAnimationFrame(() => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      cvs.width = CARD_W;
      cvs.height = CARD_H;

    // Background — warm cream base
    ctx.fillStyle = "#F7F5F0";
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Coral top swash
    ctx.fillStyle = "#E05D43";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(CARD_W, 0);
    ctx.lineTo(CARD_W, 380);
    ctx.quadraticCurveTo(CARD_W / 2, 500, 0, 380);
    ctx.closePath();
    ctx.fill();

    // Grain dots (subtle)
    ctx.fillStyle = "rgba(11,43,64,0.05)";
    for (let x = 30; x < CARD_W; x += 46) {
      for (let y = 500; y < CARD_H; y += 46) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Logo mark
    ctx.fillStyle = "#F7F5F0";
    roundRect(ctx, 80, 90, 96, 96, 22);
    ctx.fill();
    ctx.fillStyle = "#E05D43";
    ctx.font = "700 62px 'Clash Display', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", 128, 138);

    // Brand name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 44px 'Clash Display', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("AussieBack", 200, 138);

    // Eyebrow
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 26px 'Outfit', system-ui, sans-serif";
    ctx.textAlign = "center";
    const eyebrow = "DASP REFUND · CLAIMED";
    ctx.fillText(spaced(eyebrow, 4), CARD_W / 2, 300);

    // Headline
    ctx.fillStyle = "#0B2B40";
    ctx.font = "600 82px 'Clash Display', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(t("share.card_headline"), CARD_W / 2, 560);

    // Big amount
    ctx.fillStyle = "#E05D43";
    ctx.font = "700 200px 'Clash Display', system-ui, sans-serif";
    ctx.fillText(formatAUD(amount || 0), CARD_W / 2, 660);

    // "back from Australia"
    ctx.fillStyle = "#0B2B40";
    ctx.font = "500 60px 'Clash Display', system-ui, sans-serif";
    ctx.fillText(t("share.card_from"), CARD_W / 2, 900);

    // Visa chip
    const chipText = visaLabel;
    ctx.font = "600 30px 'Outfit', system-ui, sans-serif";
    const chipTextWidth = ctx.measureText(chipText).width;
    const chipW = chipTextWidth + 70;
    const chipH = 68;
    const chipX = (CARD_W - chipW) / 2;
    const chipY = 1010;
    ctx.fillStyle = "#0B2B40";
    roundRect(ctx, chipX, chipY, chipW, chipH, 34);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(chipText, CARD_W / 2, chipY + chipH / 2 + 2);

    // Divider
    ctx.strokeStyle = "rgba(11,43,64,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(180, 1170);
    ctx.lineTo(CARD_W - 180, 1170);
    ctx.stroke();

    // Footer — brand url + tagline
    ctx.fillStyle = "#4A5D68";
    ctx.font = "500 30px 'Outfit', system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Estimate yours in 3 minutes →", CARD_W / 2, 1200);

    ctx.fillStyle = "#0B2B40";
    ctx.font = "600 34px 'Outfit', system-ui, sans-serif";
    ctx.fillText(t("share.card_via"), CARD_W / 2, 1250);

    // Signature bottom-right (first name)
    if (firstName) {
      ctx.fillStyle = "rgba(11,43,64,0.35)";
      ctx.font = "italic 500 26px 'Outfit', system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`— ${firstName}`, CARD_W - 60, CARD_H - 50);
    }

    // Convert to data url for preview
    setDataUrl(cvs.toDataURL("image/png"));
    });
    return () => cancelAnimationFrame(raf);
  }, [open, amount, visaType, firstName, t, visaLabel]);

  const downloadPng = async () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    cvs.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aussieback-refund-${Math.round(amount || 0)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const nativeShare = async () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    try {
      const blob = await new Promise((res) => cvs.toBlob(res, "image/png"));
      if (!blob) return;
      const file = new File([blob], "aussieback-refund.png", { type: "image/png" });
      const shareData = {
        title: "AussieBack",
        text: `I'm claiming ${formatAUD(amount || 0)} back from Australia via AussieBack.`,
        url: shareUrl,
        files: [file],
      };
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else if (navigator.share) {
        await navigator.share({ title: shareData.title, text: shareData.text, url: shareData.url });
      } else {
        downloadPng();
        toast.message("Downloaded — share it anywhere!");
      }
    } catch (e) {
      // user cancelled or unsupported — fall back silently
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t("share.copied"));
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      toast.error("Could not copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white" data-testid="share-card-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#0B2B40]">
            {t("share.title")}
          </DialogTitle>
          <DialogDescription className="text-[#4A5D68]">
            {t("share.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-[#E8E6E1] bg-[#FAFAF9] flex items-center justify-center">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Refund share card"
              className="w-full h-auto"
              data-testid="share-card-preview"
            />
          ) : (
            <div className="p-10 text-sm text-[#4A5D68]">Rendering...</div>
          )}
        </div>
        {/* Hidden high-res canvas used for actual download/share */}
        <canvas ref={canvasRef} className="hidden" />

        <div className="grid grid-cols-3 gap-2 mt-2">
          <Button
            data-testid="share-download"
            onClick={downloadPng}
            variant="outline"
            className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
          >
            <Download className="h-4 w-4 mr-2" /> {t("share.download")}
          </Button>
          <Button
            data-testid="share-native"
            onClick={nativeShare}
            className="bg-[#E05D43] hover:bg-[#C8533B] text-white"
          >
            <Share2 className="h-4 w-4 mr-2" /> {t("share.share_native")}
          </Button>
          <Button
            data-testid="share-copy"
            onClick={copyLink}
            variant="outline"
            className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
          >
            {copied ? <Check className="h-4 w-4 mr-2 text-[#2E7D32]" /> : <LinkIcon className="h-4 w-4 mr-2" />}
            {copied ? t("share.copied") : t("share.copy_link")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function spaced(str, px) {
  // simulate letter-spacing by inserting hair spaces (canvas has no letterSpacing before v2)
  return str.split("").join(" ");
}
