import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.core.config import settings
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.models import User, UserPreference
from app.schemas.auth import (ForgotPasswordIn, LoginIn, PasswordChange, PreferencesIn, PreferencesOut,
                              ProfileUpdate, RegisterIn, ResetPasswordIn, TokenOut, UserOut)
from app.schemas.common import Message

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger(__name__)


def _get_or_create_prefs(db, user: User) -> UserPreference:
    prefs = db.scalar(select(UserPreference).where(UserPreference.user_id == user.id))
    if not prefs:
        prefs = UserPreference(user_id=user.id, preferred_categories=[], preferred_brands=[], preferred_sizes=[],
                               extra={})
        db.add(prefs)
        db.flush()
    return prefs


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DB):
    email = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=email, full_name=body.full_name.strip(), hashed_password=hash_password(body.password),
                role="customer")
    db.add(user)
    db.flush()
    _get_or_create_prefs(db, user)
    db.commit()
    log.info("user registered id=%s", user.id)
    return TokenOut(access_token=create_token(user.id, extra={"role": user.role}), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DB):
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    return TokenOut(access_token=create_token(user.id, extra={"role": user.role}), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.put("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: CurrentUser, db: DB):
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.phone is not None:
        user.phone = body.phone.strip() or None
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/password", response_model=Message)
def change_password(body: PasswordChange, user: CurrentUser, db: DB):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return Message(message="Password updated")


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordIn, db: DB):
    """Issues a short-lived reset token. No email service is configured, so in development the
    reset link is returned in the response; in production it is only logged server-side."""
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    response: dict = {"message": "If that email is registered, a password reset link has been generated."}
    if user:
        token = create_token(user.id, purpose="reset", extra={"pwd": user.hashed_password[-12:]})
        link = f"{settings.FRONTEND_URL}/forgot-password?token={token}"
        log.info("password reset link generated for user id=%s", user.id)
        if not settings.is_production:
            response["dev_reset_link"] = link
    return response


@router.post("/reset-password", response_model=Message)
def reset_password(body: ResetPasswordIn, db: DB):
    payload = decode_token(body.token, "reset")
    user = db.get(User, int(payload["sub"])) if payload else None
    # Token becomes invalid once the password changes (single use).
    if not user or payload.get("pwd") != user.hashed_password[-12:]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reset link is invalid or has expired")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return Message(message="Password has been reset. You can now sign in.")


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(user: CurrentUser, db: DB):
    prefs = _get_or_create_prefs(db, user)
    db.commit()
    return prefs


@router.put("/preferences", response_model=PreferencesOut)
def update_preferences(body: PreferencesIn, user: CurrentUser, db: DB):
    if body.min_price is not None and body.max_price is not None and body.min_price > body.max_price:
        raise HTTPException(422, "Minimum price cannot exceed maximum price")
    prefs = _get_or_create_prefs(db, user)
    for field, value in body.model_dump().items():
        setattr(prefs, field, value)
    prefs.onboarding_completed = True
    db.commit()
    db.refresh(prefs)
    return prefs
