// External integrations: WhatsApp, email, HMAC-signed CRM webhook, IndexNow,
// Google Search Console. Port of backend/integrations.py — WhatsApp now uses
// the `twilio` npm package (same Twilio API), email goes through mailer.js
// (Nodemailer/SMTP replacing Resend), and the webhook path is unchanged
// (enqueue into the durable outbox, HMAC-signed on delivery by outbox.js).
import twilio from "twilio";
import { sendMail } from "./mailer";
import { enqueue } from "./outbox";
import { renderEmail, button, escapeHtml, BRAND, SITE_URL } from "./emailTemplates";

const VISA_LABEL = { working_holiday: "Working Holiday Maker", other_temp: "Student / Other Temporary Visa" };
const fmtAUD = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

// -------------------- WhatsApp --------------------
export async function sendWhatsapp(lead) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM)) {
    console.log(`[STUB] WhatsApp not configured — would notify ${lead.whatsapp_number}`);
    return;
  }
  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const body =
      `Hi ${lead.first_name}, this is refundmysuper. We've received your estimate ` +
      `of $${Math.round(lead.estimated_refund).toLocaleString()}. Our team will contact you shortly to ` +
      `fast-track your DASP refund. Reply STOP to opt-out.`;
    let to = lead.whatsapp_number || "";
    if (!to.startsWith("whatsapp:")) to = `whatsapp:${to}`;
    const msg = await client.messages.create({ body, from: TWILIO_WHATSAPP_FROM, to });
    console.log(`WhatsApp sent SID=${msg.sid}`);
  } catch (e) {
    console.error("WhatsApp send failed:", e);
  }
}

// -------------------- Email --------------------
export async function sendLeadEmails(lead) {
  if (!process.env.SMTP_HOST) {
    console.log(`[STUB] Email not configured — would email ${lead.email}`);
    return;
  }
  const adminRecipients = (process.env.ADMIN_NOTIFICATION_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const sends = [
    sendMail({
      to: lead.email,
      subject: `Your refundmysuper Australian Super refund estimate: ${fmtAUD(lead.estimated_refund)}`,
      html: renderEmail({
        preheader: `Your estimated refund is ${fmtAUD(lead.estimated_refund)} — here's what happens next.`,
        bodyHtml: `
          <h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:${BRAND.navy};">
            Hi ${escapeHtml(lead.first_name)}, your super is on its way home.
          </h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND.muted};">
            Thanks for using refundmysuper. Based on what you told us, here's your free DASP refund estimate:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.navy};border-radius:14px;margin-bottom:24px;">
            <tr>
              <td align="center" style="padding:28px 20px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);margin-bottom:8px;">
                  Estimated refund
                </div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:42px;font-weight:700;color:#FFFFFF;line-height:1.1;">
                  ${fmtAUD(lead.estimated_refund)}
                </div>
                <div style="display:inline-block;margin-top:14px;padding:6px 16px;background:rgba(255,255,255,0.15);border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:${BRAND.gold};">
                  ${escapeHtml(VISA_LABEL[lead.visa_type] || "Temporary visa")}
                </div>
              </td>
            </tr>
          </table>
          <h2 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${BRAND.navy};">What happens next</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            ${[
              ["1", "We review your details", "Our TPB-partnered tax agents check your eligibility — no paperwork needed from you yet."],
              ["2", "We message you on WhatsApp", `We'll reach out at ${escapeHtml(lead.whatsapp_number || "your WhatsApp number")} within 1 business day.`],
              ["3", "You get paid", "Once lodged, DASP payments usually land within 28 days — straight to your bank."],
            ]
              .map(
                ([n, title, body]) => `
              <tr>
                <td width="36" valign="top" style="padding:0 0 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;border-radius:50%;background:#EBF3FA;color:${BRAND.navy};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;text-align:center;line-height:26px;">${n}</td></tr></table>
                </td>
                <td valign="top" style="padding:0 0 18px 12px;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${BRAND.ink};margin-bottom:2px;">${escapeHtml(title)}</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${BRAND.muted};">${body}</div>
                </td>
              </tr>`
              )
              .join("")}
          </table>
          <div style="margin-bottom:8px;">
            ${button({ href: `${SITE_URL}/#estimator`, label: "View my estimate again" })}
          </div>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:${BRAND.muted};">
            Questions in the meantime? Just reply to this email or WhatsApp us — we usually respond within an hour.
          </p>
          <p style="margin:20px 0 0;font-size:14px;color:${BRAND.ink};">– The refundmysuper Team</p>
        `,
      }),
    }),
  ];
  if (adminRecipients.length) {
    const rows = [
      ["Name", escapeHtml(lead.first_name)],
      ["Email", `<a href="mailto:${escapeHtml(lead.email)}" style="color:${BRAND.navy};">${escapeHtml(lead.email)}</a>`],
      ["WhatsApp", escapeHtml(lead.whatsapp_number)],
      ["Visa", escapeHtml(VISA_LABEL[lead.visa_type] || lead.visa_type)],
      ["Estimated refund", `<strong>${fmtAUD(lead.estimated_refund)}</strong>`],
      ["Super fund", escapeHtml(lead.super_fund_name || "N/A")],
      ["Departure date", escapeHtml(lead.date_left_australia || "N/A")],
    ];
    sends.push(
      sendMail({
        to: adminRecipients,
        subject: `New refundmysuper lead: ${lead.first_name} (${fmtAUD(lead.estimated_refund)})`,
        html: renderEmail({
          preheader: `New lead: ${lead.first_name} — ${fmtAUD(lead.estimated_refund)} estimated refund.`,
          bodyHtml: `
            <h1 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${BRAND.navy};">New lead captured</h1>
            <p style="margin:0 0 22px;font-size:14px;color:${BRAND.muted};">A visitor just completed a refund estimate.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;margin-bottom:24px;">
              ${rows
                .map(
                  ([label, value], i) => `
                <tr>
                  <td style="padding:12px 16px;background:${i % 2 === 0 ? "#F8FAFC" : "#FFFFFF"};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.muted};width:150px;border-bottom:1px solid ${BRAND.border};">${label}</td>
                  <td style="padding:12px 16px;background:${i % 2 === 0 ? "#F8FAFC" : "#FFFFFF"};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.ink};border-bottom:1px solid ${BRAND.border};">${value}</td>
                </tr>`
                )
                .join("")}
            </table>
            ${button({ href: `${SITE_URL}/admin`, label: "Open admin dashboard" })}
          `,
        }),
      })
    );
  }
  // Independent recipients — send concurrently rather than serializing two
  // SMTP round-trips on the /api/leads response path.
  await Promise.allSettled(sends);
}

// -------------------- HMAC-signed CRM webhook (Zapier / Zoho / Hubspot) --------------------
/**
 * Enqueue an outbound event into the durable outbox (see outbox.js). When
 * WEBHOOK_URL is unset this is a no-op, mirroring the Python stub behaviour.
 */
export function sendWebhook(event, data, { previous } = {}) {
  if (!process.env.WEBHOOK_URL) {
    console.log(`[STUB] Webhook not configured — would forward event=${event} id=${data?.id}`);
    return Promise.resolve(null);
  }
  return enqueue(event, data, { previous });
}

export async function dispatchLeadIntegrations(lead) {
  // Run concurrently, not sequentially — this sits on the /api/leads response
  // path, so a slow provider (e.g. SMTP) shouldn't add its latency on top of
  // the others'. Each call already catches its own errors internally, but
  // allSettled is a second guard against one hanging integration blocking
  // the others from even starting.
  await Promise.allSettled([sendWhatsapp(lead), sendLeadEmails(lead), sendWebhook("lead.created", lead)]);
}

// -------------------- IndexNow (Bing/Yandex/DuckDuckGo instant re-crawl) --------------------
export async function pingIndexnow(urls, host) {
  const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "";
  const INDEXNOW_ENDPOINT = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";
  if (!INDEXNOW_KEY || !urls.length) {
    if (!INDEXNOW_KEY) console.log(`[STUB] IndexNow not configured — would ping ${urls.length} urls`);
    return null;
  }
  let parsedHost;
  try {
    parsedHost = new URL(host).host;
  } catch (e) {
    parsedHost = host;
  }
  const payload = {
    host: parsedHost,
    key: INDEXNOW_KEY,
    keyLocation: `${host.replace(/\/$/, "")}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };
  try {
    const resp = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    console.log(`IndexNow ping status=${resp.status} urls=${urls.length} host=${parsedHost}`);
    return { status: resp.status, urls: urls.length };
  } catch (e) {
    console.error("IndexNow ping failed:", e);
    return { error: String(e), urls: urls.length };
  }
}

// -------------------- Google Search Console (optional, service-account OAuth) --------------------
/**
 * Force a sitemap re-submission via the Search Console API's REST endpoint.
 * The plan specifies `google-auth-library` (not the full `googleapis` client)
 * for this port, so the sitemap-submit call is made directly against the
 * Webmasters v3 REST API rather than through a generated client — functionally
 * identical to the Python version's `service.sitemaps().submit(...)`.
 */
export async function pingGscSitemap(sitemapUrl, siteProperty) {
  const GSC_SERVICE_ACCOUNT_JSON = process.env.GSC_SERVICE_ACCOUNT_JSON || "";
  if (!GSC_SERVICE_ACCOUNT_JSON) {
    console.log("[STUB] GSC_SERVICE_ACCOUNT_JSON not configured — skipping GSC ping");
    return null;
  }
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const info = JSON.parse(GSC_SERVICE_ACCOUNT_JSON);
    const auth = new GoogleAuth({
      credentials: info,
      scopes: ["https://www.googleapis.com/auth/webmasters"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const resp = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteProperty)}/sitemaps/${encodeURIComponent(
        sitemapUrl
      )}`,
      { method: "PUT", headers: { Authorization: `Bearer ${token.token}` } }
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`GSC API ${resp.status}: ${text}`);
    }
    console.log(`GSC sitemap re-submitted: ${sitemapUrl} (property=${siteProperty})`);
    return { ok: true, sitemap: sitemapUrl };
  } catch (e) {
    console.error("GSC ping failed:", e);
    return { error: String(e.message || e) };
  }
}

export async function pingSearchEnginesForSlug(siteUrl, slugs) {
  const base = siteUrl.replace(/\/$/, "");
  const urls = (slugs || []).filter(Boolean).map((s) => `${base}/blog/${s}`);
  // Always include /blog itself so listing pages get re-crawled too.
  urls.push(`${base}/blog`);
  urls.push(`${base}/sitemap.xml`);
  const indexnowResult = await pingIndexnow(urls, siteUrl);
  const gscResult = await pingGscSitemap(`${base}/sitemap.xml`, `${base}/`);
  return { indexnow: indexnowResult, gsc: gscResult, urls };
}
