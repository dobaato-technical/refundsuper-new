// DASP refund calculator — line-for-line port of backend/services/calculator.py.

export const SUPER_RATE = 0.12;
export const TAX_RATES = {
  working_holiday: 0.65, // 65% tax => keep 35%
  other_temp: 0.35, // 35% tax => keep 65%
};

export function computeRefund(visaType, inputMode, superBalance, grossEarnings) {
  let balance;
  if (inputMode === "balance") {
    balance = Number(superBalance || 0);
  } else {
    balance = Number(grossEarnings || 0) * SUPER_RATE;
  }
  const taxRate = Object.prototype.hasOwnProperty.call(TAX_RATES, visaType) ? TAX_RATES[visaType] : 0.5;
  const refund = balance * (1 - taxRate);
  return {
    balance: Math.round(balance * 100) / 100,
    tax_rate: taxRate,
    estimated_refund: Math.round(refund * 100) / 100,
  };
}
