// Shared branded HTML shell for all outbound emails (lead confirmation, admin
// notification, weekly digest). Table-based layout + inline styles throughout
// — email clients (Outlook in particular) strip <style> blocks and modern
// CSS, so this intentionally avoids flexbox/grid and relies on the same
// technique real transactional-email templates use.

const SITE_URL = (process.env.SITE_URL || "https://refundsuper.com.au").replace(/\/$/, "");

const BRAND = {
  navy: "#014E87",
  navyDark: "#013A66",
  blue: "#0076C2",
  gold: "#D5A31B",
  ink: "#0F172A",
  muted: "#475569",
  border: "#E5E7EB",
  bg: "#F2F2F2",
  card: "#FFFFFF",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/** A pill/stat block used across the confirmation email and the digest. */
function statBlock({ label, value, accent = BRAND.navy }) {
  return `
    <td align="center" style="padding:0 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F8FAFC;border:1px solid ${BRAND.border};border-radius:12px;">
        <tr>
          <td align="center" style="padding:16px 10px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:6px;">${escapeHtml(label)}</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${accent};">${value}</div>
          </td>
        </tr>
      </table>
    </td>
  `;
}

/**
 * Wraps `bodyHtml` in the full branded email shell: logo header with a gold
 * accent bar, a white content card, and a compliance/footer block matching
 * the copy already used in the site footer.
 */
function renderEmail({ preheader = "", bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>refundmysuper</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${BRAND.card};border-radius:16px;overflow:hidden;box-shadow:0 18px 60px -20px rgba(1,78,135,0.20);">
          <tr>
            <td align="center" style="background:${BRAND.card};padding:28px 24px 20px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.01em;
                color:${BRAND.navy};
                background:linear-gradient(90deg, ${BRAND.navy} 0%, ${BRAND.blue} 55%, ${BRAND.gold} 100%);
                -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">refundmysuper</span>
            </td>
          </tr>
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background:linear-gradient(90deg, ${BRAND.gold}, ${BRAND.navy});">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};padding-top:20px;">
                <tr><td style="padding-top:20px;"></td></tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
          <tr>
            <td align="center" style="padding:20px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.muted};">
              refundmysuper operates as a facilitation platform. Formal DASP claims are managed in partnership with
              TPB-registered tax agents. Estimates shown are indicative and not financial advice — always consult
              your super fund and the ATO.
              <br /><br />
              refundmysuper &middot; Sydney, Australia &middot;
              <a href="mailto:hello@refundsuper.com.au" style="color:${BRAND.navy};text-decoration:none;">hello@refundsuper.com.au</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button({ href, label, color = BRAND.navy, textColor = "#FFFFFF" }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="border-radius:10px;background:${color};">
          <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${textColor};text-decoration:none;border-radius:10px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export { renderEmail, statBlock, button, escapeHtml, BRAND, SITE_URL };
