"""Side-by-side product comparison from database + sentiment data."""
from sqlalchemy.orm import Session

from app.ml.summarization.summarizer import summarize
from app.repositories.products import get_products_by_ids
from app.schemas.product import ProductCard
from app.services.sentiment_service import aspect_stats

ASPECT_KEYS = {"fabric_quality": "Fabric quality", "comfort": "Comfort", "fit": "Fit & sizing"}
MIN_MENTIONS = 3


def compare(db: Session, ids: list[int]) -> dict:
    products = get_products_by_ids(db, list(dict.fromkeys(ids)))
    if len(products) < 2:
        raise ValueError("Select at least two existing products to compare")
    stats = aspect_stats(db, [p.id for p in products])
    rows = []
    for p in products:
        by_key = {r["key"]: r for r in stats.get(p.id, [])}
        aspects = {}
        for key, label in ASPECT_KEYS.items():
            r = by_key.get(key)
            aspects[key] = ({"label": label, "positive_pct": r["positive_pct"], "mentions": r["total"]}
                            if r and r["total"] >= MIN_MENTIONS else
                            {"label": label, "positive_pct": None, "mentions": r["total"] if r else 0})
        s = summarize(db, p.id)
        pros = [f"Praised for {a.lower()}" for a in s["most_appreciated"]]
        cons = [f"Complaints about {a.lower()}" for a in s["frequent_complaints"]]
        if p.discount_percent >= 20:
            pros.append(f"{p.discount_percent}% off right now")
        if p.stock == 0:
            cons.append("Currently out of stock")
        if p.review_count < 3:
            cons.append("Too few reviews to judge quality")
        rows.append({"product": ProductCard.model_validate(p).model_dump(), "aspects": aspects, "pros": pros[:4],
                     "cons": cons[:4], "summary": s["overall_opinion"]})

    def winner(label: str, values: dict[int, float | None], higher: bool = True, fmt=lambda v: f"{v}"):
        valid = {k: v for k, v in values.items() if v is not None}
        if len(valid) < 2:
            return None
        best = max(valid, key=valid.get) if higher else min(valid, key=valid.get)
        if list(valid.values()).count(valid[best]) > 1:
            return None
        return {"attribute": label, "product_id": best, "value": fmt(valid[best])}

    def rated(p, v):
        return v if p.review_count >= 3 else None

    by = {p.id: p for p in products}
    best = [
        winner("Lowest price", {i: p.final_price for i, p in by.items()}, higher=False, fmt=lambda v: f"₹{v:,.0f}"),
        winner("Highest rating", {i: rated(p, p.rating_avg) for i, p in by.items()}, fmt=lambda v: f"{v:.1f}★"),
        winner("Most positive reviews", {i: rated(p, p.positive_pct) for i, p in by.items()},
               fmt=lambda v: f"{v:.0f}% positive"),
        winner("Biggest discount", {i: p.discount_percent or None for i, p in by.items()}, fmt=lambda v: f"{v}% off"),
    ]
    for key, label in ASPECT_KEYS.items():
        best.append(winner(f"Best {label.lower()}", {r["product"]["id"]: r["aspects"][key]["positive_pct"] for r in rows},
                           fmt=lambda v: f"{v:.0f}% positive mentions"))
    best = [b for b in best if b]
    wins: dict[int, int] = {}
    for b in best:
        wins[b["product_id"]] = wins.get(b["product_id"], 0) + 1
    overall = None
    if wins:
        top = max(wins, key=wins.get)
        if list(wins.values()).count(wins[top]) == 1:
            overall = {"product_id": top, "wins": wins[top],
                       "text": f"{by[top].name} leads on {wins[top]} of {len(best)} compared attributes."}
    return {"products": rows, "best_for": best, "overall": overall,
            "note": f"Aspect scores need at least {MIN_MENTIONS} review mentions; otherwise shown as not enough data."}
