from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.database.session import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


def _user_from_token(db: Session, creds: HTTPAuthorizationCredentials | None) -> User | None:
    if not creds:
        return None
    payload = decode_token(creds.credentials, "access")
    if not payload:
        return None
    try:
        user = db.get(User, int(payload["sub"]))
    except (KeyError, ValueError):
        return None
    if not user or not user.is_active:
        return None
    return user


def get_current_user(db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User:
    user = _user_from_token(db, creds)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


def get_optional_user(db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User | None:
    return _user_from_token(db, creds)


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator access required")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
AdminUser = Annotated[User, Depends(require_admin)]


def paginate_params(page: int = 1, page_size: int = 20) -> tuple[int, int]:
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    return page, page_size
