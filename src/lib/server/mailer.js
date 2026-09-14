// Transactional email via the Resend HTTP API.
//
// Replaces the previous Nodemailer/SMTP transport: serverless platforms
// (Vercel included, since it runs on AWS Lambda) block outbound SMTP ports,
// which made raw SMTP fail with ETIMEDOUT in production. Resend is a plain
// HTTPS call, so it works from any serverless runtime.
//
// Keeps the codebase's soft-fail-if-unconfigured convention: never throws when
// credentials are missing, just logs a [STUB] line and returns.
import { Resend } from "resend";

let _client = null;

// Lazy, like supabaseAdmin.js — read the key at call time, not import time, so
// `next build` never fails just because the env var is unset.
function getClient() {
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendMail({ to, subject, html }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return;

  if (!isEmailConfigured()) {
    console.log(
      `[STUB] email not sent (RESEND_API_KEY / RESEND_FROM_EMAIL not configured) — to=${recipients.join(",")} subject=${subject}`
    );
    return;
  }

  try {
    // The SDK resolves with { data, error } instead of rejecting on API
    // errors, so an unchecked `error` would look like a successful send.
    const { data, error } = await getClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: recipients,
      subject,
      html,
    });
    if (error) {
      console.error("[MAILER] Resend rejected the send:", error);
      return;
    }
    console.log(`[MAILER] sent id=${data?.id} to=${recipients.join(",")}`);
  } catch (e) {
    console.error("[MAILER] send failed:", e);
  }
}
