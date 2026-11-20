"""Offline evaluation of recommendation strategies (leave-latest-out on positive interactions).

For each user with >= 4 positive items (wishlist / cart / purchase / rating >= 4), the most recent
25% of positive items are held out. ALL of that user's interactions with held-out items are removed
before the models are fitted, items already interacted with in training are excluded from ranking,
and Precision@K, Recall@K, NDCG@K, hit rate and catalogue coverage are computed per strategy.
"""
import math
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.ml.recommendation.engine import RecommendationEngine, build_state, default_weights
from app.models import ModelMetric

POSITIVE = {"wishlist", "cart", "purchase"}
KS = (5, 10)
STRATEGIES = {
    "popularity": "Popularity baseline",
    "content": "Content-based (TF-IDF + cosine)",
    "collaborative": "Collaborative (item-KNN)",
    "sentiment": "Sentiment-based",
    "hybrid": "Hybrid (weighted)",
}


def _split(inter: pd.DataFrame, holdout: float = 0.25, min_pos: int = 4):
    pos = inter[(inter["interaction_type"].isin(POSITIVE)) |
                ((inter["interaction_type"] == "rating") & (inter["value"] >= 4))]
    first_pos = pos.groupby(["user_id", "product_id"])["created_at"].min().reset_index()
    test: dict[int, set[int]] = {}
    for uid, g in first_pos.groupby("user_id"):
        if len(g) < min_pos:
            continue
        n_test = max(1, int(round(len(g) * holdout)))
        test[uid] = set(g.sort_values("created_at").tail(n_test)["product_id"].tolist())
    mask = inter.apply(lambda r: r["product_id"] in test.get(r["user_id"], ()), axis=1)
    return inter[~mask], test


def _ndcg(ranked: list[int], relevant: set[int], k: int) -> float:
    dcg = sum(1 / math.log2(i + 2) for i, p in enumerate(ranked[:k]) if p in relevant)
    idcg = sum(1 / math.log2(i + 2) for i in range(min(k, len(relevant))))
    return dcg / idcg if idcg else 0.0


def evaluate(products: pd.DataFrame, inter: pd.DataFrame, weights: dict | None = None) -> dict:
    weights = weights or default_weights()
    train, test = _split(inter)
    state = build_state(products, train)
    # evaluation ignores stock so held-out items that sold out are still reachable
    state.products = state.products.assign(stock=1, is_active=True)
    idx = state.index
    ids = state.products["id"].tolist()
    results = {s: {k: {"precision": [], "recall": [], "ndcg": [], "hit": []} for k in KS} for s in STRATEGIES}
    covered = {s: {k: set() for k in KS} for s in STRATEGIES}
    timings = {s: [] for s in STRATEGIES}
    kmax = max(KS)
    for uid, relevant_ids in test.items():
        if uid not in state.user_ids:
            continue
        relevant = {idx[p] for p in relevant_ids if p in idx}
        profile = state.matrix[state.user_ids.index(uid)].astype(float)
        seen = set(np.nonzero(profile)[0].tolist())
        comps = RecommendationEngine.components_for(state, profile, None)
        for strat in STRATEGIES:
            t0 = time.perf_counter()
            if strat == "hybrid":
                ranked = RecommendationEngine.rank(state, comps, weights, seen, kmax)
            elif strat == "popularity":
                c2 = {**comps, "collaborative": state.popularity}
                ranked = RecommendationEngine.rank(state, c2, weights, seen, kmax, only="collaborative")
            else:
                ranked = RecommendationEngine.rank(state, comps, weights, seen, kmax, only=strat)
            timings[strat].append((time.perf_counter() - t0) * 1000)
            rec = [r[0] for r in ranked]
            for k in KS:
                hits = len(set(rec[:k]) & relevant)
                results[strat][k]["precision"].append(hits / k)
                results[strat][k]["recall"].append(hits / len(relevant) if relevant else 0)
                results[strat][k]["ndcg"].append(_ndcg(rec, relevant, k))
                results[strat][k]["hit"].append(1.0 if hits else 0.0)
                covered[strat][k].update(rec[:k])
    out = {}
    for strat, per_k in results.items():
        out[strat] = {
            "name": STRATEGIES[strat],
            "latency_ms": round(float(np.mean(timings[strat])) if timings[strat] else 0.0, 3),
            "metrics": {f"@{k}": {
                "precision": round(float(np.mean(v["precision"])) if v["precision"] else 0, 4),
                "recall": round(float(np.mean(v["recall"])) if v["recall"] else 0, 4),
                "ndcg": round(float(np.mean(v["ndcg"])) if v["ndcg"] else 0, 4),
                "hit_rate": round(float(np.mean(v["hit"])) if v["hit"] else 0, 4),
                "coverage": round(len(covered[strat][k]) / max(1, len(ids)), 4),
            } for k, v in per_k.items()},
        }
    return {"strategies": out, "users_evaluated": len(test), "interactions": int(len(inter)),
            "catalogue_size": len(ids), "weights": weights,
            "evaluated_at": datetime.now(timezone.utc).isoformat()}


def evaluate_and_store(db: Session, weights: dict | None = None) -> dict:
    products = RecommendationEngine.load_products(db)
    inter = RecommendationEngine.load_interactions(db)
    if inter.empty or products.empty:
        return {}
    report = evaluate(products, inter, weights)
    synthetic_note = ("Evaluated on interaction data that is mostly SYNTHETIC demo-shopper behaviour "
                      "(generated from personas and real review sentiment). Treat as a pipeline sanity check, "
                      "not as evidence of real-world performance.")
    db.execute(update(ModelMetric).where(ModelMetric.model_type == "recommendation").values(is_active=False))
    for key, res in report["strategies"].items():
        db.add(ModelMetric(model_type="recommendation", model_name=res["name"], model_version="1.0.0",
                           status="evaluated", metrics={**res["metrics"], "strategy": key,
                                                         "users_evaluated": report["users_evaluated"],
                                                         "weights": report["weights"] if key == "hybrid" else None},
                           dataset_size=report["interactions"], latency_ms=res["latency_ms"],
                           is_active=(key == "hybrid"), notes=synthetic_note))
    db.flush()
    return report


