"""DASP refund calculator."""
from typing import Optional

SUPER_RATE = 0.12
TAX_RATES = {
    "working_holiday": 0.65,  # 65% tax => keep 35%
    "other_temp": 0.35,        # 35% tax => keep 65%
}


def compute_refund(visa_type: str, input_mode: str, super_balance: Optional[float], gross_earnings: Optional[float]) -> dict:
    if input_mode == "balance":
        balance = float(super_balance or 0)
    else:
        balance = float(gross_earnings or 0) * SUPER_RATE
    tax_rate = TAX_RATES.get(visa_type, 0.5)
    refund = balance * (1 - tax_rate)
    return {
        "balance": round(balance, 2),
        "tax_rate": tax_rate,
        "estimated_refund": round(refund, 2),
    }
