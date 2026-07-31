"""Referral code generator — 8-char human-readable codes."""
import secrets
import string

from deps import leads_collection

_ALPHABET = string.ascii_uppercase + string.digits
_BANNED = {"0", "O", "1", "I"}
_USABLE = "".join(ch for ch in _ALPHABET if ch not in _BANNED)
REFERRAL_CODE_LEN = 8


def generate_referral_code() -> str:
    return "".join(secrets.choice(_USABLE) for _ in range(REFERRAL_CODE_LEN))


async def new_unique_referral_code(max_attempts: int = 8) -> str:
    for _ in range(max_attempts):
        code = generate_referral_code()
        if not await leads_collection.find_one({"referral_code": code}, {"_id": 1}):
            return code
    return generate_referral_code()
