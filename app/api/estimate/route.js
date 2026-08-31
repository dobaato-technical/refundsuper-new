import { NextResponse } from "next/server";
import { computeRefund } from "@/lib/server/calculator";

export const dynamic = "force-dynamic";

const VISA_TYPES = ["working_holiday", "other_temp"];
const INPUT_MODES = ["balance", "earnings"];

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const { visa_type, input_mode, super_balance, gross_earnings } = body || {};
  if (!VISA_TYPES.includes(visa_type)) {
    return NextResponse.json({ detail: "visa_type must be one of working_holiday, other_temp" }, { status: 422 });
  }
  if (!INPUT_MODES.includes(input_mode)) {
    return NextResponse.json({ detail: "input_mode must be one of balance, earnings" }, { status: 422 });
  }
  const result = computeRefund(visa_type, input_mode, super_balance, gross_earnings);
  return NextResponse.json(result);
}
