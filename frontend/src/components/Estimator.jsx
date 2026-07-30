import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Plane, GraduationCap, ArrowRight, ArrowLeft, Sparkles, Check, Share2 } from "lucide-react";
import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import CountUp from "@/components/CountUp";
import ShareCardModal from "@/components/ShareCardModal";
import { api } from "@/lib/api";
import { formatAUD } from "@/lib/format";
import { useRecaptcha } from "@/lib/recaptcha";
import { captureReferralFromUrl } from "@/lib/referral";

const TAX_INFO = {
  working_holiday: { tax: 0.65, keepLabel: "35%" },
  other_temp: { tax: 0.35, keepLabel: "65%" },
};
const SUPER_RATE = 0.12;

function compute(visaType, mode, balance, earnings) {
  const base = mode === "balance" ? Number(balance) || 0 : (Number(earnings) || 0) * SUPER_RATE;
  const rate = TAX_INFO[visaType].tax;
  return Math.max(0, Math.round(base * (1 - rate)));
}

export default function Estimator({ embedded = true, id = "estimator" }) {
  const { t } = useTranslation();
  const getRecaptchaToken = useRecaptcha("leads");
  const [step, setStep] = useState(1);
  const [visaType, setVisaType] = useState("working_holiday");
  const [mode, setMode] = useState("balance");
  const [balance, setBalance] = useState("5000");
  const [earnings, setEarnings] = useState([45000]);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappError, setWhatsappError] = useState("");

  const [superFund, setSuperFund] = useState("");
  const [dateLeft, setDateLeft] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [createdLead, setCreatedLead] = useState(null);
  const [inboundRef, setInboundRef] = useState(null);

  useEffect(() => {
    setInboundRef(captureReferralFromUrl());
  }, []);

  const estimate = useMemo(
    () => compute(visaType, mode, balance, earnings[0]),
    [visaType, mode, balance, earnings]
  );

  const goNext = () => setStep((s) => Math.min(3, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleReveal = async () => {
    if (!firstName.trim() || !email.trim() || !whatsapp.trim()) {
      toast.error(t("estimator.err_missing_contact"));
      return;
    }
    if (!isValidPhoneNumber(whatsapp.trim())) {
      setWhatsappError(t("estimator.whatsapp_invalid"));
      toast.error(t("estimator.whatsapp_invalid"));
      return;
    }
    setWhatsappError("");
    setRevealed(true);
    // We don't submit yet — wait for step 3 for full lead. But we'll do a soft estimate API call.
    try {
      await api.post("/estimate", {
        visa_type: visaType,
        input_mode: mode,
        super_balance: mode === "balance" ? Number(balance) : null,
        gross_earnings: mode === "earnings" ? Number(earnings[0]) : null,
      });
    } catch (e) {
      // non-blocking
    }
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const normalizedPhone =
        parsePhoneNumberFromString(whatsapp.trim())?.format("E.164") || whatsapp.trim();
      const recaptchaToken = await getRecaptchaToken();
      const headers = recaptchaToken ? { "X-Recaptcha-Token": recaptchaToken } : {};
      const { data: lead } = await api.post(
        "/leads",
        {
          visa_type: visaType,
          input_mode: mode,
          super_balance: mode === "balance" ? Number(balance) : null,
          gross_earnings: mode === "earnings" ? Number(earnings[0]) : null,
          estimated_refund: estimate,
          first_name: firstName,
          email,
          whatsapp_number: normalizedPhone,
          super_fund_name: superFund || null,
          date_left_australia: dateLeft || null,
          referred_by_code: inboundRef || null,
        },
        { headers }
      );
      setCreatedLead(lead);
      setSubmitted(true);
      toast.success(t("estimator.success_toast"));
    } catch (e) {
      const status = e?.response?.status;
      if (status === 429) {
        toast.error(e?.response?.data?.detail || "Too many submissions. Please try again later.");
      } else {
        toast.error(e?.response?.data?.detail || t("estimator.err_generic"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id={id}
      data-testid="estimator-card"
      className="relative bg-white border border-[#0B2B40]/10 rounded-2xl shadow-[0_18px_60px_-20px_rgba(11,43,64,0.25)] p-6 md:p-8 w-full max-w-lg"
    >
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-[#4A5D68]">
          Step {step} of 3
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                step >= n ? "bg-[#E05D43]" : "bg-[#E8E6E1]"
              }`}
              data-testid={`step-indicator-${n}`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <h3 className="font-display text-2xl md:text-3xl font-medium text-[#0B2B40] mb-1">
              {t("estimator.step1_title")}
            </h3>
            <p className="text-sm text-[#4A5D68] mb-6">
              {t("estimator.step1_sub")}
            </p>

            <Label className="text-sm font-medium text-[#0B2B40] mb-2 block">
              {t("estimator.visa_label")}
            </Label>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                data-testid="visa-working-holiday"
                onClick={() => setVisaType("working_holiday")}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  visaType === "working_holiday"
                    ? "border-[#E05D43] bg-[#FFF6F2]"
                    : "border-[#E8E6E1] bg-[#FAFAF9] hover:border-[#0B2B40]/30"
                }`}
              >
                <Plane className="h-5 w-5 text-[#E05D43] mb-2" />
                <div className="font-display font-medium text-[#0B2B40]">{t("estimator.visa_wh_title")}</div>
                <div className="text-xs text-[#4A5D68] mt-1">{t("estimator.visa_wh_sub")}</div>
              </button>
              <button
                type="button"
                data-testid="visa-other-temp"
                onClick={() => setVisaType("other_temp")}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  visaType === "other_temp"
                    ? "border-[#E05D43] bg-[#FFF6F2]"
                    : "border-[#E8E6E1] bg-[#FAFAF9] hover:border-[#0B2B40]/30"
                }`}
              >
                <GraduationCap className="h-5 w-5 text-[#E05D43] mb-2" />
                <div className="font-display font-medium text-[#0B2B40]">{t("estimator.visa_other_title")}</div>
                <div className="text-xs text-[#4A5D68] mt-1">{t("estimator.visa_other_sub")}</div>
              </button>
            </div>

            <Tabs value={mode} onValueChange={setMode} className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-[#FAFAF9] border border-[#E8E6E1]">
                <TabsTrigger value="balance" data-testid="mode-balance">
                  {t("estimator.mode_balance")}
                </TabsTrigger>
                <TabsTrigger value="earnings" data-testid="mode-earnings">
                  {t("estimator.mode_earnings")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="balance" className="pt-5">
                <Label className="text-sm text-[#0B2B40] mb-2 block">
                  {t("estimator.balance_label")}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5D68]">
                    $
                  </span>
                  <Input
                    data-testid="balance-input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="pl-7 bg-[#FAFAF9] border-[#E8E6E1] h-12 text-lg"
                    placeholder="5000"
                  />
                </div>
              </TabsContent>
              <TabsContent value="earnings" className="pt-5">
                <Label className="text-sm text-[#0B2B40] mb-2 block">
                  {t("estimator.earnings_label", { amount: formatAUD(earnings[0]) })}
                </Label>
                <Slider
                  data-testid="earnings-slider"
                  value={earnings}
                  onValueChange={setEarnings}
                  min={5000}
                  max={150000}
                  step={1000}
                  className="my-4"
                />
                <p className="text-xs text-[#4A5D68]">
                  {t("estimator.earnings_note")}
                </p>
              </TabsContent>
            </Tabs>

            <div className="mt-7 p-4 rounded-xl bg-[#FFF6F2] border border-[#F3C8BB]">
              <div className="text-xs uppercase tracking-[0.15em] text-[#9B3A26] mb-1">
                {t("estimator.preview_label")}
              </div>
              <div className="font-display text-2xl text-[#0B2B40]">
                ≈ {formatAUD(estimate)}
              </div>
              <div className="text-xs text-[#4A5D68] mt-1">
                {t("estimator.preview_retention", { keep: TAX_INFO[visaType].keepLabel })}
              </div>
            </div>

            <Button
              data-testid="step1-next"
              onClick={goNext}
              className="w-full mt-6 bg-[#E05D43] hover:bg-[#C8533B] text-white h-12 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)] hover:-translate-y-0.5 transition-all"
            >
              {t("estimator.step1_next")} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="s2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <h3 className="font-display text-2xl md:text-3xl font-medium text-[#0B2B40] mb-1">
              {t("estimator.step2_title")}
            </h3>
            <p className="text-sm text-[#4A5D68] mb-6">
              {t("estimator.step2_sub")}
            </p>

            {/* Blurred result preview */}
            <div className="relative mb-6 rounded-xl overflow-hidden border border-[#E8E6E1] bg-[#FAFAF9]">
              <div className="p-6 text-center">
                <div className="text-xs uppercase tracking-[0.18em] text-[#4A5D68] mb-2">
                  {t("estimator.estimated_label")}
                </div>
                <div className="font-display text-4xl text-[#0B2B40] blur-md select-none">
                  $X,XXX
                </div>
              </div>
              <div className="absolute inset-0 backdrop-blur-md bg-white/40 flex items-center justify-center">
                <div className="flex items-center gap-2 text-[#0B2B40] font-medium">
                  <Lock className="h-4 w-4" /> {t("estimator.unlock_below")}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-[#0B2B40]">{t("estimator.first_name")}</Label>
                <Input
                  data-testid="first-name-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Sam"
                  className="bg-[#FAFAF9] border-[#E8E6E1] h-11 mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-[#0B2B40]">{t("estimator.email")}</Label>
                <Input
                  data-testid="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sam@example.com"
                  className="bg-[#FAFAF9] border-[#E8E6E1] h-11 mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-[#0B2B40]">{t("estimator.whatsapp")}</Label>
                <Input
                  data-testid="whatsapp-input"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    if (whatsappError) setWhatsappError("");
                  }}
                  placeholder={t("estimator.whatsapp_placeholder")}
                  aria-invalid={Boolean(whatsappError)}
                  className={`bg-[#FAFAF9] h-11 mt-1 ${
                    whatsappError
                      ? "border-[#D32F2F] focus-visible:ring-[#D32F2F]/25"
                      : "border-[#E8E6E1]"
                  }`}
                />
                {whatsappError && (
                  <p data-testid="whatsapp-error" className="text-xs text-[#D32F2F] mt-1">
                    {whatsappError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                data-testid="step2-back"
                variant="outline"
                onClick={goBack}
                className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40] h-12 rounded-lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> {t("estimator.step2_back")}
              </Button>
              <Button
                data-testid="step2-reveal"
                onClick={handleReveal}
                className="flex-1 bg-[#E05D43] hover:bg-[#C8533B] text-white h-12 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)] hover:-translate-y-0.5 transition-all"
              >
                {t("estimator.step2_reveal")} <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-[#4A5D68] mt-3 text-center">
              {t("estimator.privacy")}
            </p>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="s3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {!submitted ? (
              <>
                <div className="rounded-2xl bg-gradient-to-br from-[#0B2B40] to-[#143C56] text-white p-6 mb-6 text-center">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#A9BDCB] mb-2">
                    {t("estimator.estimated_label")}
                  </div>
                  <div className="font-display text-5xl font-semibold" data-testid="refund-amount">
                    <CountUp value={revealed ? estimate : 0} />
                  </div>
                  <div className="text-xs text-[#A9BDCB] mt-2">
                    {t("estimator.step3_retention", { keep: TAX_INFO[visaType].keepLabel })}
                  </div>
                </div>

                <p className="text-sm text-[#4A5D68] mb-4">
                  {t("estimator.step3_intro")}
                </p>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-[#0B2B40]">{t("estimator.super_fund")}</Label>
                    <Input
                      data-testid="super-fund-input"
                      value={superFund}
                      onChange={(e) => setSuperFund(e.target.value)}
                      placeholder={t("estimator.super_fund_placeholder")}
                      className="bg-[#FAFAF9] border-[#E8E6E1] h-11 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#0B2B40]">{t("estimator.date_left")}</Label>
                    <Input
                      data-testid="date-left-input"
                      type="date"
                      value={dateLeft}
                      onChange={(e) => setDateLeft(e.target.value)}
                      className="bg-[#FAFAF9] border-[#E8E6E1] h-11 mt-1"
                    />
                  </div>
                </div>

                <Button
                  data-testid="step3-submit"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  className="w-full mt-6 bg-[#E05D43] hover:bg-[#C8533B] text-white h-12 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)] hover:-translate-y-0.5 transition-all disabled:opacity-60"
                >
                  {submitting ? t("estimator.step3_submitting") : t("estimator.step3_submit")}
                </Button>
              </>
            ) : (
              <div className="text-center py-6" data-testid="submitted-state">
                <div className="h-16 w-16 rounded-full bg-[#E6EFD8] text-[#2E7D32] mx-auto flex items-center justify-center mb-4">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="font-display text-2xl font-medium text-[#0B2B40] mb-2">
                  {t("estimator.submitted_title", { name: firstName })}
                </h3>
                <p className="text-sm text-[#4A5D68] mb-4">
                  {t("estimator.submitted_body", { amount: formatAUD(estimate) })}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button
                    data-testid="share-estimate-btn"
                    onClick={() => setShareOpen(true)}
                    className="bg-[#E05D43] hover:bg-[#C8533B] text-white h-11 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)] hover:-translate-y-0.5 transition-all"
                  >
                    <Share2 className="h-4 w-4 mr-2" /> {t("estimator.share_button")}
                  </Button>
                  <Button
                    data-testid="restart-estimator"
                    variant="outline"
                    className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40] h-11"
                    onClick={() => {
                      setStep(1);
                      setSubmitted(false);
                      setRevealed(false);
                    }}
                  >
                    {t("estimator.start_new")}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ShareCardModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        amount={estimate}
        visaType={visaType}
        firstName={firstName}
        referralCode={createdLead?.referral_code || null}
        leadId={createdLead?.id || null}
      />
    </div>
  );
}
