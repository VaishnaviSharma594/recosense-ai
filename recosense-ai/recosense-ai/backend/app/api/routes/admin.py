import json
import math
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import case, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, AdminUser
from app.core.config import settings
from app.ml.recommendation.engine import COMPONENTS, default_weights, engine, save_weights
from app.ml.sentiment.train import META_FILE
from app.models import (Category, ModelMetric, Order, Product, Recommendation, Review, Sentiment, User,
                        UserInteraction)
from app.repositories.products import get_products_by_ids
from app.schemas.auth import UserOut
from app.schemas.common import Message, Page
from app.schemas.product import ProductCard
from app.schemas.review import ReviewOut
from app.services.dataset_import import DatasetValidationError, import_reviews, read_csv_bytes
from app.services.jobs import JOBS, start_job
from app.services.sentiment_service import aspect_stats, recompute_product_stats, sentiment_trend, top_aspects

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _pct(part: int, total: int) -> float:
    return round(100 * part / total, 1) if total else 0.0


@router.get("/dashboard")
def dashboard(db: DB, _: AdminUser):
    users_total = db.scalar(select(func.count()).select_from(User)) or 0
    users_real = db.scalar(select(func.count()).select_from(User).where(User.is_demo.is_(False))) or 0
    products = db.scalar(select(func.count()).select_from(Product)) or 0
    reviews = db.scalar(select(func.count()).select_from(Review).where(Review.is_hidden.is_(False))) or 0
    orders = db.scalar(select(func.count()).select_from(Order)) or 0
    revenue = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(Order.status != "cancelled")) or 0
    avg_rating = db.scalar(select(func.avg(Review.rating)).where(Review.is_hidden.is_(False)))
    dist = dict(db.execute(select(Sentiment.label, func.count()).join(Review).where(Review.is_hidden.is_(False))
                           .group_by(Sentiment.label)).all())
    analysed = sum(dist.values())
    most_rec = db.execute(select(Recommendation.product_id, func.count().label("n")).group_by(Recommendation.product_id)
                          .order_by(desc("n")).limit(5)).all()
    rec_products = {p.id: p for p in get_products_by_ids(db, [r[0] for r in most_rec])}
    top_cats = db.execute(
        select(Category.name, func.count(UserInteraction.id).label("interactions"),
               func.sum(case((UserInteraction.interaction_type == "purchase", 1), else_=0)).label("purchases"))
        .join(Product, Product.category_id == Category.id).join(UserInteraction, UserInteraction.product_id == Product.id)
        .group_by(Category.name).order_by(desc("interactions"))).all()
    recent_orders = db.scalars(select(Order).order_by(Order.created_at.desc()).limit(5)).all()
    return {
        "totals": {"users": users_total, "real_users": users_real, "demo_users": users_total - users_real,
                   "products": products, "reviews": reviews, "orders": orders, "revenue": float(revenue),
                   "average_rating": round(float(avg_rating), 2) if avg_rating else None,
                   "analysed_reviews": analysed},
        "sentiment": {k: _pct(dist.get(k, 0), analysed) for k in ("positive", "neutral", "negative")},
        "most_recommended": [{"product": ProductCard.model_validate(rec_products[pid]).model_dump(), "count": n}
                             for pid, n in most_rec if pid in rec_products],
        "top_categories": [{"category": c, "interactions": i, "purchases": int(p or 0)} for c, i, p in top_cats],
        "recent_orders": [{"id": o.id, "order_number": o.order_number, "total": float(o.total), "status": o.status,
                           "created_at": o.created_at.isoformat()} for o in recent_orders],
        "data_notice": "Users flagged as demo and their interactions are synthetic sample data. Reviews come from the "
                       "Kaggle Women's E-Commerce Clothing Reviews dataset plus any customer-submitted reviews.",
    }


@router.get("/analytics")
def analytics(db: DB, _: AdminUser, days: int = Query(90, ge=7, le=365)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.to_char(func.date_trunc("day", UserInteraction.created_at), "YYYY-MM-DD")
    interactions = db.execute(select(day.label("d"), UserInteraction.interaction_type, func.count())
                              .where(UserInteraction.created_at >= since)
                              .group_by("d", UserInteraction.interaction_type).order_by("d")).all()
    by_day: dict[str, dict] = {}
    for d, kind, n in interactions:
        by_day.setdefault(d, {"date": d})[kind] = n
    rday = func.to_char(func.date_trunc("day", Recommendation.created_at), "YYYY-MM-DD")
    rec_activity = db.execute(select(rday.label("d"), func.count(), func.count(func.distinct(Recommendation.user_id)))
                              .where(Recommendation.created_at >= since).group_by("d").order_by("d")).all()
    month = func.to_char(func.date_trunc("month", Review.created_at), "YYYY-MM")
    volume = db.execute(select(month.label("m"), func.count(), func.avg(Review.rating))
                        .where(Review.is_hidden.is_(False)).group_by("m").order_by("m")).all()
    cat_pop = db.execute(
        select(Category.name, UserInteraction.interaction_type, func.count())
        .join(Product, Product.category_id == Category.id).join(UserInteraction, UserInteraction.product_id == Product.id)
        .group_by(Category.name, UserInteraction.interaction_type)).all()
    cats: dict[str, dict] = {}
    for c, kind, n in cat_pop:
        cats.setdefault(c, {"category": c})[kind] = n
    top_products = db.scalars(select(Product).options(selectinload(Product.category), selectinload(Product.images))
                              .order_by(Product.popularity.desc()).limit(10)).all()
    global_aspects = aspect_stats(db).get(None, [])
    return {
        "sentiment_trend": sentiment_trend(db),
        "review_volume": [{"period": m, "reviews": n, "avg_rating": round(float(r or 0), 2)} for m, n, r in volume],
        "category_popularity": list(cats.values()),
        "product_performance": [{"id": p.id, "name": p.name, "category": p.category.name, "popularity": p.popularity,
                                 "rating": p.rating_avg, "reviews": p.review_count, "positive_pct": p.positive_pct,
                                 "negative_pct": p.negative_pct} for p in top_products],
        "recommendation_activity": [{"date": d, "recommendations": n, "users": u} for d, n, u in rec_activity],
        "customer_interactions": list(by_day.values()),
        "aspects": [{k: r[k] for k in ("aspect", "positive", "negative", "neutral", "total", "positive_pct")}
                    for r in global_aspects],
        "most_appreciated": top_aspects(global_aspects, "positive", n=4),
        "most_complained": top_aspects(global_aspects, "negative", n=4),
    }


@router.get("/sentiment-report")
def sentiment_report(db: DB, _: AdminUser):
    products = db.scalars(select(Product).options(selectinload(Product.category))
                          .where(Product.review_count > 0).order_by(Product.negative_pct.desc())).all()
    stats = aspect_stats(db, [p.id for p in products])
    return [{"id": p.id, "name": p.name, "category": p.category.name, "reviews": p.review_count,
             "rating": p.rating_avg, "positive_pct": p.positive_pct, "neutral_pct": p.neutral_pct,
             "negative_pct": p.negative_pct, "sentiment_score": p.sentiment_score,
             "top_praise": top_aspects(stats.get(p.id, []), "positive", n=2),
             "top_complaints": top_aspects(stats.get(p.id, []), "negative", n=2)} for p in products]


# ---------------- users ----------------
class UserAdminUpdate(BaseModel):
    is_active: bool | None = None
    role: str | None = Field(default=None, pattern="^(customer|admin)$")


@router.get("/users", response_model=Page[UserOut])
def list_users(db: DB, _: AdminUser, q: str | None = None, page: int = Query(1, ge=1),
               page_size: int = Query(20, ge=1, le=100), include_demo: bool = True):
    stmt = select(User)
    if q:
        stmt = stmt.where(or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")))
    if not include_demo:
        stmt = stmt.where(User.is_demo.is_(False))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(User.created_at.desc(), User.id.desc())
                       .offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=items, total=total, page=page, page_size=page_size, pages=max(1, math.ceil(total / page_size)))


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserAdminUpdate, db: DB, admin: AdminUser):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if u.id == admin.id and (body.is_active is False or body.role == "customer"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate or demote your own account")
    if body.is_active is not None:
        u.is_active = body.is_active
    if body.role:
        u.role = body.role
    db.commit()
    return u


# ---------------- reviews ----------------
class AdminReviewOut(ReviewOut):
    product_name: str | None = None
    is_hidden: bool = False


@router.get("/reviews", response_model=Page[AdminReviewOut])
def admin_reviews(db: DB, _: AdminUser, q: str | None = None, product_id: int | None = None,
                  sentiment: str | None = Query(None, pattern="^(positive|neutral|negative|mixed)$"),
                  source: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    stmt = select(Review)
    if q:
        stmt = stmt.where(or_(Review.body.ilike(f"%{q}%"), Review.title.ilike(f"%{q}%")))
    if product_id:
        stmt = stmt.where(Review.product_id == product_id)
    if source:
        stmt = stmt.where(Review.source == source)
    if sentiment == "mixed":
        stmt = stmt.where(Review.sentiment.has(Sentiment.is_mixed.is_(True)))
    elif sentiment:
        stmt = stmt.where(Review.sentiment.has(Sentiment.label == sentiment))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.options(selectinload(Review.sentiment), selectinload(Review.aspects))
                      .order_by(Review.created_at.desc(), Review.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).all()
    names = dict(db.execute(select(Product.id, Product.name).where(Product.id.in_({r.product_id for r in rows}))).all())
    items = [AdminReviewOut.model_validate(r).model_copy(update={"product_name": names.get(r.product_id),
                                                                  "is_hidden": r.is_hidden}) for r in rows]
    return Page(items=items, total=total, page=page, page_size=page_size, pages=max(1, math.ceil(total / page_size)))


class ReviewModeration(BaseModel):
    is_hidden: bool


@router.patch("/reviews/{review_id}", response_model=Message)
def moderate_review(review_id: int, body: ReviewModeration, db: DB, _: AdminUser):
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    r.is_hidden = body.is_hidden
    db.flush()
    recompute_product_stats(db, [r.product_id])
    db.commit()
    return Message(message="Review hidden" if body.is_hidden else "Review restored")


@router.delete("/reviews/{review_id}", response_model=Message)
def delete_review(review_id: int, db: DB, _: AdminUser):
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    pid = r.product_id
    db.delete(r)
    db.flush()
    recompute_product_stats(db, [pid])
    db.commit()
    return Message(message="Review deleted")


# ---------------- datasets & models ----------------
@router.post("/dataset/upload")
async def upload_dataset(_: AdminUser, db: DB, file: UploadFile = File(...)):
    name = (file.filename or "").lower()
    if not name.endswith(".csv"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only .csv files are accepted")
    if file.content_type not in ("text/csv", "application/vnd.ms-excel", "application/octet-stream",
                                 "application/csv", "text/plain"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Unexpected content type {file.content_type}")
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds {settings.MAX_UPLOAD_MB} MB")
    if b"\x00" in data[:4096]:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "File does not look like a text CSV")
    try:
        df = read_csv_bytes(data)
        report = import_reviews(db, df, source="upload")
        db.commit()
    except DatasetValidationError as e:
        db.rollback()
        raise HTTPException(422, str(e))
    return {"filename": file.filename, **report}


class TrainIn(BaseModel):
    target: str = Field(default="all", pattern="^(sentiment|recommendation|all)$")
    reanalyze: bool = True
    quick: bool = True


@router.post("/models/train", status_code=status.HTTP_202_ACCEPTED)
def train_models(body: TrainIn, _: AdminUser):
    if any(j["status"] in ("queued", "running") for j in JOBS.values()):
        raise HTTPException(status.HTTP_409_CONFLICT, "A training job is already running")
    return start_job(body.target, body.reanalyze, body.quick)


@router.get("/models/jobs")
def list_jobs(_: AdminUser):
    return sorted(JOBS.values(), key=lambda j: j["started_at"], reverse=True)[:10]


@router.get("/models/jobs/{job_id}")
def job_status(job_id: str, _: AdminUser):
    if job_id not in JOBS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return JOBS[job_id]


@router.get("/model-metrics")
def model_metrics(db: DB, _: AdminUser):
    def latest(model_type: str) -> list[ModelMetric]:
        last = db.scalar(select(func.max(ModelMetric.trained_at)).where(ModelMetric.model_type == model_type))
        if not last:
            return []
        return list(db.scalars(select(ModelMetric).where(ModelMetric.model_type == model_type,
                                                         ModelMetric.trained_at >= last - timedelta(seconds=5))
                               .order_by(ModelMetric.id)))

    def ser(m: ModelMetric) -> dict:
        return {"id": m.id, "model_name": m.model_name, "model_version": m.model_version, "status": m.status,
                "metrics": m.metrics, "dataset_size": m.dataset_size, "latency_ms": m.latency_ms,
                "is_active": m.is_active, "notes": m.notes, "trained_at": m.trained_at.isoformat()}

    meta_path = settings.MODEL_DIR / META_FILE
    sentiment = [ser(m) for m in latest("sentiment")]
    sentiment.append({"model_name": "DistilBERT (Hugging Face)", "status": "not_trained", "metrics": {},
                      "notes": "Optional transformer model — not trained in this build. Logistic Regression is the "
                               "production model.", "is_active": False})
    recommendation = [ser(m) for m in latest("recommendation")]
    history = [{"model_type": m.model_type, "model_name": m.model_name, "trained_at": m.trained_at.isoformat(),
                "status": m.status, "is_active": m.is_active}
               for m in db.scalars(select(ModelMetric).order_by(ModelMetric.trained_at.desc()).limit(20))]
    return {"sentiment": sentiment, "sentiment_status": "trained" if meta_path.exists() else "pending",
            "dataset": json.loads(meta_path.read_text())["dataset"] if meta_path.exists() else None,
            "recommendation": recommendation,
            "recommendation_status": "evaluated" if recommendation else "pending", "history": history}


# ---------------- recommendation configuration ----------------
class WeightsIn(BaseModel):
    content: float = Field(ge=0, le=1)
    collaborative: float = Field(ge=0, le=1)
    sentiment: float = Field(ge=0, le=1)
    rating: float = Field(ge=0, le=1)


@router.get("/recommendations")
def recommendation_overview(db: DB, _: AdminUser, user_id: int | None = None):
    total = db.scalar(select(func.count()).select_from(Recommendation)) or 0
    users = db.scalar(select(func.count(func.distinct(Recommendation.user_id)))) or 0
    algos = dict(db.execute(select(Recommendation.algorithm, func.count()).group_by(Recommendation.algorithm)).all())
    preview = None
    if user_id:
        u = db.get(User, user_id)
        if not u:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        scored = engine.recommend(db, user_id, k=8)
        prods = {p.id: p for p in get_products_by_ids(db, [s.product_id for s in scored])}
        preview = {"user": {"id": u.id, "email": u.email, "full_name": u.full_name},
                   "items": [{"product": ProductCard.model_validate(prods[s.product_id]).model_dump(), "score": s.score,
                              "components": s.components, "reasons": s.reasons, "algorithm": s.algorithm}
                             for s in scored if s.product_id in prods]}
    state = engine.state
    return {"weights": default_weights(), "components": list(COMPONENTS), "total_generated": total,
            "users_served": users, "by_algorithm": algos, "preview": preview,
            "engine": {"built_at": datetime.fromtimestamp(state.built_at, timezone.utc).isoformat() if state else None,
                       "products": len(state.products) if state else 0, "users": len(state.user_ids) if state else 0}}


@router.put("/recommendations/config")
def update_weights(body: WeightsIn, _: AdminUser):
    if sum(body.model_dump().values()) <= 0:
        raise HTTPException(422, "At least one weight must be positive")
    return {"weights": save_weights(body.model_dump())}


@router.post("/recommendations/rebuild")
def rebuild(db: DB, _: AdminUser):
    state = engine.rebuild(db)
    return {"message": "Recommendation models rebuilt", "products": len(state.products), "users": len(state.user_ids)}
