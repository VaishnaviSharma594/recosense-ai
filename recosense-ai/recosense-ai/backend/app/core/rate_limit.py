"""Small in-memory sliding-window rate limiter (per client IP + route group).

Good enough for a single-instance deployment; swap for Redis-backed limiting when scaling out.
"""
import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def _limit_for(self, path: str) -> tuple[str, int] | None:
        if path.startswith("/api/auth/login") or path.startswith("/api/auth/register") \
                or path.startswith("/api/auth/forgot-password"):
            return "auth", settings.AUTH_RATE_LIMIT_PER_MINUTE
        if path.startswith("/api/"):
            return "api", settings.RATE_LIMIT_PER_MINUTE
        return None

    async def dispatch(self, request: Request, call_next):
        if settings.ENV == "test":
            return await call_next(request)
        rule = self._limit_for(request.url.path)
        if rule:
            group, limit = rule
            ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
                request.client.host if request.client else "unknown")
            key = f"{group}:{ip}"
            now = time.monotonic()
            q = self.hits[key]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= limit:
                return JSONResponse({"detail": "Too many requests. Please slow down."}, status_code=429,
                                    headers={"Retry-After": "60"})
            q.append(now)
        return await call_next(request)
