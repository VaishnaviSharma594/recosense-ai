from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete

from app.api.deps import DB, CurrentUser
from app.ml.recommendation.engine import Scored, engine
from app.models import Product, Recommendation
from app.repositories.products import base_query, get_products_by_ids
from app.schemas.product import ProductCard

router = APIRouter(prefix="/api", tags=["recommendations"])


class RecommendedProduct(BaseModel):
    product: ProductCard
    score: float
    rank: int
    components: dict[str, float]
    reasons: list[str]
    algorithm: str


class RecommendationsOut(BaseModel):
    user_id: int
    algorithm: str
    cold_start: bool
    generated_at: datetime
    items: list[RecommendedProduct]


def _attach(db, scored: list[Scored]) -> list[RecommendedProduct]:
    products = {p.id: p for p in get_products_by_ids(db, [s.product_id for s in scored])}
    return [RecommendedProduct(product=ProductCard.model_validate(products[s.product_id]), score=s.score, rank=i + 1,
                               components=s.components, reasons=s.reasons, algorithm=s.algorithm)
            for i, s in enumerate(scored) if s.product_id in products]


def generate_for_user(db, user_id: int, k: int, algorithm: str = "hybrid") -> RecommendationsOut:
    scored = engine.recommend(db, user_id, k=k, algorithm=algorithm)
    now = datetime.now(timezone.utc)
    if algorithm == "hybrid":
        # keep a rolling 30-day history (feeds the admin "recommendation activity" chart)
        db.execute(delete(Recommendation).where(Recommendation.user_id == user_id,
                                                Recommendation.created_at < now - timedelta(days=30)))
        for i, s in enumerate(scored):
            db.add(Recommendation(user_id=user_id, product_id=s.product_id, score=s.score, rank=i + 1,
                                  content_score=s.components["content"],
                                  collaborative_score=s.components["collaborative"],
                                  sentiment_score=s.components["sentiment"], rating_score=s.components["rating"],
                                  algorithm=s.algorithm, reasons=s.reasons))
        db.commit()
    cold = bool(scored) and scored[0].algorithm == "cold_start"
    return RecommendationsOut(user_id=user_id, algorithm="cold_start" if cold else algorithm, cold_start=cold,
                              generated_at=now, items=_attach(db, scored))


@router.get("/recommendations/similar/{product_id}", response_model=list[RecommendedProduct])
def similar(product_id: int, db: DB, k: int = Query(8, ge=1, le=24)):
    if not db.get(Product, product_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return _attach(db, engine.similar(db, product_id, k))


@router.get("/recommendations/highlights")
def highlights(db: DB, limit: int = Query(8, ge=1, le=20)):
    """Homepage rails computed from live data."""
    def cards(q):
        return [ProductCard.model_validate(p) for p in db.scalars(q.limit(limit))]
    active = base_query().where(Product.stock > 0)
    return {
        "trending": cards(active.order_by(Product.popularity.desc(), Product.id)),
        "best_rated": cards(active.where(Product.review_count >= 5)
                            .order_by(Product.rating_avg.desc(), Product.review_count.desc())),
        "positive_sentiment": cards(active.where(Product.review_count >= 5)
                                    .order_by(Product.sentiment_score.desc().nulls_last(), Product.id)),
        "new_arrivals": cards(active.order_by(Product.created_at.desc(), Product.id.desc())),
    }


@router.post("/recommendations/refresh", response_model=RecommendationsOut)
def refresh(user: CurrentUser, db: DB, k: int = Query(12, ge=1, le=48)):
    engine.rebuild(db)
    return generate_for_user(db, user.id, k)


@router.get("/recommendations/{user_id}", response_model=RecommendationsOut)
def recommendations(user_id: int, user: CurrentUser, db: DB, k: int = Query(12, ge=1, le=48),
                    algorithm: str = Query("hybrid", pattern="^(hybrid|content|collaborative|sentiment)$")):
    if user.id != user_id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only view your own recommendations")
    return generate_for_user(db, user_id, k, algorithm)


