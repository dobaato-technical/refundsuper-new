// Referral code generator — 8-char human-readable codes.
// Line-for-line port of backend/services/referrals.py (same alphabet, same
// banned-character set, same retry count).
import crypto from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

const _ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const _BANNED = new Set(["0", "O", "1", "I"]);
const _USABLE = _ALPHABET.split("").filter((ch) => !_BANNED.has(ch)).join("");
export const REFERRAL_CODE_LEN = 8;

export function generateReferralCode() {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LEN; i++) {
    code += _USABLE[crypto.randomInt(0, _USABLE.length)];
  }
  return code;
}

export async function newUniqueReferralCode(maxAttempts = 8) {
  const supabase = getSupabaseAdmin();
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateReferralCode();
    const { data } = await supabase.from("leads").select("id").eq("referral_code", code).maybeSingle();
    if (!data) return code;
  }
  return generateReferralCode();
}
