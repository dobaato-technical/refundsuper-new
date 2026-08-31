// Durable webhook outbox with exponential-backoff retries.
// Port of backend/services/outbox.py.
//
// Design (unchanged from the Python version):
//   - Every outbound event is inserted into `webhook_outbox` with status="pending".
//   - `processOutbox` polls for pending rows whose next_attempt_at <= now,
//     POSTs them, and updates the row. Triggered manually via the admin UI's
//     "Flush now" button / process-now route (cron scheduling is deferred).
//   - Retries use exponential backoff up to MAX_ATTEMPTS. On the final
//     failure the row is marked status="dead".
//   - Success rows are kept for observability (visible in /admin/outbox).
import crypto from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

export const MAX_ATTEMPTS = 8;
// Delays (in minutes) per attempt index 1..MAX_ATTEMPTS. Attempt 1 fires
// immediately; delays[i] is the wait BEFORE attempt i+1. Kept byte-for-byte
// identical to the Python BACKOFF_MINUTES array.
export const BACKOFF_MINUTES = [0, 2, 4, 8, 16, 30, 30, 30];

function nowIso() {
  return new Date().toISOString();
}

function sign(bodyStr) {
  const secret = process.env.WEBHOOK_SECRET || "";
  if (!secret) return null;
  const digest = crypto.createHmac("sha256", secret).update(bodyStr, "utf8").digest("hex");
  return `sha256=${digest}`;
}

/**
 * Insert an event into the outbox. Returns the outbox row id, or null if
 * webhooks are disabled globally (WEBHOOK_URL unset).
 */
export async function enqueue(event, data, { previous } = {}) {
  const url = process.env.WEBHOOK_URL;
  if (!url) {
    console.log(`[OUTBOX] webhook disabled — dropping event=${event}`);
    return null;
  }
  const envelope = {
    event,
    id: crypto.randomUUID(),
    occurred_at: nowIso(),
    data,
  };
  if (previous !== undefined) envelope.previous = previous;
  const body = JSON.stringify(envelope);
  const supabase = getSupabaseAdmin();
  const row = {
    event,
    url,
    body,
    signature: sign(body),
    status: "pending",
    attempts: 0,
    last_error: null,
    next_attempt_at: nowIso(),
  };
  const { data: inserted, error } = await supabase.from("webhook_outbox").insert(row).select("id").single();
  if (error) {
    console.error("[OUTBOX] enqueue failed:", error);
    return null;
  }
  console.log(`[OUTBOX] enqueued id=${inserted.id} event=${event}`);
  return inserted.id;
}

/** Blocking-equivalent HTTP POST — headers/behaviour must match the CRM contract exactly. */
async function postOnce(url, body, signature, event) {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "AussieBack-Webhook/1.1",
    "X-AussieBack-Event": event,
  };
  if (signature) headers["X-AussieBack-Signature"] = signature;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    });
    const ok = resp.status >= 200 && resp.status < 300;
    let detail = `status=${resp.status}`;
    if (!ok) {
      const text = (await resp.text().catch(() => "")).slice(0, 200).replace(/\n/g, " ");
      detail = `status=${resp.status} body=${text}`;
    }
    return [ok, detail];
  } catch (e) {
    return [false, `network:${e.name || "Error"}:${String(e.message || e).slice(0, 180)}`];
  }
}

async function attemptOnce(row) {
  const supabase = getSupabaseAdmin();
  const attempts = (row.attempts || 0) + 1;
  const [ok, detail] = await postOnce(row.url, row.body, row.signature, row.event);
  const now = nowIso();
  if (ok) {
    await supabase
      .from("webhook_outbox")
      .update({ status: "success", attempts, last_error: null, delivered_at: now, updated_at: now })
      .eq("id", row.id);
    console.log(`[OUTBOX] delivered id=${row.id} event=${row.event} attempts=${attempts} ${detail}`);
    return true;
  }

  const isDead = attempts >= MAX_ATTEMPTS;
  if (isDead) {
    await supabase
      .from("webhook_outbox")
      .update({ status: "dead", attempts, last_error: detail, updated_at: now })
      .eq("id", row.id);
    console.warn(`[OUTBOX] DEAD id=${row.id} event=${row.event} attempts=${attempts} ${detail}`);
  } else {
    // Attempt-index 1 already fired; delay before attempt-2 is BACKOFF_MINUTES[1] etc.
    const delayMin = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
    const nextAt = new Date(Date.now() + delayMin * 60_000).toISOString();
    await supabase
      .from("webhook_outbox")
      .update({ attempts, last_error: detail, next_attempt_at: nextAt, updated_at: now })
      .eq("id", row.id);
    console.log(
      `[OUTBOX] retry-scheduled id=${row.id} event=${row.event} attempts=${attempts} next_in=${delayMin}m ${detail}`
    );
  }
  return false;
}

/** Poller — process up to `limit` due pending rows. Called by the admin "Flush now" button. */
export async function processOutbox(limit = 25) {
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("webhook_outbox")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", nowIso())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[OUTBOX] process fetch failed:", error);
    return { processed: 0, success: 0, failed: 0 };
  }
  if (!rows || !rows.length) return { processed: 0, success: 0, failed: 0 };
  let success = 0;
  for (const row of rows) {
    try {
      const ok = await attemptOnce(row);
      if (ok) success += 1;
    } catch (e) {
      console.error(`[OUTBOX] unexpected error id=${row.id}:`, e);
    }
  }
  return { processed: rows.length, success, failed: rows.length - success };
}

/**
 * Admin action: reset a `pending` or `dead` row to `pending` and retry
 * immediately. Rows already `status='success'` are protected — retrying a
 * delivered row would re-fire the webhook and duplicate the downstream CRM
 * record.
 */
export async function forceRetry(rowId) {
  const supabase = getSupabaseAdmin();
  const now = nowIso();
  const { data, error } = await supabase
    .from("webhook_outbox")
    .update({ status: "pending", next_attempt_at: now, updated_at: now })
    .eq("id", rowId)
    .in("status", ["pending", "dead"])
    .select("id");
  if (error) {
    console.error("[OUTBOX] force retry failed:", error);
    return false;
  }
  return Boolean(data && data.length);
}
