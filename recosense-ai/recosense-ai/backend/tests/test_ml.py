import io

from app.ml.sentiment.aspects import detect_aspects, split_clauses
from app.ml.sentiment.predictor import predictor
from app.ml.sentiment.preprocess import clean_text, rating_to_label, tokenize
from app.services.chatbot import parse

EXAMPLE = "The dress is beautiful and the fabric quality is excellent, but the fitting is disappointing."


def test_preprocessing():
    assert clean_text("<b>LOVE</b> it!!! Doesn't fit http://x.co") == "love it!! does not fit"
    toks = tokenize("does not fit well. love it")
    assert "not" in toks and "NOT_fit" in toks and "love" in toks
    assert [rating_to_label(r) for r in (1, 2, 3, 4, 5)] == ["negative", "negative", "neutral", "positive", "positive"]


def test_aspect_extraction_and_clauses():
    clauses = split_clauses(EXAMPLE)
    assert len(clauses) == 2
    assert set(detect_aspects(clauses[0])) >= {"design", "fabric_quality"}
    assert detect_aspects(clauses[1]) == ["fit"]


def test_spec_example_is_mixed():
    a, _ = predictor.analyze(EXAMPLE)
    assert a.overall == "mixed"
    assert "Fabric quality" in a.positive_aspects and "Design & style" in a.positive_aspects
    assert a.negative_aspects == ["Fit & sizing"]


def test_clear_polarity():
    pos, _ = predictor.analyze("Absolutely love it, flattering and so comfortable. Great quality!")
    neg, _ = predictor.analyze("Terrible quality, cheap fabric, returned it immediately.")
    assert pos.label == "positive" and neg.label == "negative"


def test_analyze_endpoint(client):
    r = client.post("/api/sentiment/analyze", json={"text": EXAMPLE})
    assert r.status_code == 200
    body = r.json()
    assert body["overall"] == "mixed" and abs(sum(body["probabilities"].values()) - 1) < 1e-3


def test_review_creates_sentiment_and_aggregates(client, customer):
    r = client.post("/api/products/1/reviews", json={"title": "Love it", "body": "Gorgeous colour and the fabric is soft and comfortable.", "rating": 5}, headers=customer)
    assert r.status_code == 201
    assert r.json()["sentiment"]["label"] == "positive"
    assert client.post("/api/products/1/reviews", json={"body": "Second review attempt here", "rating": 4},
                       headers=customer).status_code == 409
    s = client.get("/api/products/1/sentiment").json()
    assert s["review_count"] == 1 and s["distribution"]["positive"] == 1 and s["positive_pct"] == 100.0
    summary = client.get("/api/products/1/summary").json()
    assert summary["sufficient_data"] is False and summary["generated"] is True


def test_dataset_upload_pipeline(client, admin):
    csv = ("product_id,Review Text,Rating,Title\n"
           "1,\"Runs small and the material is see through.\",2,Disappointed\n"
           "1,\"Runs small and the material is see through.\",2,Disappointed\n"
           "2,\"Beautiful linen, so breathable and flattering!\",5,Perfect\n"
           "999,\"orphan\",5,\n"
           "1,,4,\n"
           "1,\"bad rating\",9,\n")
    files = {"file": ("reviews.csv", io.BytesIO(csv.encode()), "text/csv")}
    r = client.post("/api/admin/dataset/upload", files=files, headers=admin)
    assert r.status_code == 200, r.text
    rep = r.json()
    assert rep["imported"] == 2 and rep["duplicates_in_file"] == 1 and rep["unassociated"] == 1
    assert rep["missing_values_dropped"] == 1 and rep["invalid_rating_dropped"] == 1
    again = client.post("/api/admin/dataset/upload", files={"file": ("r.csv", io.BytesIO(csv.encode()), "text/csv")},
                        headers=admin).json()
    assert again["imported"] == 0 and again["duplicates_existing"] == 2
    bad = client.post("/api/admin/dataset/upload", files={"file": ("x.exe", b"MZ", "application/octet-stream")},
                      headers=admin)
    assert bad.status_code == 415
    missing = client.post("/api/admin/dataset/upload", files={"file": ("m.csv", b"a,b\n1,2\n", "text/csv")},
                          headers=admin)
    assert missing.status_code == 422


def test_chatbot_parser():
    q = parse("Suggest dresses under ₹2,000", ["Aurelle"], set())
    assert q.category == "dresses" and q.max_price == 2000 and q.intent == "search"
    q = parse("Which products have complaints about fitting?", [], set())
    assert q.intent == "complaints" and q.aspects == ["fit"]
    q = parse("black aurelle jeans between 1k and 2.5k", ["Aurelle"], set())
    assert (q.min_price, q.max_price, q.brand, q.colour, q.category) == (1000, 2500, "Aurelle", "black", "jeans")
    assert parse("Compare #1 and #2", [], set()).product_refs == [1, 2]
    assert parse("Which product has the best customer reviews?", [], set()).intent == "best_reviewed"


def test_chatbot_retrieval_and_history(client, customer):
    r = client.post("/api/chatbot/message", json={"message": "Suggest dresses under 2000"}, headers=customer).json()
    names = [p["product"]["name"] for p in r["reply"]["payload"]["products"]]
    assert names == ["Satin Slip Dress", "Floral Wrap Dress"] or set(names) == {"Satin Slip Dress", "Floral Wrap Dress"}
    assert all(p["product"]["final_price"] <= 2000 for p in r["reply"]["payload"]["products"])
    follow = client.post("/api/chatbot/message", json={"message": "compare these",
                                                       "conversation_id": r["conversation_id"]}, headers=customer).json()
    assert len(follow["reply"]["payload"]["compare"]["ids"]) == 2
    hist = client.get("/api/chatbot/history", headers=customer).json()
    assert len(hist) == 1 and len(hist[0]["messages"]) == 4


def test_recommendations_cold_start_then_personalised(client, customer):
    me = client.get("/api/auth/me", headers=customer).json()
    cold = client.get(f"/api/recommendations/{me['id']}", headers=customer).json()
    assert cold["cold_start"] and len(cold["items"]) > 0 and all(i["reasons"] for i in cold["items"])
    client.post("/api/wishlist", json={"product_id": 1}, headers=customer)
    client.post("/api/interactions", json={"product_id": 2, "interaction_type": "view"}, headers=customer)
    warm = client.post("/api/recommendations/refresh", headers=customer).json()
    assert not warm["cold_start"]
    top = warm["items"][0]
    assert top["product"]["category"]["slug"] == "dresses"
    assert 0 <= top["score"] <= 1 and set(top["components"]) == {"content", "collaborative", "sentiment", "rating"}
    other = client.get("/api/recommendations/1", headers=customer)
    assert other.status_code == 403


def test_similar_and_compare(client):
    sim = client.get("/api/recommendations/similar/1").json()
    assert sim and sim[0]["product"]["category"]["slug"] == "dresses"
    cmp_ = client.get("/api/compare", params={"ids": "1,2,3"}).json()
    assert len(cmp_["products"]) == 3
    assert any(b["attribute"] == "Lowest price" and b["product_id"] == 3 for b in cmp_["best_for"])
    assert client.get("/api/compare", params={"ids": "1"}).status_code == 422


def test_recommendation_evaluation_metrics_ranges():
    import pandas as pd
    from app.ml.recommendation.evaluation import evaluate
    products = pd.DataFrame([{"id": i, "name": f"P{i}", "brand": "B", "category_slug": "c" + str(i % 2),
                              "category_name": "Cat" + str(i % 2), "description": "d", "material": "m", "color": "x",
                              "tags": [], "final_price": 100 + i, "sentiment_score": 0.6, "rating_avg": 4.0,
                              "review_count": 5, "positive_pct": 70.0, "popularity": i, "stock": 1, "is_active": True}
                             for i in range(1, 11)])
    rows = []
    ts = pd.Timestamp("2026-01-01", tz="UTC")
    for u in range(1, 6):
        for j, pid in enumerate([1, 3, 5, 7, 9] if u % 2 else [2, 4, 6, 8, 10]):
            rows.append((u, pid, "purchase", 1.0, ts + pd.Timedelta(days=j)))
    inter = pd.DataFrame(rows, columns=["user_id", "product_id", "interaction_type", "value", "created_at"])
    report = evaluate(products, inter)
    for strat in report["strategies"].values():
        for m in strat["metrics"].values():
            assert 0 <= m["precision"] <= 1 and 0 <= m["recall"] <= 1 and 0 <= m["ndcg"] <= 1
