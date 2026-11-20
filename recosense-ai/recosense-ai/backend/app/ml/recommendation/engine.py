"""Hybrid recommendation engine.

Components (each min-max normalised to 0-1 over the candidate set before weighting):
  content       TF-IDF (name, category, brand, material, colour, tags, description, price band) cosine
                similarity between candidates and the user's weighted interaction profile, blended with
                explicit preferences (favourite categories / price range) when the user has set them.
  collaborative Item-based KNN on the implicit user-item matrix (views, clicks, wishlist, cart,
                purchases, ratings). Item-item cosine similarity, top-k neighbours per item.
  sentiment     Smoothed product sentiment score computed from stored review predictions.
  rating        Bayesian-average star rating (shrunk toward the catalogue mean).

Hybrid = sum(w_c * component_c), weights configurable (settings or admin override, re-normalised).
"""
from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.ml.sentiment.aspects import ASPECT_LABELS
from app.models import Product, SentimentAspect, UserInteraction, UserPreference

log = logging.getLogger(__name__)

INTERACTION_WEIGHTS = {"view": 1.0, "click": 1.5, "wishlist": 3.0, "cart": 3.0, "purchase": 5.0}
CF_NEIGHBOURS = 20
RATING_PRIOR_WEIGHT = 5
COMPONENTS = ("content", "collaborative", "sentiment", "rating")
CONFIG_FILE = "recommendation_config.json"


def default_weights() -> dict[str, float]:
    w = {"content": settings.REC_WEIGHT_CONTENT, "collaborative": settings.REC_WEIGHT_COLLABORATIVE,
         "sentiment": settings.REC_WEIGHT_SENTIMENT, "rating": settings.REC_WEIGHT_RATING}
    path = settings.MODEL_DIR / CONFIG_FILE
    if path.exists():
        try:
            w.update({k: float(v) for k, v in json.loads(path.read_text()).get("weights", {}).items() if k in w})
        except (ValueError, json.JSONDecodeError):
            log.warning("ignoring invalid %s", CONFIG_FILE)
    return normalise_weights(w)


def normalise_weights(w: dict[str, float]) -> dict[str, float]:
    w = {k: max(0.0, float(w.get(k, 0))) for k in COMPONENTS}
    s = sum(w.values()) or 1.0
    return {k: round(v / s, 4) for k, v in w.items()}


def save_weights(w: dict[str, float]) -> dict[str, float]:
    w = normalise_weights(w)
    (settings.MODEL_DIR / CONFIG_FILE).write_text(json.dumps({"weights": w}, indent=2))
    return w


def _minmax(x: np.ndarray) -> np.ndarray:
    if x.size == 0:
        return x
    lo, hi = float(np.min(x)), float(np.max(x))
    return np.zeros_like(x) if hi - lo < 1e-9 else (x - lo) / (hi - lo)


def interaction_matrix(inter: pd.DataFrame, user_ids: list[int], product_ids: list[int]) -> np.ndarray:
    """Implicit feedback matrix (users x items). Ratings add +/- signal around 3 stars."""
    u_idx = {u: i for i, u in enumerate(user_ids)}
    p_idx = {p: i for i, p in enumerate(product_ids)}
    m = np.zeros((len(user_ids), len(product_ids)), dtype=np.float32)
    for row in inter.itertuples(index=False):
        ui, pi = u_idx.get(row.user_id), p_idx.get(row.product_id)
        if ui is None or pi is None:
            continue
        if row.interaction_type == "rating":
            m[ui, pi] += (row.value - 3.0) * 1.5
        else:
            m[ui, pi] += INTERACTION_WEIGHTS.get(row.interaction_type, 1.0)
    return np.sign(m) * np.log1p(np.abs(m))


@dataclass
class EngineState:
    products: pd.DataFrame                 # indexed 0..n-1, column "id"
    content_sim: np.ndarray                # n x n
    item_sim: np.ndarray                   # n x n (CF, top-k sparsified)
    user_ids: list[int]
    matrix: np.ndarray                     # users x items
    sentiment: np.ndarray                  # 0-1
    rating: np.ndarray                     # 0-1
    popularity: np.ndarray                 # 0-1
    built_at: float = field(default_factory=time.time)

    @property
    def index(self) -> dict[int, int]:
        return {pid: i for i, pid in enumerate(self.products["id"].tolist())}


def build_state(products: pd.DataFrame, inter: pd.DataFrame) -> EngineState:
    products = products.reset_index(drop=True)
    n = len(products)
    # ---- content
    def band(row) -> str:
        cat_prices = products.loc[products["category_slug"] == row["category_slug"], "final_price"]
        q1, q2 = cat_prices.quantile(0.33), cat_prices.quantile(0.66)
        return "budget" if row["final_price"] <= q1 else "midrange" if row["final_price"] <= q2 else "premium"

    docs = [
        " ".join([r["name"], (r["category_name"] + " ") * 3, r["brand"].replace(" ", "_"), r["material"] or "",
                  r["color"] or "", " ".join(r["tags"] or []), r["description"], "price_" + band(r)])
        for _, r in products.iterrows()
    ]
    tfidf = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1, sublinear_tf=True)
    text_sim = cosine_similarity(tfidf.fit_transform(docs)) if n else np.zeros((0, 0))
    logp = np.log(products["final_price"].clip(lower=1).to_numpy())
    price_sim = 1 - np.abs(logp[:, None] - logp[None, :]) / max(1e-6, float(np.ptp(logp)) if n else 1)
    content_sim = 0.85 * text_sim + 0.15 * price_sim
    np.fill_diagonal(content_sim, 0)

    # ---- collaborative (item-based KNN)
    user_ids = sorted(inter["user_id"].unique().tolist()) if len(inter) else []
    m = interaction_matrix(inter, user_ids, products["id"].tolist())
    if len(user_ids):
        item_sim = cosine_similarity(np.clip(m, 0, None).T)
        np.fill_diagonal(item_sim, 0)
        if n > CF_NEIGHBOURS:
            thresh = -np.sort(-item_sim, axis=1)[:, CF_NEIGHBOURS - 1:CF_NEIGHBOURS]
            item_sim = np.where(item_sim >= thresh, item_sim, 0)
    else:
        item_sim = np.zeros((n, n))

    # ---- sentiment & rating
    sentiment = products["sentiment_score"].fillna(0.5).to_numpy(dtype=float)
    counts = products["review_count"].to_numpy(dtype=float)
    ratings = products["rating_avg"].to_numpy(dtype=float)
    global_mean = float((ratings * counts).sum() / counts.sum()) if counts.sum() else 3.0
    bayes = (RATING_PRIOR_WEIGHT * global_mean + ratings * counts) / (RATING_PRIOR_WEIGHT + counts)
    rating = (bayes - 1) / 4
    popularity = _minmax(np.log1p(products["popularity"].to_numpy(dtype=float)))
    return EngineState(products, content_sim, item_sim, user_ids, m, sentiment, rating, popularity)


@dataclass
class Scored:
    product_id: int
    score: float
    components: dict[str, float]
    reasons: list[str]
    algorithm: str


class RecommendationEngine:
    def __init__(self):
        self.state: EngineState | None = None
        self.top_aspects: dict[int, str] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ data
    @staticmethod
    def load_products(db: Session) -> pd.DataFrame:
        rows = db.scalars(select(Product).options(selectinload(Product.category))).all()
        return pd.DataFrame([{
            "id": p.id, "name": p.name, "brand": p.brand, "category_slug": p.category.slug,
            "category_name": p.category.name, "description": p.description, "material": p.material,
            "color": p.color, "tags": p.tags or [], "final_price": p.final_price,
            "sentiment_score": p.sentiment_score, "rating_avg": p.rating_avg, "review_count": p.review_count,
            "positive_pct": p.positive_pct, "popularity": p.popularity, "stock": p.stock, "is_active": p.is_active,
        } for p in rows])

    @staticmethod
    def load_interactions(db: Session) -> pd.DataFrame:
        rows = db.execute(select(UserInteraction.user_id, UserInteraction.product_id,
                                 UserInteraction.interaction_type, UserInteraction.value,
                                 UserInteraction.created_at)).all()
        return pd.DataFrame(rows, columns=["user_id", "product_id", "interaction_type", "value", "created_at"])

    def _load_top_aspects(self, db: Session) -> None:
        from sqlalchemy import func
        rows = db.execute(select(SentimentAspect.product_id, SentimentAspect.aspect, func.count())
                          .where(SentimentAspect.sentiment == "positive")
                          .group_by(SentimentAspect.product_id, SentimentAspect.aspect)).all()
        best: dict[int, tuple[str, int]] = {}
        for pid, aspect, n in rows:
            # "design" is mentioned in nearly every review; prefer more specific praise when close.
            adj = n * (0.6 if aspect == "design" else 1.0)
            if n >= 3 and (pid not in best or adj > best[pid][1]):
                best[pid] = (aspect, adj)
        self.top_aspects = {pid: ASPECT_LABELS[a].lower() for pid, (a, _) in best.items()}

    def rebuild(self, db: Session) -> EngineState:
        with self._lock:
            t0 = time.perf_counter()
            self.state = build_state(self.load_products(db), self.load_interactions(db))
            self._load_top_aspects(db)
            log.info("recommendation engine rebuilt in %.0f ms", (time.perf_counter() - t0) * 1000)
            return self.state

    def ensure(self, db: Session, max_age_s: int = 600) -> EngineState:
        if self.state is None or time.time() - self.state.built_at > max_age_s:
            self.rebuild(db)
        return self.state

    # --------------------------------------------------------------- scoring
    @staticmethod
    def components_for(state: EngineState, profile: np.ndarray, prefs: dict | None) -> dict[str, np.ndarray]:
        """profile: implicit weight per item (len n). Returns raw component arrays."""
        pos = np.clip(profile, 0, None)
        n = len(state.products)
        has_history = pos.sum() > 0
        if has_history:
            content = pos @ state.content_sim / pos.sum()
            collab = pos @ state.item_sim / pos.sum()
        else:
            content, collab = np.zeros(n), state.popularity.copy()
        if prefs:
            pref = np.zeros(n)
            cats, lo, hi = prefs.get("categories") or [], prefs.get("min_price"), prefs.get("max_price")
            brands = prefs.get("brands") or []
            if cats:
                pref += state.products["category_slug"].isin(cats).to_numpy() * 0.6
            price = state.products["final_price"].to_numpy()
            if lo is not None or hi is not None:
                ok = np.ones(n, dtype=bool)
                if lo is not None:
                    ok &= price >= lo
                if hi is not None:
                    ok &= price <= hi
                pref += ok * 0.3
            if brands:
                pref += state.products["brand"].isin(brands).to_numpy() * 0.1
            content = 0.7 * _minmax(content) + 0.3 * pref if has_history else pref
        return {"content": content, "collaborative": collab, "sentiment": state.sentiment.copy(),
                "rating": state.rating.copy()}

    @staticmethod
    def rank(state: EngineState, comps: dict[str, np.ndarray], weights: dict[str, float], exclude: set[int],
             k: int, only: str | None = None) -> list[tuple[int, float, dict[str, float]]]:
        """Return [(row_index, score, normalised components)] best-first."""
        df = state.products
        cand = np.array([i for i in range(len(df))
                         if i not in exclude and df.at[i, "is_active"] and df.at[i, "stock"] > 0])
        if cand.size == 0:
            return []
        norm = {c: _minmax(comps[c][cand]) for c in COMPONENTS}
        if only:
            score = norm[only] + 1e-3 * norm["rating"]  # deterministic tie-break
        else:
            score = sum(weights[c] * norm[c] for c in COMPONENTS)
        order = np.argsort(-score, kind="stable")[:k]
        return [(int(cand[o]), float(score[o]), {c: float(norm[c][o]) for c in COMPONENTS}) for o in order]

    # ----------------------------------------------------------------- public
    def recommend(self, db: Session, user_id: int, k: int = 12, weights: dict[str, float] | None = None,
                  algorithm: str = "hybrid") -> list[Scored]:
        state = self.ensure(db)
        weights = normalise_weights(weights) if weights else default_weights()
        idx = state.index
        n = len(state.products)
        profile = np.zeros(n)
        if user_id in state.user_ids:
            profile = state.matrix[state.user_ids.index(user_id)].astype(float)
        # Include interactions newer than the last rebuild (e.g. product just viewed)
        recent = db.execute(select(UserInteraction.product_id, UserInteraction.interaction_type,
                                   UserInteraction.value)
                            .where(UserInteraction.user_id == user_id,
                                   UserInteraction.created_at >= datetime.fromtimestamp(state.built_at, tz=timezone.utc))).all()
        for pid, kind, value in recent:
            if pid in idx:
                profile[idx[pid]] += (value - 3) * 1.5 if kind == "rating" else INTERACTION_WEIGHTS.get(kind, 1)
        pref_row = db.scalar(select(UserPreference).where(UserPreference.user_id == user_id))
        prefs = None
        if pref_row and (pref_row.preferred_categories or pref_row.min_price is not None
                         or pref_row.max_price is not None or pref_row.preferred_brands):
            prefs = {"categories": pref_row.preferred_categories, "min_price": pref_row.min_price,
                     "max_price": pref_row.max_price, "brands": pref_row.preferred_brands}
        purchased = {idx[p] for (p,) in db.execute(
            select(UserInteraction.product_id).where(UserInteraction.user_id == user_id,
                                                     UserInteraction.interaction_type == "purchase")) if p in idx}
        cold = np.clip(profile, 0, None).sum() == 0
        comps = self.components_for(state, profile, prefs)
        only = None if algorithm in ("hybrid", "cold_start") else algorithm
        ranked = self.rank(state, comps, weights, purchased, k, only=only)
        algo = "cold_start" if cold else algorithm
        out = []
        for i, score, norm in ranked:
            out.append(Scored(int(state.products.at[i, "id"]), round(score, 4), {c: round(v, 4) for c, v in norm.items()},
                              self._reasons(state, i, norm, weights, profile, prefs, cold), algo))
        return out

    def similar(self, db: Session, product_id: int, k: int = 8) -> list[Scored]:
        state = self.ensure(db)
        idx = state.index
        if product_id not in idx:
            self.rebuild(db)
            state, idx = self.state, self.state.index
            if product_id not in idx:
                return []
        i = idx[product_id]
        comps = {"content": state.content_sim[i], "collaborative": state.item_sim[i],
                 "sentiment": state.sentiment, "rating": state.rating}
        w = {"content": 0.65, "collaborative": 0.15, "sentiment": 0.12, "rating": 0.08}
        ranked = self.rank(state, comps, w, {i}, k)
        out = []
        for j, score, norm in ranked:
            out.append(Scored(int(state.products.at[j, "id"]), round(score, 4), norm,
                              self._similar_reasons(state, i, j), "content_similarity"))
        return out

    # ---------------------------------------------------------------- reasons
    def _reasons(self, state: EngineState, i: int, norm: dict[str, float], w: dict[str, float],
                 profile: np.ndarray, prefs: dict | None, cold: bool) -> list[str]:
        df = state.products
        row = df.iloc[i]
        reasons: list[str] = []
        contrib = sorted(((w[c] * norm[c], c) for c in COMPONENTS), reverse=True)
        for value, comp in contrib:
            if value < 0.05 or len(reasons) >= 2:
                continue
            if comp == "content":
                if not cold and np.clip(profile, 0, None).sum() > 0:
                    anchor = int(np.argmax(np.clip(profile, 0, None) * state.content_sim[:, i]))
                    reasons.append(f"Similar to {df.at[anchor, 'name']} that you showed interest in")
                elif prefs and prefs.get("categories") and row["category_slug"] in prefs["categories"]:
                    reasons.append(f"In your favourite category: {row['category_name']}")
                elif prefs and (prefs.get("min_price") is not None or prefs.get("max_price") is not None):
                    reasons.append("Matches your preferred price range")
            elif comp == "collaborative":
                reasons.append("Trending with shoppers right now" if cold
                               else "Popular among shoppers with similar preferences")
            elif comp == "sentiment" and row["review_count"] > 0:
                aspect = self.top_aspects.get(int(row["id"]))
                reasons.append(f"Positive customer feedback on {aspect}" if aspect and row["positive_pct"] >= 60
                               else f"{row['positive_pct']:.0f}% of reviews are positive")
            elif comp == "rating" and row["review_count"] > 0:
                reasons.append(f"Highly rated ({row['rating_avg']:.1f}★ from {int(row['review_count'])} reviews)")
        if prefs and prefs.get("max_price") is not None and len(reasons) < 2 \
                and row["final_price"] <= prefs["max_price"] and "price range" not in " ".join(reasons):
            reasons.append("Matches your preferred price range")
        if not reasons:
            reasons.append("New arrival — be one of the first to review it" if row["review_count"] == 0
                           else "Recommended from your overall shopping profile")
        return reasons

    def _similar_reasons(self, state: EngineState, i: int, j: int) -> list[str]:
        df = state.products
        a, b = df.iloc[i], df.iloc[j]
        reasons = []
        shared = []
        if a["category_slug"] == b["category_slug"]:
            shared.append(a["category_name"].lower())
        if a["brand"] == b["brand"]:
            shared.append(f"brand {b['brand']}")
        tags = set(a["tags"] or []) & set(b["tags"] or [])
        if tags:
            shared.append(", ".join(sorted(tags)[:2]))
        if shared:
            reasons.append("Similar style: " + " · ".join(shared))
        aspect = self.top_aspects.get(int(b["id"]))
        if aspect and b["positive_pct"] >= 60:
            reasons.append(f"Customers praise its {aspect}")
        return reasons or ["Similar product attributes"]


engine = RecommendationEngine()
