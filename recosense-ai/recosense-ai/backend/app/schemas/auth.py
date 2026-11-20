from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel


def _strong(v: str) -> str:
    if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one letter and one number")
    return v


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    _pw = field_validator("password")(_strong)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(ORMModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    is_demo: bool
    phone: str | None = None
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=30, pattern=r"^[0-9+\-\s()]*$")


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)

    _pw = field_validator("new_password")(_strong)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=72)

    _pw = field_validator("new_password")(_strong)


class PreferencesIn(BaseModel):
    preferred_categories: list[str] = Field(default_factory=list, max_length=10)
    preferred_brands: list[str] = Field(default_factory=list, max_length=20)
    preferred_sizes: list[str] = Field(default_factory=list, max_length=10)
    min_price: float | None = Field(default=None, ge=0)
    max_price: float | None = Field(default=None, ge=0)
    email_notifications: bool = True
    theme: str = Field(default="system", pattern="^(light|dark|system)$")


class PreferencesOut(ORMModel):
    preferred_categories: list[str]
    preferred_brands: list[str]
    preferred_sizes: list[str]
    min_price: float | None
    max_price: float | None
    onboarding_completed: bool
    email_notifications: bool
    theme: str
