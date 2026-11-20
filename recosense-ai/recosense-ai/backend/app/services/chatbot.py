"""Retrieval-based AI shopping assistant.

A rule-based NLP query parser extracts intent, category, price constraints, brand, colour, product
attributes and aspect/sentiment requirements. Matching products are then retrieved from PostgreSQL and
ranked with stored sentiment and aspect data; every answer explains why each product matched.
No hard-coded answers and no external/paid LLM.
"""
from __future__ import annotations

import difflib
import re
from dataclasses import asdict, dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.recommendation.engine import engine
from app.ml.sentiment.aspects import ASPECT_LABELS
from app.models import ChatbotMessage, Product, WishlistItem
from app.repositories.products import apply_filters, base_query, get_products_by_ids
from app.schemas.product import ProductCard
from app.services.comparison import compare
from app.services.sentiment_service import aspect_stats

CATEGORY_SYNONYMS = {
    "dresses": ["dress", "dresses", "gown", "gowns", "frock", "maxi", "sundress", "kurta dress"],
    "tops": ["top", "tops", "tee", "tees", "t-shirt", "tshirt", "t shirt", "sweater", "sweaters", "cardigan",
             "hoodie", "knit", "knits", "tank", "pullover"],
    "shirts": ["shirt", "shirts", "blouse", "blouses", "button-down", "button down"],
    "jeans": ["jeans", "jean", "denim", "denims", "jeggings"],
    "shoes": ["shoe", "shoes", "sneaker", "sneakers", "heels", "heel", "boots", "boot", "sandals", "flats",
              "loafers", "pumps", "footwear"],
    "accessories": ["accessory", "accessories", "bag", "bags", "tote", "watch", "watches", "sunglasses",
                    "scarf", "scarves", "belt", "earrings", "clutch", "stole", "jewellery", "jewelry"],
}
ASPECT_SYNONYMS = {
    "fabric_quality": ["fabric", "material", "quality", "fabric quality", "cloth", "texture"],
    "fit": ["fit", "fitting", "fits", "sizing", "size", "true to size"],
    "comfort": ["comfort", "comfortable", "comfy", "cozy", "soft"],
    "design": ["design", "style", "stylish", "look", "looks", "pretty", "beautiful"],
    "color": ["colour", "color", "colours", "colors"],
    "length": ["length", "too long", "too short"],
    "value": ["value", "worth", "value for money"],
    "durability": ["durable", "durability", "wash", "washing", "shrink", "last long"],
}
COLOURS = ["black", "white", "blue", "navy", "red", "pink", "rose", "green", "emerald", "sage", "olive", "yellow",
           "gold", "silver", "grey", "gray", "beige", "cream", "brown", "tan", "purple", "lilac", "coral", "indigo",
           "ivory", "camel", "burgundy", "teal", "orange", "mint"]
NEGATIVE_WORDS = ["complaint", "complaints", "complain", "issue", "issues", "problem", "problems", "negative",
                  "bad", "poor", "worst", "returns", "disappoint"]
STOP = set("""i me my show find get want need looking look for some any a an the with and or of to in on under below
above over less more than between within upto up price budget products product items item which what is are
has have good best great excellent please suggest recommend me can you also that this these those reviews review
customer customers positive sentiment rs inr rupees""".split())


@dataclass
class ParsedQuery:
    intent: str = "search"
    category: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    brand: str | None = None
    colour: str | None = None
    aspects: list[str] = field(default_factory=list)
    polarity: str = "positive"
    want_positive_sentiment: bool = False
    keywords: list[str] = field(default_factory=list)
    product_refs: list[int] = field(default_factory=list)


def _num(s: str, k: str | None) -> float:
    v = float(s.replace(",", ""))
    return v * 1000 if k else v


def _has(text: str, phrase: str) -> bool:
    return re.search(r"\b" + re.escape(phrase) + r"\b", text) is not None


def parse(message: str, brands: list[str], vocab: set[str]) -> ParsedQuery:
    t = message.lower().replace("₹", " rs ").replace("rs.", "rs ")
    q = ParsedQuery()
    money = r"(?:rs|inr)?\s*([\d][\d,]*(?:\.\d+)?)\s*(k)?\b"
    if m := re.search(r"between\s+" + money + r"\s*(?:and|-|to)\s*" + money, t):
        q.min_price, q.max_price = _num(m.group(1), m.group(2)), _num(m.group(3), m.group(4))
    else:
        if m := re.search(r"(?:under|below|less than|cheaper than|within|upto|up to|max(?:imum)?|budget(?: of)?|<)\s*"
                          + money, t):
            q.max_price = _num(m.group(1), m.group(2))
        if m := re.search(r"(?:over|above|more than|at least|min(?:imum)?|from|>)\s*" + money, t):
            q.min_price = _num(m.group(1), m.group(2))
    for slug, words in CATEGORY_SYNONYMS.items():
        if any(_has(t, w) for w in words):
            q.category = slug
            break
    for b in brands:
        if _has(t, b.lower()):
            q.brand = b
            break
    for c in COLOURS:
        if _has(t, c):
            q.colour = c
            break
    for key, words in ASPECT_SYNONYMS.items():
        if any(_has(t, w) for w in words):
            q.aspects.append(key)
    q.product_refs = [int(x) for x in re.findall(r"#(\d+)", t)]
    if any(_has(t, w) for w in NEGATIVE_WORDS):
        q.polarity = "negative"
    if re.search(r"positive (sentiment|reviews|feedback)|good reviews|well reviewed|loved", t):
        q.want_positive_sentiment = True

    if re.search(r"\b(hi|hello|hey|help|what can you do)\b", t) and len(t.split()) <= 5:
        q.intent = "greeting"
    elif "compare" in t or re.search(r"\bvs\.?\b|versus", t):
        q.intent = "compare"
    elif "similar" in t and "wishlist" in t:
        q.intent = "similar_wishlist"
    elif q.polarity == "negative":
        q.intent = "complaints"
    elif re.search(r"best (customer )?reviews|best[- ]reviewed|best rated|highest rated|top rated|most loved", t):
        q.intent = "best_reviewed"
    elif re.search(r"\b(for me|recommend(ed)? for me|my style|personali[sz]ed)\b", t):
        q.intent = "personal"
    tokens = re.findall(r"[a-z]+", t)
    category_words = {w for ws in CATEGORY_SYNONYMS.values() for w in ws}
    aspect_words = {w for ws in ASPECT_SYNONYMS.values() for w in ws}
    q.keywords = list(dict.fromkeys(
        w for w in tokens if w in vocab and w not in STOP and w not in category_words and w not in aspect_words
        and w not in COLOURS and (not q.brand or w not in q.brand.lower())))[:4]
    return q


class ShoppingAssistant:
    def __init__(self, db: Session, user_id: int):
        self.db, self.user_id = db, user_id

    def _vocab(self) -> tuple[list[str], set[str]]:
        brands = list(self.db.scalars(select(Product.brand).distinct()))
        vocab: set[str] = set()
        for name, material, tags in self.db.execute(select(Product.name, Product.material, Product.tags)):
            vocab.update(re.findall(r"[a-z]+", f"{name} {material or ''} {' '.join(tags or [])}".lower()))
        return brands, {v for v in vocab if len(v) > 2}

    # --------------------------------------------------------------- retrieval
    def _candidates(self, q: ParsedQuery, use_keywords: bool = True) -> list[Product]:
        query = apply_filters(base_query(), category=q.category, brands=[q.brand] if q.brand else None,
                              min_price=q.min_price, max_price=q.max_price, color=q.colour)
        products = list(self.db.scalars(query))
        if use_keywords and q.keywords:
            def match(p: Product) -> bool:
                hay = f"{p.name} {p.material or ''} {' '.join(p.tags or [])} {p.description}".lower()
                return any(k in hay for k in q.keywords)
            products = [p for p in products if match(p)]
        return products

    @staticmethod
    def _bayes_rating(p: Product) -> float:
        return (5 * 4.0 + p.rating_avg * p.review_count) / (5 + p.review_count)

    def _rank(self, q: ParsedQuery, products: list[Product]) -> tuple[list[tuple[Product, list[str]]], list[str]]:
        notes: list[str] = []
        stats = aspect_stats(self.db, [p.id for p in products]) if products else {}
        scored: list[tuple[float, Product, list[str]]] = []
        for p in products:
            reasons: list[str] = []
            by_key = {r["key"]: r for r in stats.get(p.id, [])}
            base = 0.5 * (p.sentiment_score or 0.5) + 0.3 * (self._bayes_rating(p) - 1) / 4 + \
                0.2 * min(1.0, p.popularity / 400)
            score = base
            if q.max_price is not None:
                reasons.append(f"₹{p.final_price:,.0f} — within your ₹{q.max_price:,.0f} budget")
            elif q.min_price is not None:
                reasons.append(f"₹{p.final_price:,.0f}")
            if q.aspects:
                for a in q.aspects:
                    r = by_key.get(a)
                    label = ASPECT_LABELS[a]
                    if q.intent == "complaints":
                        if r and r["negative"] > 0:
                            share = r["negative"] / r["total"]
                            score = share + 0.01 * r["negative"]
                            reasons.append(f"{label}: {r['negative']} complaint{'s' if r['negative'] != 1 else ''} "
                                           f"in {r['total']} mentions ({share:.0%})")
                        else:
                            score = -1
                    elif r and r["total"] >= 2:
                        score += 1.5 * (r["positive"] + 1) / (r["total"] + 2)
                        reasons.append(f"{label} praised in {r['positive']} of {r['total']} review mentions")
                    else:
                        score -= 0.5
            if q.intent == "best_reviewed":
                score = 0.6 * (self._bayes_rating(p) - 1) / 4 + 0.4 * (p.sentiment_score or 0.5)
            if q.intent == "complaints" and not q.aspects:
                score = p.negative_pct / 100 if p.review_count else -1
                if p.review_count:
                    reasons.append(f"{p.negative_pct:.0f}% negative reviews")
            if p.review_count and q.intent != "complaints":
                reasons.append(f"{p.positive_pct:.0f}% positive reviews · {p.rating_avg:.1f}★ ({p.review_count})")
            elif not p.review_count and q.intent != "complaints":
                reasons.append("New — no reviews yet")
            if q.want_positive_sentiment and p.positive_pct < 60:
                score -= 1
            if q.keywords:
                hit = [k for k in q.keywords if k in f"{p.name} {p.material} {' '.join(p.tags or [])}".lower()]
                if hit:
                    reasons.insert(0, "Matches: " + ", ".join(hit))
            scored.append((score, p, reasons))
        if q.intent == "complaints":
            scored = [s for s in scored if s[0] > 0]
        if q.want_positive_sentiment:
            kept = [s for s in scored if s[1].positive_pct >= 60 and s[1].review_count >= 3]
            if not kept and scored:
                notes.append("No products met a 60% positive-review threshold, so I've shown the closest matches.")
            scored = kept or scored
        scored.sort(key=lambda s: -s[0])
        return [(p, r[:3]) for _, p, r in scored[:6]], notes

    # ---------------------------------------------------------------- answers
    @staticmethod
    def _describe(q: ParsedQuery) -> str:
        parts = []
        if q.colour:
            parts.append(q.colour)
        if q.brand:
            parts.append(q.brand)
        parts.append({"dresses": "dresses", "tops": "tops", "shirts": "shirts", "jeans": "jeans", "shoes": "shoes",
                      "accessories": "accessories"}.get(q.category or "", "products"))
        if q.keywords:
            parts.insert(0, " ".join(q.keywords))
        s = " ".join(parts)
        if q.min_price is not None and q.max_price is not None:
            s += f" between ₹{q.min_price:,.0f} and ₹{q.max_price:,.0f}"
        elif q.max_price is not None:
            s += f" under ₹{q.max_price:,.0f}"
        elif q.min_price is not None:
            s += f" above ₹{q.min_price:,.0f}"
        return s

    def _products_payload(self, items: list[tuple[Product, list[str]]]) -> list[dict]:
        return [{"product": ProductCard.model_validate(p).model_dump(mode="json"), "reasons": r} for p, r in items]

    def answer(self, message: str, history: list[ChatbotMessage]) -> tuple[str, dict]:
        brands, vocab = self._vocab()
        q = parse(message, brands, vocab)
        payload: dict = {"intent": q.intent, "parsed": asdict(q), "products": []}

        if q.intent == "greeting":
            payload["suggestions"] = ["Suggest dresses under ₹2,000", "Show products with excellent fabric quality",
                                      "Which products have complaints about fitting?", "Suggest products similar to my wishlist"]
            return ("Hi! I'm the RecoSense shopping assistant. Ask me for products by category, budget, colour or "
                    "brand, and I'll rank them using real customer review sentiment. I can also compare products and "
                    "surface common complaints."), payload

        if q.intent == "compare":
            return self._compare(q, message, history, payload)

        if q.intent == "similar_wishlist":
            ids = list(self.db.scalars(select(WishlistItem.product_id).where(WishlistItem.user_id == self.user_id)))
            if not ids:
                return "Your wishlist is empty — add a few products and I'll find similar ones.", payload
            merged: dict[int, tuple[float, list[str]]] = {}
            wish = {p.id: p.name for p in get_products_by_ids(self.db, ids)}
            for wid in ids:
                for s in engine.similar(self.db, wid, k=6):
                    if s.product_id in ids:
                        continue
                    prev = merged.get(s.product_id)
                    if not prev or s.score > prev[0]:
                        merged[s.product_id] = (s.score, [f"Similar to {wish.get(wid, 'an item')} in your wishlist",
                                                          *s.reasons[1:2]])
            best = sorted(merged.items(), key=lambda kv: -kv[1][0])[:6]
            products = {p.id: p for p in get_products_by_ids(self.db, [b[0] for b in best])}
            payload["products"] = self._products_payload([(products[pid], r) for pid, (_, r) in best if pid in products])
            return f"Based on the {len(ids)} item(s) in your wishlist, these are the closest matches by style and attributes:", payload

        if q.intent == "personal" and not (q.category or q.max_price or q.aspects):
            scored = engine.recommend(self.db, self.user_id, k=6)
            products = {p.id: p for p in get_products_by_ids(self.db, [s.product_id for s in scored])}
            payload["products"] = self._products_payload([(products[s.product_id], s.reasons) for s in scored
                                                          if s.product_id in products])
            return "Here are your personalised picks from the hybrid recommendation engine:", payload

        relaxed: list[str] = []
        candidates = self._candidates(q)
        if not candidates and q.keywords:
            candidates = self._candidates(q, use_keywords=False)
            relaxed.append(f"ignored “{' '.join(q.keywords)}”")
        if not candidates and q.colour:
            q.colour = None
            candidates = self._candidates(q, use_keywords=False)
            relaxed.append("ignored the colour")
        ranked, notes = self._rank(q, candidates)
        payload["products"] = self._products_payload(ranked)
        payload["notes"] = notes + ([f"No exact matches, so I {' and '.join(relaxed)}."] if relaxed else [])
        desc = self._describe(q)
        if not ranked:
            if q.intent == "complaints":
                return (f"Good news — I couldn't find {desc} with recurring complaints"
                        f"{' about ' + ', '.join(ASPECT_LABELS[a].lower() for a in q.aspects) if q.aspects else ''}."), payload
            return f"I couldn't find {desc}. Try widening the budget or removing a filter.", payload
        aspect_txt = " and ".join(ASPECT_LABELS[a].lower() for a in q.aspects)
        if q.intent == "complaints":
            text = (f"These {desc} receive the most complaints"
                    f"{' about ' + aspect_txt if aspect_txt else ''}, based on aspect-level review analysis:")
        elif q.intent == "best_reviewed":
            text = f"These {desc} have the strongest customer reviews (Bayesian rating + sentiment):"
        elif aspect_txt:
            text = f"Here are {desc} where customers speak most positively about {aspect_txt}:"
        elif q.want_positive_sentiment:
            text = f"These {desc} have predominantly positive customer reviews (60%+ positive):"
        elif len(ranked) == 1:
            text = f"I found one match for {desc}:"
        else:
            text = f"Here are {len(ranked)} {desc}, ranked by customer sentiment, rating and popularity:"
        payload["suggestions"] = [f"Compare #{ranked[0][0].id} and #{ranked[1][0].id}"] if len(ranked) > 1 else []
        return text, payload

    def _compare(self, q: ParsedQuery, message: str, history: list[ChatbotMessage], payload: dict):
        ids = list(q.product_refs)
        if len(ids) < 2:
            names = {p.id: p.name.lower() for p in self.db.scalars(select(Product).where(Product.is_active))}
            low = message.lower()
            for chunk in re.split(r"\band\b|\bvs\.?\b|\bversus\b|,|\bwith\b", low):
                chunk = chunk.replace("compare", "").strip()
                if len(chunk) < 4:
                    continue
                best = difflib.get_close_matches(chunk, list(names.values()), n=1, cutoff=0.45)
                if not best:
                    hits = [(len(set(chunk.split()) & set(n.split())), pid) for pid, n in names.items()]
                    hits = [h for h in hits if h[0] >= 2]
                    if hits:
                        ids.append(max(hits)[1])
                    continue
                ids.extend(pid for pid, n in names.items() if n == best[0])
        if len(ids) < 2:
            for msg in reversed(history):
                if msg.role == "assistant" and msg.payload.get("products"):
                    ids = [x["product"]["id"] for x in msg.payload["products"][:2]]
                    break
        ids = list(dict.fromkeys(ids))[:4]
        if len(ids) < 2:
            return ("Tell me which products to compare — e.g. “compare #3 and #7” — or ask for a list first and then "
                    "say “compare these”."), payload
        try:
            result = compare(self.db, ids)
        except ValueError as e:
            return str(e), payload
        payload["compare"] = {"ids": ids, "best_for": result["best_for"], "overall": result["overall"]}
        payload["products"] = [{"product": r["product"], "reasons": (r["pros"][:2] or ["—"]) + r["cons"][:1]}
                               for r in result["products"]]
        lines = [f"• {b['attribute']}: {next(r['product']['name'] for r in result['products'] if r['product']['id'] == b['product_id'])} ({b['value']})"
                 for b in result["best_for"]]
        verdict = result["overall"]["text"] if result["overall"] else "No single product wins across the board."
        return "Here's how they compare:\n" + "\n".join(lines) + f"\n\n{verdict}", payload


