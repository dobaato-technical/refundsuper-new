import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { computeRefund } from "@/lib/server/calculator";
import { newUniqueReferralCode } from "@/lib/server/referrals";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/server/rateLimit";
import { dispatchLeadIntegrations } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";

const VISA_TYPES = ["working_holiday", "other_temp"];
const INPUT_MODES = ["balance", "earnings"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Port of backend/deps.py::verify_recaptcha (stub-capable reCAPTCHA v3 check).
async function verifyRecaptcha(req) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.log("[STUB] reCAPTCHA not configured — skipping verification");
    return null;
  }
  const token = req.headers.get("x-recaptcha-token");
  if (!token) {
    return NextResponse.json({ detail: "Missing X-Recaptcha-Token header" }, { status: 400 });
  }
  const remoteIp = getClientIp(req);
  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") params.set("remoteip", remoteIp);
  let result;
  try {
    const r = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(8000),
    });
    result = await r.json();
  } catch (e) {
    return NextResponse.json({ detail: "reCAPTCHA verification unavailable" }, { status: 503 });
  }
  if (!result.success) {
    return NextResponse.json(
      { detail: { reason: "recaptcha_failed", errors: result["error-codes"] || [] } },
      { status: 403 }
    );
  }
  const action = process.env.RECAPTCHA_ACTION || "leads";
  if (result.action && result.action !== action) {
    return NextResponse.json({ detail: "reCAPTCHA action mismatch" }, { status: 403 });
  }
  const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || "0.5");
  if (parseFloat(result.score || 0) < minScore) {
    return NextResponse.json({ detail: "reCAPTCHA score too low" }, { status: 403 });
  }
  return null;
}

function parseRateLimit(spec) {
  // Mirrors slowapi's "N/hour" | "N/minute" string format.
  const [countStr, unit] = String(spec || "5/hour").split("/");
  const count = parseInt(countStr, 10) || 5;
  const windowMinutes = unit === "minute" ? 1 : unit === "second" ? 1 / 60 : unit === "day" ? 1440 : 60;
  return { count, windowMinutes };
}

export async function POST(req) {
  const ip = getClientIp(req);
  const { count: limit, windowMinutes } = parseRateLimit(process.env.LEAD_RATE_LIMIT || "5/hour");
  const allowed = await checkAndRecordRateLimit(`leads:${ip}`, limit, windowMinutes);
  if (!allowed) {
    return NextResponse.json(
      { detail: `Too many submissions. Please try again later (${process.env.LEAD_RATE_LIMIT || "5/hour"}).` },
      { status: 429 }
    );
  }

  const recaptchaError = await verifyRecaptcha(req);
  if (recaptchaError) return recaptchaError;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const {
    visa_type,
    input_mode,
    super_balance,
    gross_earnings,
    estimated_refund,
    first_name,
    email,
    whatsapp_number,
    super_fund_name,
    date_left_australia,
    referred_by_code,
    utm_source,
    utm_medium,
    utm_campaign,
  } = body || {};

  if (!VISA_TYPES.includes(visa_type)) {
    return NextResponse.json({ detail: "visa_type must be one of working_holiday, other_temp" }, { status: 422 });
  }
  if (!INPUT_MODES.includes(input_mode)) {
    return NextResponse.json({ detail: "input_mode must be one of balance, earnings" }, { status: 422 });
  }
  if (typeof estimated_refund !== "number") {
    return NextResponse.json({ detail: "estimated_refund is required" }, { status: 422 });
  }
  if (typeof first_name !== "string" || first_name.length < 1 || first_name.length > 80) {
    return NextResponse.json({ detail: "first_name must be 1-80 characters" }, { status: 422 });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ detail: "email must be a valid email address" }, { status: 422 });
  }
  if (typeof whatsapp_number !== "string" || whatsapp_number.length < 4 || whatsapp_number.length > 40) {
    return NextResponse.json({ detail: "whatsapp_number must be 4-40 characters" }, { status: 422 });
  }
  const parsedPhone = parsePhoneNumberFromString(whatsapp_number.trim());
  if (!parsedPhone || !parsedPhone.isValid()) {
    return NextResponse.json(
      { detail: "WhatsApp number must be in international E.164 format (e.g. +44 7700 900123)" },
      { status: 422 }
    );
  }
  const normalizedWhatsapp = parsedPhone.format("E.164");
  if (referred_by_code != null && String(referred_by_code).length > 32) {
    return NextResponse.json({ detail: "referred_by_code must be at most 32 characters" }, { status: 422 });
  }
  if (utm_source != null && String(utm_source).length > 80) {
    return NextResponse.json({ detail: "utm_source must be at most 80 characters" }, { status: 422 });
  }
  if (utm_medium != null && String(utm_medium).length > 80) {
    return NextResponse.json({ detail: "utm_medium must be at most 80 characters" }, { status: 422 });
  }
  if (utm_campaign != null && String(utm_campaign).length > 120) {
    return NextResponse.json({ detail: "utm_campaign must be at most 120 characters" }, { status: 422 });
  }

  const calc = computeRefund(visa_type, input_mode, super_balance, gross_earnings);
  const now = new Date().toISOString();
  const referralCode = await newUniqueReferralCode();

  const supabase = getSupabaseAdmin();
  let referredByLeadId = null;
  const referredByCodeUp = (referred_by_code || "").trim().toUpperCase() || null;
  if (referredByCodeUp) {
    const { data: referrer } = await supabase
      .from("leads")
      .select("id")
      .eq("referral_code", referredByCodeUp)
      .maybeSingle();
    if (referrer) referredByLeadId = referrer.id;
    else console.log(`Referral code not found: ${referredByCodeUp}`);
  }

  const doc = {
    id: randomUUID(),
    visa_type,
    input_mode,
    super_balance: super_balance ?? null,
    gross_earnings: gross_earnings ?? null,
    estimated_refund: calc.estimated_refund,
    first_name,
    email,
    whatsapp_number: normalizedWhatsapp,
    super_fund_name: super_fund_name || null,
    date_left_australia: date_left_australia || null,
    status: "new_estimate",
    created_at: now,
    updated_at: now,
    referral_code: referralCode,
    referred_by_code: referredByCodeUp,
    referred_by_lead_id: referredByLeadId,
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
  };

  const { error: insertError } = await supabase.from("leads").insert(doc);
  if (insertError) {
    console.error("Lead insert failed:", insertError);
    return NextResponse.json({ detail: "Failed to create lead" }, { status: 500 });
  }

  // Run after the response is sent — a live SMTP provider can take 10s+ per
  // send (observed), and this is the core lead-capture conversion flow, so
  // the visitor must not wait on WhatsApp/email/webhook dispatch to see
  // their confirmation. `after()` keeps the invocation alive to finish this
  // work without holding up the HTTP response.
  after(async () => {
    try {
      await dispatchLeadIntegrations(doc);
    } catch (e) {
      console.error("dispatchLeadIntegrations failed:", e);
    }
  });

  return NextResponse.json(doc);
}
