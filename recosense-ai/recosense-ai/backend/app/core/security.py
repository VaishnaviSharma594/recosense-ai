"""Password hashing (bcrypt) and JWT helpers."""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes; truncate explicitly to avoid errors.
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode())
    except ValueError:
        return False


def create_token(subject: str | int, purpose: str = "access", minutes: int | None = None,
                 extra: dict[str, Any] | None = None) -> str:
    expire_minutes = minutes or (
        settings.ACCESS_TOKEN_EXPIRE_MINUTES if purpose == "access" else settings.RESET_TOKEN_EXPIRE_MINUTES
    )
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "purpose": purpose,
        "iat": now,
        "exp": now + timedelta(minutes=expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, purpose: str = "access") -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != purpose:
        return None
    return payload
