// Generic SMTP transport via Nodemailer — replaces Resend, per the migration
// plan (provider-agnostic SMTP_* env vars). Mirrors backend/integrations.py's
// soft-fail-if-unconfigured pattern: never throws when SMTP isn't set up,
// just logs a [STUB] line and returns.
import nodemailer from "nodemailer";

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    // Bounded so a slow/unreachable SMTP host fails fast instead of hanging
    // the request that triggered it (e.g. lead submission) for minutes —
    // this call sits on the response path, not a background job.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
  return _transporter;
}

export async function sendMail({ to, subject, html }) {
  if (!process.env.SMTP_HOST) {
    console.log(
      `[STUB] email not sent (SMTP not configured) — to=${Array.isArray(to) ? to.join(",") : to} subject=${subject}`
    );
    return;
  }
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: Array.isArray(to) ? to.join(",") : to,
      subject,
      html,
    });
  } catch (e) {
    console.error("[MAILER] send failed:", e);
  }
}
