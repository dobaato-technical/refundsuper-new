import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Share2, Link as LinkIcon, Check, LayoutGrid, Smartphone } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatAUD } from "@/lib/format";
import { buildShareUrl } from "@/lib/referral";

const FEED = { w: 1080, h: 1350 };
const STORY = { w: 1080, h: 1920 };

/**
 * Canvas-rendered refund share card with Feed (4:5) and Story (9:16) presets.
 * Also tracks share events (download/native/copy/story_download) via POST /api/share-events.
 */
export default function ShareCardModal({
  open, onOpenChange, amount, visaType, firstName, referralCode, leadId,
}) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [aspect, setAspect] = useState("feed"); // "feed" | "story"

  const visaLabel =
    visaType === "working_holiday" ? t("share.card_visa_wh") : t("share.card_visa_other");
  const shareUrl = buildShareUrl(referralCode);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      drawCard(ctx, cvs, {
        aspect,
        amount,
        visaLabel,
        firstName,
        referralCode,
        t,
      });
      setDataUrl(cvs.toDataURL("image/png"));
    });
    return () => cancelAnimationFrame(raf);
  }, [open, aspect, amount, visaLabel, firstName, referralCode, t]);

  const trackShare = async (channel) => {
    try {
      await api.post("/share-events", {
        channel,
        referral_code: referralCode || null,
        lead_id: leadId || null,
        aspect,
      });
    } catch (e) {
      /* non-blocking analytics — ignore */
    }
  };

  const filename = () => {
    const amt = Math.round(amount || 0);
    return aspect === "story"
      ? `aussieback-story-${amt}.png`
      : `aussieback-refund-${amt}.png`;
  };

  const downloadPng = () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    cvs.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename();
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
    trackShare(aspect === "story" ? "story_download" : "download");
  };

  const nativeShare = async () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    try {
      const blob = await new Promise((res) => cvs.toBlob(res, "image/png"));
      if (!blob) return;
      const file = new File([blob], filename(), { type: "image/png" });
      const shareData = {
        title: "AussieBack",
        text: `I'm claiming ${formatAUD(amount || 0)} back from Australia via AussieBack.`,
        url: shareUrl,
        files: [file],
      };
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        trackShare("native");
      } else if (navigator.share) {
        await navigator.share({ title: shareData.title, text: shareData.text, url: shareData.url });
        trackShare("native");
      } else {
        downloadPng();
        toast.message("Downloaded — share it anywhere!");
      }
    } catch (e) {
      /* user cancelled or unsupported */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t("share.copied"));
      trackShare("copy");
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

        {/* Aspect ratio toggle */}
        <div className="inline-flex rounded-lg bg-[#FAFAF9] border border-[#E8E6E1] p-1 w-full">
          <button
            type="button"
            data-testid="aspect-feed"
            onClick={() => setAspect("feed")}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
              aspect === "feed"
                ? "bg-white text-[#0B2B40] shadow-sm border border-[#E8E6E1] font-medium"
                : "text-[#4A5D68] hover:text-[#0B2B40]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> {t("share.format_feed")}
          </button>
          <button
            type="button"
            data-testid="aspect-story"
            onClick={() => setAspect("story")}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
              aspect === "story"
                ? "bg-white text-[#0B2B40] shadow-sm border border-[#E8E6E1] font-medium"
                : "text-[#4A5D68] hover:text-[#0B2B40]"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" /> {t("share.format_story")}
          </button>
        </div>

        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-[#E8E6E1] bg-[#FAFAF9] flex items-center justify-center max-h-[420px]">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Refund share card"
              className="w-full h-auto object-contain"
              style={{ maxHeight: 420 }}
              data-testid="share-card-preview"
            />
          ) : (
            <div className="p-10 text-sm text-[#4A5D68]">Rendering...</div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {referralCode && (
          <div
            data-testid="referral-block"
            className="rounded-lg border border-[#E8E6E1] bg-[#FFF6F2] px-3 py-2.5 flex items-center justify-between gap-2"
          >
            <div className="text-xs">
              <div className="uppercase tracking-[0.15em] text-[#9B3A26] font-medium mb-0.5">
                {t("share.referral_label")}
              </div>
              <div className="font-mono text-[#0B2B40] text-base font-semibold" data-testid="referral-code">
                {referralCode}
              </div>
            </div>
            <div className="text-[10px] text-[#4A5D68] max-w-[190px] leading-snug text-right">
              {t("share.referral_hint")}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-1">
          <Button
            data-testid="share-download"
            onClick={downloadPng}
            variant="outline"
            className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
          >
            <Download className="h-4 w-4 mr-2" />
            {aspect === "story" ? t("share.download_story") : t("share.download")}
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

// -----------------------------------------------------------------------------
// Canvas drawing
// -----------------------------------------------------------------------------
function drawCard(ctx, cvs, { aspect, amount, visaLabel, firstName, referralCode, t }) {
  const { w: W, h: H } = aspect === "story" ? STORY : FEED;
  cvs.width = W;
  cvs.height = H;

  // Background
  ctx.fillStyle = "#F7F5F0";
  ctx.fillRect(0, 0, W, H);

  // Coral top swash — height scales with format
  const swashH = aspect === "story" ? 520 : 380;
  const swashDip = aspect === "story" ? 120 : 120;
  ctx.fillStyle = "#E05D43";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, swashH);
  ctx.quadraticCurveTo(W / 2, swashH + swashDip, 0, swashH);
  ctx.closePath();
  ctx.fill();

  // Grain
  ctx.fillStyle = "rgba(11,43,64,0.05)";
  const grainStart = swashH + swashDip + 40;
  for (let x = 30; x < W; x += 46) {
    for (let y = grainStart; y < H; y += 46) {
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
  ctx.fillText(spaced("DASP REFUND · CLAIMED"), W / 2, aspect === "story" ? 350 : 300);

  // Compose content block Y-positions (relative)
  const contentTop = aspect === "story" ? 780 : 560;

  ctx.fillStyle = "#0B2B40";
  ctx.font = "600 82px 'Clash Display', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(t("share.card_headline"), W / 2, contentTop);

  ctx.fillStyle = "#E05D43";
  ctx.font = "700 200px 'Clash Display', system-ui, sans-serif";
  ctx.fillText(formatAUD(amount || 0), W / 2, contentTop + 100);

  ctx.fillStyle = "#0B2B40";
  ctx.font = "500 60px 'Clash Display', system-ui, sans-serif";
  ctx.fillText(t("share.card_from"), W / 2, contentTop + 340);

  // Visa chip
  ctx.font = "600 30px 'Outfit', system-ui, sans-serif";
  const chipTextWidth = ctx.measureText(visaLabel).width;
  const chipW = chipTextWidth + 70;
  const chipH = 68;
  const chipX = (W - chipW) / 2;
  const chipY = contentTop + 450;
  ctx.fillStyle = "#0B2B40";
  roundRect(ctx, chipX, chipY, chipW, chipH, 34);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText(visaLabel, W / 2, chipY + chipH / 2 + 2);

  // Divider
  ctx.strokeStyle = "rgba(11,43,64,0.15)";
  ctx.lineWidth = 2;
  const divY = aspect === "story" ? H - 500 : H - 180;
  ctx.beginPath();
  ctx.moveTo(180, divY);
  ctx.lineTo(W - 180, divY);
  ctx.stroke();

  // Footer / URL block
  ctx.fillStyle = "#4A5D68";
  ctx.font = "500 30px 'Outfit', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Estimate yours in 3 minutes →", W / 2, divY + 30);

  ctx.fillStyle = "#0B2B40";
  ctx.font = "600 34px 'Outfit', system-ui, sans-serif";
  ctx.fillText(t("share.card_via"), W / 2, divY + 80);

  // Referral code pill
  if (referralCode) {
    ctx.font = "600 26px 'Outfit', system-ui, sans-serif";
    const refText = `REF · ${referralCode}`;
    const refTextW = ctx.measureText(refText).width;
    const refChipW = refTextW + 44;
    const refChipH = 52;
    const refChipX = (W - refChipW) / 2;
    const refChipY = divY + 140;
    ctx.fillStyle = "#FFF6F2";
    ctx.strokeStyle = "#E05D43";
    ctx.lineWidth = 2;
    roundRect(ctx, refChipX, refChipY, refChipW, refChipH, 26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9B3A26";
    ctx.textBaseline = "middle";
    ctx.fillText(refText, W / 2, refChipY + refChipH / 2 + 2);
  }

  // Signature
  if (firstName) {
    ctx.fillStyle = "rgba(11,43,64,0.35)";
    ctx.font = "italic 500 26px 'Outfit', system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(`— ${firstName}`, W - 60, H - 50);
  }
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

function spaced(str) {
  return str.split("").join(" ");
}
