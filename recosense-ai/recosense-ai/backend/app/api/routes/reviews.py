import math

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser
from app.ml.sentiment.predictor import ModelNotTrainedError, predictor
from app.models import Product, Review, Sentiment
from app.schemas.common import Page
from app.schemas.review import AnalyzeIn, AnalyzeOut, AspectOut, ProductSentimentOut, ReviewIn, ReviewOut
from app.services.interactions import record_interaction
from app.services.sentiment_service import (aspect_stats, recompute_product_stats, sentiment_trend, store_analysis,
                                            top_aspects)
from app.utils.text import content_hash

router = APIRouter(prefix="/api", tags=["reviews & sentiment"])


def _require_product(db, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return p


@router.get("/products/{product_id}/reviews", response_model=Page[ReviewOut])
def list_reviews(product_id: int, db: DB, page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=50),
                 sentiment: str | None = Query(None, pattern="^(positive|neutral|negative|mixed)$"),
                 sort: str = Query("newest", pattern="^(newest|helpful|rating_high|rating_low)$")):
    _require_product(db, product_id)
    q = select(Review).where(Review.product_id == product_id, Review.is_hidden.is_(False))
    if sentiment == "mixed":
        q = q.where(Review.sentiment.has(Sentiment.is_mixed.is_(True)))
    elif sentiment:
        q = q.where(Review.sentiment.has(Sentiment.label == sentiment))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    order = {"newest": Review.created_at.desc(), "helpful": Review.helpful_count.desc(),
             "rating_high": Review.rating.desc(), "rating_low": Review.rating.asc()}[sort]
    items = db.scalars(q.options(selectinload(Review.sentiment), selectinload(Review.aspects))
                       .order_by(order, Review.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=items, total=total, page=page, page_size=page_size, pages=max(1, math.ceil(total / page_size)))


@router.get("/reviews/featured")
def featured_reviews(db: DB, limit: int = Query(6, ge=1, le=12)):
    """Highly rated, helpful, concise real reviews (used as homepage testimonials)."""
    rows = db.execute(
        select(Review, Product.name).join(Product, Product.id == Review.product_id)
        .join(Sentiment, Sentiment.review_id == Review.id)
        .where(Review.is_hidden.is_(False), Review.rating == 5, Sentiment.label == "positive",
               Sentiment.is_mixed.is_(False), func.length(Review.body).between(80, 260))
        .order_by(Review.helpful_count.desc(), Review.id).limit(limit)).all()
    return [{"id": r.id, "title": r.title, "body": r.body, "rating": r.rating, "product_id": r.product_id,
             "product_name": name, "source": r.source, "reviewer_name": r.reviewer_name,
             "reviewer_age": r.reviewer_age} for r, name in rows]


@router.post("/products/{product_id}/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(product_id: int, body: ReviewIn, user: CurrentUser, db: DB):
    _require_product(db, product_id)
    if not predictor.is_ready():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Sentiment model is not trained yet")
    review = Review(product_id=product_id, user_id=user.id, title=body.title, body=body.body.strip(),
                    rating=body.rating, source="customer", reviewer_name=user.full_name,
                    content_hash=content_hash(product_id, body.title, body.body))
    db.add(review)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already reviewed this product")
    analysis, _ = predictor.analyze(f"{body.title}. {body.body}" if body.title else body.body)
    store_analysis(db, review, analysis)
    record_interaction(db, user.id, product_id, "rating", value=body.rating)
    db.flush()
    recompute_product_stats(db, [product_id])
    db.commit()
    return db.scalar(select(Review).options(selectinload(Review.sentiment), selectinload(Review.aspects))
                     .where(Review.id == review.id))


@router.post("/sentiment/analyze", response_model=AnalyzeOut)
def analyze(body: AnalyzeIn):
    try:
        a, ms = predictor.analyze(body.text)
    except ModelNotTrainedError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))
    return AnalyzeOut(text=body.text, label=a.label, overall=a.overall, confidence=a.confidence, score=a.score,
                      probabilities=a.probs, positive_aspects=a.positive_aspects,
                      negative_aspects=a.negative_aspects,
                      aspects=[AspectOut(aspect=x.label, sentiment=x.sentiment, score=x.score, snippet=x.snippet)
                               for x in a.aspects],
                      model_name=predictor.model_name, model_version=predictor.version, latency_ms=ms)


@router.get("/products/{product_id}/sentiment", response_model=ProductSentimentOut)
def product_sentiment(product_id: int, db: DB):
    p = _require_product(db, product_id)
    dist = dict(db.execute(select(Sentiment.label, func.count()).join(Review)
                           .where(Review.product_id == product_id, Review.is_hidden.is_(False))
                           .group_by(Sentiment.label)).all())
    mixed = db.scalar(select(func.count()).select_from(Sentiment).join(Review)
                      .where(Review.product_id == product_id, Sentiment.is_mixed.is_(True))) or 0
    rows = aspect_stats(db, [product_id]).get(product_id, [])
    return ProductSentimentOut(
        product_id=p.id, review_count=p.review_count, analysed_count=sum(dist.values()),
        positive_pct=p.positive_pct, neutral_pct=p.neutral_pct, negative_pct=p.negative_pct, mixed_count=mixed,
        sentiment_score=p.sentiment_score, rating_avg=p.rating_avg,
        distribution={k: int(dist.get(k, 0)) for k in ("positive", "neutral", "negative")},
        aspects=[{k: r[k] for k in ("aspect", "positive", "negative", "neutral", "total", "positive_pct")}
                 for r in rows],
        top_positive_aspects=top_aspects(rows, "positive"), top_negative_aspects=top_aspects(rows, "negative"),
        trend=sentiment_trend(db, product_id))
