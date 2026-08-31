"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Download, Share2, Link as LinkIcon, Check, LayoutGrid, Smartphone, Trophy, Lock } from "lucide-react";
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
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!open || !referralCode) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/referrals/${encodeURIComponent(referralCode)}/progress`);
        if (!cancelled) setProgress(data);
      } catch (e) {
        /* new code may not resolve for a beat — silently skip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, referralCode]);

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
      ? `refundmysuper-story-${amt}.png`
      : `refundmysuper-refund-${amt}.png`;
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
        title: "refundmysuper",
        text: `I'm claiming ${formatAUD(amount || 0)} back from Australia via refundmysuper.`,
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
          <DialogTitle className="font-display text-2xl text-[#014E87]">
            {t("share.title")}
          </DialogTitle>
          <DialogDescription className="text-[#475569]">
            {t("share.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {/* Aspect ratio toggle */}
        <div className="inline-flex rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] p-1 w-full">
          <button
            type="button"
            data-testid="aspect-feed"
            onClick={() => setAspect("feed")}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
              aspect === "feed"
                ? "bg-white text-[#014E87] shadow-sm border border-[#E5E7EB] font-medium"
                : "text-[#475569] hover:text-[#014E87]"
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
                ? "bg-white text-[#014E87] shadow-sm border border-[#E5E7EB] font-medium"
                : "text-[#475569] hover:text-[#014E87]"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" /> {t("share.format_story")}
          </button>
        </div>

        {/* Preview — fixed-height box so both the 4:5 and 9:16 canvases scale
            down to fit without being center-cropped by overflow-hidden. A
            previous `w-full h-auto` + `max-h` combo let the image's computed
            height exceed the box, which then got symmetrically clipped
            top/bottom (cutting off the card header in the Story format). */}
        <div className="rounded-xl overflow-hidden border border-[#E5E7EB] bg-[#F8FAFC] flex items-center justify-center h-[420px]">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Refund share card"
              className="max-w-full max-h-full object-contain"
              data-testid="share-card-preview"
            />
          ) : (
            <div className="p-10 text-sm text-[#475569]">Rendering...</div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {referralCode && (
          <div
            data-testid="referral-block"
            className="rounded-lg border border-[#E5E7EB] bg-[#EBF3FA] px-3 py-2.5 flex items-center justify-between gap-2"
          >
            <div className="text-xs">
              <div className="uppercase tracking-[0.15em] text-[#9B3A26] font-medium mb-0.5">
                {t("share.referral_label")}
              </div>
              <div className="font-mono text-[#014E87] text-base font-semibold" data-testid="referral-code">
                {referralCode}
              </div>
            </div>
            <div className="text-[10px] text-[#475569] max-w-[190px] leading-snug text-right">
              {t("share.referral_hint")}
            </div>
          </div>
        )}

        {progress && (
          <div
            data-testid="reward-tier-block"
            className="rounded-lg border border-[#E5E7EB] bg-white p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#014E87]" />
              <div className="text-xs uppercase tracking-[0.15em] text-[#475569] font-medium">
                {t("reward.title")}
              </div>
            </div>
            <p className="text-sm text-[#014E87]" data-testid="reward-count">
              {t("reward.referred_count", { count: progress.referred_count })}
            </p>

            {progress.next_tier ? (
              <p className="text-sm text-[#475569]" data-testid="reward-next">
                <Trans
                  i18nKey="reward.next_reward"
                  values={{
                    remaining: progress.remaining_to_next,
                    reward: progress.next_tier.reward,
                  }}
                  components={{ strong: <strong className="text-[#014E87]" /> }}
                />
              </p>
            ) : (
              <p className="text-sm text-[#2E7D32] font-medium" data-testid="reward-max">
                {t("reward.unlocked_all")}
              </p>
            )}

            <ul className="space-y-1.5 pt-1" data-testid="reward-tiers-list">
              {progress.tiers.map((tier) => {
                const isUnlocked = progress.referred_count >= tier.threshold;
                return (
                  <li
                    key={tier.threshold}
                    data-testid={`reward-tier-${tier.threshold}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                        isUnlocked ? "bg-[#E6EFD8] text-[#2E7D32]" : "bg-[#F0EEE9] text-[#8A9199]"
                      }`}
                    >
                      {isUnlocked ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    </span>
                    <span className={isUnlocked ? "text-[#014E87]" : "text-[#475569]"}>
                      <strong>{tier.threshold}</strong> · {tier.reward}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-1">
          <Button
            data-testid="share-download"
            onClick={downloadPng}
            variant="outline"
            className="border-2 border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
          >
            <Download className="h-4 w-4 mr-2" />
            {aspect === "story" ? t("share.download_story") : t("share.download")}
          </Button>
          <Button
            data-testid="share-native"
            onClick={nativeShare}
            className="bg-[#014E87] hover:bg-[#013A66] text-white"
          >
            <Share2 className="h-4 w-4 mr-2" /> {t("share.share_native")}
          </Button>
          <Button
            data-testid="share-copy"
            onClick={copyLink}
            variant="outline"
            className="border-2 border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
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
  ctx.fillStyle = "#F2F2F2";
  ctx.fillRect(0, 0, W, H);

  // Coral top swash — height scales with format
  const swashH = aspect === "story" ? 520 : 380;
  const swashDip = aspect === "story" ? 120 : 120;
  ctx.fillStyle = "#014E87";
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

  // Logo mark — gold rupee accent to echo the refundmysuper hero mascot
  ctx.fillStyle = "#D5A31B";
  roundRect(ctx, 80, 90, 96, 96, 22);
  ctx.fill();
  ctx.fillStyle = "#014E87";
  ctx.font = "700 62px 'Manrope', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("₹", 128, 138);

  // Brand name
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 44px 'Manrope', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("refundmysuper", 200, 138);

  // Eyebrow
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 26px 'Manrope', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(spaced("DASP REFUND · CLAIMED"), W / 2, aspect === "story" ? 350 : 300);

  // Compose content block Y-positions (relative)
  const contentTop = aspect === "story" ? 780 : 560;

  ctx.fillStyle = "#014E87";
  ctx.font = "600 82px 'Manrope', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(t("share.card_headline"), W / 2, contentTop);

  ctx.fillStyle = "#014E87";
  ctx.font = "700 200px 'Manrope', system-ui, sans-serif";
  ctx.fillText(formatAUD(amount || 0), W / 2, contentTop + 100);

  ctx.fillStyle = "#014E87";
  ctx.font = "500 60px 'Manrope', system-ui, sans-serif";
  ctx.fillText(t("share.card_from"), W / 2, contentTop + 340);

  // Visa chip
  ctx.font = "600 30px 'Manrope', system-ui, sans-serif";
  const chipTextWidth = ctx.measureText(visaLabel).width;
  const chipW = chipTextWidth + 70;
  const chipH = 68;
  const chipX = (W - chipW) / 2;
  const chipY = contentTop + 450;
  ctx.fillStyle = "#014E87";
  roundRect(ctx, chipX, chipY, chipW, chipH, 34);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText(visaLabel, W / 2, chipY + chipH / 2 + 2);

  // Divider
  ctx.strokeStyle = "rgba(1, 78, 135, 0.15)";
  ctx.lineWidth = 2;
  const divY = aspect === "story" ? H - 500 : H - 180;
  ctx.beginPath();
  ctx.moveTo(180, divY);
  ctx.lineTo(W - 180, divY);
  ctx.stroke();

  // Footer / URL block
  ctx.fillStyle = "#475569";
  ctx.font = "500 30px 'Manrope', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Estimate yours in 3 minutes →", W / 2, divY + 30);

  ctx.fillStyle = "#014E87";
  ctx.font = "600 34px 'Manrope', system-ui, sans-serif";
  ctx.fillText(t("share.card_via"), W / 2, divY + 80);

  // Referral code pill
  if (referralCode) {
    ctx.font = "600 26px 'Manrope', system-ui, sans-serif";
    const refText = `REF · ${referralCode}`;
    const refTextW = ctx.measureText(refText).width;
    const refChipW = refTextW + 44;
    const refChipH = 52;
    const refChipX = (W - refChipW) / 2;
    const refChipY = divY + 140;
    ctx.fillStyle = "#EBF3FA";
    ctx.strokeStyle = "#014E87";
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
    ctx.font = "italic 500 26px 'Manrope', system-ui, sans-serif";
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
