"""Persist model predictions and compute product-level sentiment aggregates from the database."""
from collections import defaultdict

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.ml.sentiment.aspects import ASPECT_LABELS
from app.ml.sentiment.predictor import Analysis, predictor
from app.models import Product, Review, Sentiment, SentimentAspect

SMOOTHING_K = 3  # pseudo-reviews pulling small samples toward neutral (0.5)


def store_analysis(db: Session, review: Review, a: Analysis) -> None:
    db.execute(delete(SentimentAspect).where(SentimentAspect.review_id == review.id))
    db.execute(delete(Sentiment).where(Sentiment.review_id == review.id))
    db.add(Sentiment(review_id=review.id, label=a.label, is_mixed=a.is_mixed, confidence=a.confidence,
                     score=a.score, prob_positive=a.probs["positive"], prob_neutral=a.probs["neutral"],
                     prob_negative=a.probs["negative"], model_name=predictor.model_name,
                     model_version=predictor.version))
    for asp in a.aspects:
        db.add(SentimentAspect(review_id=review.id, product_id=review.product_id, aspect=asp.aspect,
                               sentiment=asp.sentiment, score=asp.score, snippet=asp.snippet))


def review_text(r: Review) -> str:
    return f"{r.title}. {r.body}" if r.title else r.body


def analyze_reviews(db: Session, reviews: list[Review], batch: int = 500) -> int:
    for start in range(0, len(reviews), batch):
        chunk = reviews[start:start + batch]
        for r, a in zip(chunk, predictor.analyze_many([review_text(r) for r in chunk])):
            store_analysis(db, r, a)
        db.flush()
    return len(reviews)


def recompute_product_stats(db: Session, product_ids: list[int] | None = None) -> None:
    """Refresh cached rating/sentiment columns on products from reviews + stored predictions."""
    q = (select(Review.product_id, func.count(Review.id), func.avg(Review.rating),
                func.count(Sentiment.id),
                func.sum(case((Sentiment.label == "positive", 1), else_=0)),
                func.sum(case((Sentiment.label == "neutral", 1), else_=0)),
                func.sum(case((Sentiment.label == "negative", 1), else_=0)),
                func.sum((Sentiment.score + 1) / 2))
         .outerjoin(Sentiment, Sentiment.review_id == Review.id)
         .where(Review.is_hidden.is_(False))
         .group_by(Review.product_id))
    if product_ids:
        q = q.where(Review.product_id.in_(product_ids))
    stats = {row[0]: row for row in db.execute(q)}
    targets = db.scalars(select(Product).where(Product.id.in_(product_ids)) if product_ids else select(Product))
    for p in targets:
        row = stats.get(p.id)
        if not row:
            p.review_count, p.rating_avg, p.sentiment_score = 0, 0.0, None
            p.positive_pct = p.neutral_pct = p.negative_pct = 0.0
            continue
        _, n, avg_rating, n_sent, pos, neu, neg, score_sum = row
        p.review_count, p.rating_avg = int(n), round(float(avg_rating or 0), 2)
        if n_sent:
            p.positive_pct = round(100 * (pos or 0) / n_sent, 1)
            p.neutral_pct = round(100 * (neu or 0) / n_sent, 1)
            p.negative_pct = round(100 * (neg or 0) / n_sent, 1)
            p.sentiment_score = round((float(score_sum or 0) + SMOOTHING_K * 0.5) / (n_sent + SMOOTHING_K), 4)
        else:
            p.sentiment_score = None
            p.positive_pct = p.neutral_pct = p.negative_pct = 0.0


def aspect_stats(db: Session, product_ids: list[int] | None = None) -> dict[int | None, list[dict]]:
    """Per-product aspect sentiment counts. Key None aggregates across the given products."""
    q = (select(SentimentAspect.product_id, SentimentAspect.aspect, SentimentAspect.sentiment, func.count())
         .join(Review, Review.id == SentimentAspect.review_id).where(Review.is_hidden.is_(False))
         .group_by(SentimentAspect.product_id, SentimentAspect.aspect, SentimentAspect.sentiment))
    if product_ids:
        q = q.where(SentimentAspect.product_id.in_(product_ids))
    acc: dict[int | None, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for pid, aspect, sent, n in db.execute(q):
        acc[pid][aspect][sent] += n
        acc[None][aspect][sent] += n
    out: dict[int | None, list[dict]] = {}
    for pid, aspects in acc.items():
        rows = []
        for aspect, c in aspects.items():
            total = c["positive"] + c["negative"] + c["neutral"]
            rows.append({"aspect": ASPECT_LABELS.get(aspect, aspect), "key": aspect, "positive": c["positive"],
                         "negative": c["negative"], "neutral": c["neutral"], "total": total,
                         "positive_pct": round(100 * c["positive"] / total, 1) if total else 0.0})
        out[pid] = sorted(rows, key=lambda r: -r["total"])
    return out


def top_aspects(rows: list[dict], polarity: str, n: int = 3, min_count: int = 2) -> list[str]:
    if polarity == "negative":
        min_count = max(min_count, 3)
    ranked = sorted((r for r in rows if r[polarity] >= min_count), key=lambda r: -r[polarity])
    if polarity == "negative":
        # only call it a complaint if it is a meaningful share of mentions
        ranked = [r for r in ranked if r["negative"] / max(1, r["total"]) >= 0.2]
    return [r["aspect"] for r in ranked[:n]]


def sentiment_trend(db: Session, product_id: int | None = None) -> list[dict]:
    period = func.to_char(func.date_trunc("month", Review.created_at), "YYYY-MM")
    q = (select(period.label("p"),
                func.sum(case((Sentiment.label == "positive", 1), else_=0)),
                func.sum(case((Sentiment.label == "neutral", 1), else_=0)),
                func.sum(case((Sentiment.label == "negative", 1), else_=0)),
                func.avg(Sentiment.score))
         .join(Sentiment, Sentiment.review_id == Review.id).where(Review.is_hidden.is_(False))
         .group_by("p").order_by("p"))
    if product_id:
        q = q.where(Review.product_id == product_id)
    return [{"period": p, "positive": int(a or 0), "neutral": int(b or 0), "negative": int(c or 0),
             "avg_score": round(float(s or 0), 3)} for p, a, b, c, s in db.execute(q)]
