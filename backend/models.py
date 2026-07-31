"""All Pydantic request/response models for AussieBack."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
from typing import List, Optional, Literal
import phonenumbers

VisaType = Literal["working_holiday", "other_temp"]
LeadStatus = Literal["new_estimate", "contacted", "documents_received", "submitted_to_ato", "refund_paid"]
ShareChannel = Literal["download", "native", "copy", "story_download"]


class EstimateRequest(BaseModel):
    visa_type: VisaType
    input_mode: Literal["balance", "earnings"]
    super_balance: Optional[float] = None
    gross_earnings: Optional[float] = None


class LeadCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    visa_type: VisaType
    input_mode: Literal["balance", "earnings"]
    super_balance: Optional[float] = None
    gross_earnings: Optional[float] = None
    estimated_refund: float
    first_name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    whatsapp_number: str = Field(..., min_length=4, max_length=40)
    super_fund_name: Optional[str] = None
    date_left_australia: Optional[str] = None
    referred_by_code: Optional[str] = Field(default=None, max_length=32)
    utm_source: Optional[str] = Field(default=None, max_length=80)
    utm_medium: Optional[str] = Field(default=None, max_length=80)
    utm_campaign: Optional[str] = Field(default=None, max_length=120)

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp_e164(cls, v: str) -> str:
        v = (v or "").strip()
        try:
            parsed = phonenumbers.parse(v, None)
        except phonenumbers.NumberParseException as e:
            raise ValueError("WhatsApp number must be in international E.164 format (e.g. +44 7700 900123)") from e
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError("WhatsApp number is not a valid international phone number")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    visa_type: str
    input_mode: str
    super_balance: Optional[float] = None
    gross_earnings: Optional[float] = None
    estimated_refund: float
    first_name: str
    email: str
    whatsapp_number: str
    super_fund_name: Optional[str] = None
    date_left_australia: Optional[str] = None
    status: LeadStatus
    created_at: str
    updated_at: str
    referral_code: Optional[str] = None
    referred_by_code: Optional[str] = None
    referred_by_lead_id: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResp(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_email: str


class StatusUpdate(BaseModel):
    status: LeadStatus


class ShareEventCreate(BaseModel):
    channel: ShareChannel
    referral_code: Optional[str] = Field(default=None, max_length=32)
    lead_id: Optional[str] = Field(default=None, max_length=64)
    aspect: Optional[Literal["feed", "story"]] = None


class BlogPostSummary(BaseModel):
    slug: str
    title: str
    meta_description: str
    excerpt: str
    category: str
    tags: List[str] = Field(default_factory=list)
    hero_image: Optional[str] = None
    author: str
    reading_time_minutes: int
    published_at: str


class BlogPost(BlogPostSummary):
    content: str
    keywords: List[str] = Field(default_factory=list)


class CommentCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    author_name: str = Field(..., min_length=1, max_length=80)
    author_email: EmailStr
    body: str = Field(..., min_length=2, max_length=4000)
    parent_id: Optional[str] = None


class BlogPostDraftRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=200)
    keywords: List[str] = Field(default_factory=list)
    category: Optional[str] = None


class BlogPostUpsert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    slug: str = Field(..., min_length=3, max_length=140)
    title: str = Field(..., min_length=3, max_length=200)
    meta_description: str = Field(..., min_length=10, max_length=320)
    excerpt: str = Field(..., min_length=10, max_length=600)
    category: str = Field(..., min_length=2, max_length=60)
    tags: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    hero_image: Optional[str] = None
    author: str = "AussieBack Team"
    reading_time_minutes: int = 4
    content: str = Field(..., min_length=50)


class SiteSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    site_url: Optional[str] = Field(default=None, max_length=200)
    google_site_verification: Optional[str] = Field(default=None, max_length=200)


class AutopilotItemCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    topic: str = Field(..., min_length=3, max_length=200)
    keywords: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    hero_image: Optional[str] = None


class AutopilotConfigUpdate(BaseModel):
    enabled: bool
