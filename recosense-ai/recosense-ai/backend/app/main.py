import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import admin, assistant, auth, commerce, products, recommendations, reviews
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.database.session import SessionLocal
from app.ml.sentiment.predictor import predictor

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("recosense")

@asynccontextmanager
async def lifespan(_: FastAPI):
    if predictor.is_ready():
        predictor.load()
        log.info("sentiment model loaded (%s v%s)", predictor.model_name, predictor.version)
    else:
        log.warning("sentiment model not trained — run `python -m app.ml.sentiment.train`")
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.APP_NAME,
    version="1.0.0",
    description="RecoSense AI — AI-powered fashion e-commerce: sentiment analysis, hybrid recommendations, "
                "retrieval-based shopping assistant and analytics.",
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def access_log(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        log.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code,
                 (time.perf_counter() - start) * 1000)
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
    first = errors[0] if errors else {"field": "", "message": "Invalid request"}
    detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
    return JSONResponse(status_code=422, content={"detail": detail, "errors": errors})


@app.exception_handler(SQLAlchemyError)
async def db_error_handler(_: Request, exc: SQLAlchemyError):
    log.exception("database error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "A database error occurred"})


for r in (auth, products, reviews, commerce, recommendations, assistant, admin):
    app.include_router(r.router)


@app.get("/api/health", tags=["health"])
def health():
    db_ok = True
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": db_ok, "sentiment_model": predictor.is_ready()}


@app.get("/", include_in_schema=False)
def root():
    return {"name": settings.APP_NAME, "docs": "/docs", "health": "/api/health"}
