// Weekly digest email. Port of backend/services/digest.py. Cron scheduling
// (Mon 09:00 Sydney) is explicitly deferred — this is invoked on-demand via
// the admin UI's "Run digest" button / POST /api/admin/weekly-digest/run.
import { getSupabaseAdmin } from "./supabaseAdmin";
import { sendMail } from "./mailer";
import { renderEmail, statBlock, button, escapeHtml, BRAND, SITE_URL } from "./emailTemplates";

const CHANNEL_LABEL = { download: "Downloads", native: "Native share", copy: "Link copies", story_download: "Story downloads" };

export async function buildWeeklyDigest() {
  const supabase = getSupabaseAdmin();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: newLeadsCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo);

  const { data: pipelineRows } = await supabase.from("leads").select("estimated_refund").gte("created_at", weekAgo);
  const newPipeline = (pipelineRows || []).reduce((sum, r) => sum + Number(r.estimated_refund || 0), 0);

  const channels = ["download", "native", "copy", "story_download"];
  const channelCounts = {};
  for (const ch of channels) {
    const { count } = await supabase
      .from("share_events")
      .select("*", { count: "exact", head: true })
      .eq("channel", ch)
      .gte("created_at", weekAgo);
    channelCounts[ch] = count || 0;
  }
  const topChannelEntry = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0] || ["-", 0];

  const { data: referredRows } = await supabase
    .from("leads")
    .select("referred_by_lead_id")
    .not("referred_by_lead_id", "is", null)
    .gte("created_at", weekAgo);
  const countsByReferrer = {};
  for (const row of referredRows || []) {
    countsByReferrer[row.referred_by_lead_id] = (countsByReferrer[row.referred_by_lead_id] || 0) + 1;
  }
  const topEntries = Object.entries(countsByReferrer)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topReferrers = [];
  for (const [leadId, count] of topEntries) {
    const { data: ref } = await supabase
      .from("leads")
      .select("first_name, email, referral_code")
      .eq("id", leadId)
      .maybeSingle();
    if (ref) topReferrers.push({ ...ref, referred_count: count });
  }

  return {
    since: weekAgo,
    new_leads_count: newLeadsCount || 0,
    new_pipeline_value: Math.round(newPipeline * 100) / 100,
    share_events_by_channel: channelCounts,
    top_channel: { channel: topChannelEntry[0], count: topChannelEntry[1] },
    top_referrers: topReferrers,
  };
}

function digestToHtml(d) {
  const referrerRows = d.top_referrers.length
    ? d.top_referrers
        .map(
          (r, i) => `
        <tr>
          <td style="padding:12px 16px;background:${i % 2 === 0 ? "#F8FAFC" : "#FFFFFF"};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.ink};border-bottom:1px solid ${BRAND.border};">
            <strong>${escapeHtml(r.first_name)}</strong><br/>
            <span style="color:${BRAND.muted};font-size:12px;">${escapeHtml(r.email || "")}</span>
          </td>
          <td style="padding:12px 16px;background:${i % 2 === 0 ? "#F8FAFC" : "#FFFFFF"};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.navy};border-bottom:1px solid ${BRAND.border};">
            <code style="background:#EBF3FA;padding:2px 6px;border-radius:6px;">${escapeHtml(r.referral_code || "")}</code>
          </td>
          <td align="right" style="padding:12px 16px;background:${i % 2 === 0 ? "#F8FAFC" : "#FFFFFF"};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${BRAND.ink};border-bottom:1px solid ${BRAND.border};">
            ${r.referred_count}
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="padding:16px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.muted};">No referred leads this week.</td></tr>`;

  const topChannelLabel = CHANNEL_LABEL[d.top_channel.channel] || d.top_channel.channel;

  return renderEmail({
    preheader: `${d.new_leads_count} new leads · $${d.new_pipeline_value.toLocaleString()} new pipeline this week.`,
    bodyHtml: `
      <h1 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${BRAND.navy};">Weekly digest</h1>
      <p style="margin:0 0 24px;font-size:13px;color:${BRAND.muted};">Since ${escapeHtml(d.since.slice(0, 10))}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          ${statBlock({ label: "New leads", value: d.new_leads_count })}
          ${statBlock({ label: "New pipeline", value: `$${d.new_pipeline_value.toLocaleString()}`, accent: BRAND.gold })}
          ${statBlock({ label: "Top channel", value: topChannelLabel, accent: BRAND.blue })}
        </tr>
      </table>

      <h2 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${BRAND.navy};">Top referrers this week</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;margin-bottom:28px;">
        ${referrerRows}
      </table>

      ${button({ href: `${SITE_URL}/admin`, label: "Open admin dashboard" })}
    `,
  });
}

export async function sendWeeklyDigest() {
  const digest = await buildWeeklyDigest();
  const html = digestToHtml(digest);
  const adminRecipients = (process.env.ADMIN_NOTIFICATION_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (process.env.SMTP_HOST && adminRecipients.length) {
    await sendMail({
      to: adminRecipients,
      subject: `refundmysuper weekly digest — ${digest.new_leads_count} new leads`,
      html,
    });
    console.log(`Weekly digest sent to ${adminRecipients}`);
  } else {
    console.log(
      `[STUB] Weekly digest not sent — SMTP / ADMIN_NOTIFICATION_EMAILS not configured. ` +
        `${digest.new_leads_count} new leads · $${digest.new_pipeline_value.toLocaleString()} pipeline · top channel=${digest.top_channel.channel}`
    );
  }
  return digest;
}
