"""Extractive review summarisation.

1. Aggregate aspect-level sentiment for the product (from stored predictions).
2. For each top aspect, pick the most *central* customer clause (highest mean TF-IDF cosine
   similarity to the other clauses about that aspect) as a representative phrase.
3. Compose a short templated overview from the aggregates. Representative phrases are quoted
   verbatim and labelled as customer words; the overview text is labelled AI-generated.
"""
from __future__ import annotations

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.sentiment.aspects import ASPECT_LABELS
from app.models import Product, Review, SentimentAspect
from app.services.sentiment_service import aspect_stats, top_aspects

MIN_REVIEWS = 3
_cache: dict[tuple[int, int, float], dict] = {}


def _central(snippets: list[str]) -> str | None:
    snippets = [s for s in dict.fromkeys(snippets) if 15 <= len(s) <= 220]
    if not snippets:
        return None
    if len(snippets) <= 2:
        return snippets[0]
    try:
        m = TfidfVectorizer(stop_words="english").fit_transform(snippets)
    except ValueError:
        return snippets[0]
    sim = cosine_similarity(m)
    np.fill_diagonal(sim, 0)
    return snippets[int(np.argmax(sim.mean(axis=1)))]


def _join(items: list[str]) -> str:
    items = [i.lower() for i in items]
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def summarize(db: Session, product_id: int) -> dict:
    p = db.get(Product, product_id)
    if not p:
        raise LookupError("Product not found")
    key = (p.id, p.review_count, p.sentiment_score or 0.0)
    if key in _cache:
        return _cache[key]
    base = {"product_id": p.id, "generated": True, "method": "Extractive aspect summarisation (TF-IDF centrality)",
            "review_count": p.review_count}
    if p.review_count < MIN_REVIEWS:
        out = {**base, "sufficient_data": False,
               "overall_opinion": ("No customer reviews yet." if p.review_count == 0 else
                                   f"Only {p.review_count} review{'s' if p.review_count != 1 else ''} so far — "
                                   f"not enough to summarise reliably."),
               "positive_points": [], "negative_points": [], "most_appreciated": [], "frequent_complaints": [],
               "recommendation_summary": "Check back once more customers have shared their experience.",
               "positive_pct": p.positive_pct, "negative_pct": p.negative_pct}
        _cache[key] = out
        return out

    rows = aspect_stats(db, [p.id]).get(p.id, [])
    liked, disliked = top_aspects(rows, "positive"), top_aspects(rows, "negative")
    snippets: dict[tuple[str, str], list[str]] = {}
    q = (select(SentimentAspect.aspect, SentimentAspect.sentiment, SentimentAspect.snippet)
         .join(Review, Review.id == SentimentAspect.review_id)
         .where(SentimentAspect.product_id == p.id, Review.is_hidden.is_(False)))
    for aspect, sent, snip in db.execute(q):
        snippets.setdefault((ASPECT_LABELS.get(aspect, aspect), sent), []).append(snip)

    def points(aspects: list[str], sent: str) -> list[dict]:
        out = []
        for a in aspects:
            stat = next((r for r in rows if r["aspect"] == a), None)
            quote = _central(snippets.get((a, sent), []))
            out.append({"aspect": a, "mentions": stat[sent] if stat else 0, "total_mentions": stat["total"] if stat else 0,
                        "customer_quote": quote})
        return out

    if liked and disliked:
        opinion = (f"Customers appreciate the {_join(liked[:2])}. However, several customers report issues with "
                   f"{_join(disliked[:2])}.")
    elif liked:
        opinion = f"Customers consistently appreciate the {_join(liked[:3])}, with few recurring complaints."
    elif disliked:
        opinion = f"Feedback is lukewarm; recurring complaints concern {_join(disliked[:3])}."
    else:
        opinion = "Customer feedback is varied without a strongly dominant theme."

    pos, neg = p.positive_pct, p.negative_pct
    if pos >= 75 and p.rating_avg >= 4:
        verdict = f"Recommended — {pos:.0f}% of analysed reviews are positive ({p.rating_avg:.1f}★ average)."
    elif pos >= 55:
        verdict = f"Generally well received ({pos:.0f}% positive)"
        verdict += f"; read the notes on {_join(disliked[:1])} before buying." if disliked else "."
    else:
        verdict = f"Mixed reception — only {pos:.0f}% positive and {neg:.0f}% negative reviews."
    out = {**base, "sufficient_data": True, "overall_opinion": opinion,
           "positive_points": points(liked, "positive"), "negative_points": points(disliked, "negative"),
           "most_appreciated": liked, "frequent_complaints": disliked, "recommendation_summary": verdict,
           "positive_pct": pos, "negative_pct": neg}
    _cache[key] = out
    return out
