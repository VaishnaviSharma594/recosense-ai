"""Seed the database with the sample catalogue, real dataset reviews and labelled demo accounts.

    python -m app.seed.run --reset

* Products / brands are fictional sample data (is_demo=True).
* Reviews come from the Kaggle "Women's E-Commerce Clothing Reviews" dataset, ONLY from the
  held-out test split so stored predictions are out-of-sample. Each sample product is linked to one
  real dataset garment (Clothing ID) of the matching garment class.
* Demo shopper interactions (views, wishlist, cart, purchases) are SYNTHETIC and flagged is_demo=True.
  No demo orders are created, so order analytics only reflect real checkouts.
"""
import argparse
import json
import logging
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pandas as pd
from sqlalchemy import func, select, text

from app.core.config import BASE_DIR, settings
from app.core.security import hash_password
from app.database.session import SessionLocal
from app.ml.sentiment import train as sentiment_train
from app.models import (Category, Product, ProductImage, ProductVariant, User, UserInteraction, UserPreference,
                        WishlistItem)
from app.seed.catalog_data import CATEGORIES, DATASET_CLASS_MAP, DEMO_PERSONAS, DESCRIPTIONS, PRODUCTS, SIZES
from app.seed.illustrations import write_all
from app.services.dataset_import import import_reviews
from app.services.interactions import POPULARITY_WEIGHTS
from app.services.model_registry import register_sentiment_models
from app.utils.text import slugify

log = logging.getLogger("seed")
IMAGE_DIR = BASE_DIR.parent / "frontend" / "public" / "images" / "products"
IMAGE_URL = "/images/products/{slug}.svg"
REVIEWS_PER_PRODUCT = 80
N_SHOPPERS = 60

ADMIN = ("admin@recosense.ai", "Admin@1234", "RecoSense Admin")
DEMO_CUSTOMER = ("demo@recosense.ai", "Demo@1234", "Demo Customer")


def reset(db) -> None:
    tables = ["chatbot_messages", "chatbot_conversations", "recommendations", "model_metrics", "user_interactions",
              "order_items", "orders", "cart_items", "wishlists", "sentiment_aspects", "sentiments", "reviews",
              "product_variants", "product_images", "products", "categories", "user_preferences", "users"]
    db.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
    db.commit()


def seed_catalog(db, rng: random.Random) -> dict[str, list[Product]]:
    cats = {}
    for name, slug, desc in CATEGORIES:
        c = Category(name=name, slug=slug, description=desc, image_url=None)
        db.add(c)
        cats[slug] = c
    db.flush()
    images, by_cat = [], {}
    for slug, rows in PRODUCTS.items():
        by_cat[slug] = []
        first_image = None
        for name, brand, colour, hex_, material, price, disc, style, tags in rows:
            pslug = slugify(name)
            p = Product(name=name, slug=pslug, brand=brand, category_id=cats[slug].id, price=Decimal(price),
                        discount_percent=disc, material=material, color=colour, tags=tags, is_demo=True,
                        description=DESCRIPTIONS[slug].format(material=material.lower(), colour=colour.lower())
                        .capitalize(), stock=0)
            url = IMAGE_URL.format(slug=pslug)
            first_image = first_image or url
            p.images.append(ProductImage(url=url, alt=f"{name} illustration", position=0))
            for size in SIZES[slug]:
                stock = rng.choice([0, 4, 8, 12, 18, 25]) if rng.random() < 0.9 else 0
                p.variants.append(ProductVariant(size=size, color=colour, stock=stock,
                                                 sku=f"RS-{pslug[:40]}-{slugify(size)}".upper()))
            p.stock = sum(v.stock for v in p.variants)
            images.append((pslug, style, hex_))
            db.add(p)
            by_cat[slug].append(p)
        cats[slug].image_url = first_image
    # Guarantee a couple of fully sold-out items to demonstrate availability handling.
    for p in (by_cat["dresses"][9], by_cat["shoes"][10]):
        for v in p.variants:
            v.stock = 0
        p.stock = 0
    db.flush()
    # Illustrations are committed under frontend/public; regenerate only when the frontend folder is present
    # (it isn't inside the backend Docker image / on Render).
    if IMAGE_DIR.parent.parent.exists():
        write_all(images, IMAGE_DIR)
    return by_cat


def seed_reviews(db, by_cat: dict[str, list[Product]], rng: random.Random) -> dict:
    df = pd.read_csv(settings.DATASET_DIR / sentiment_train.DATASET_FILE)
    df = df.rename(columns={df.columns[0]: "row_id"})
    split = json.loads((settings.MODEL_DIR / sentiment_train.SPLIT_FILE).read_text())
    test_ids = set(split["test_row_ids"])
    df = df[df["row_id"].isin(test_ids) & df["Review Text"].notna()]
    product_map: dict[int, int] = {}
    for cat, classes in DATASET_CLASS_MAP.items():
        sub = df[df["Class Name"].isin(classes)]
        top_ids = sub["Clothing ID"].value_counts()
        top_ids = top_ids[top_ids >= 5].index.tolist()[: len(by_cat[cat])]
        products = by_cat[cat][:]
        rng.shuffle(products)
        for cid, p in zip(top_ids, products):
            p.source_clothing_id = int(cid)
            product_map[int(cid)] = p.id
    df = df[df["Clothing ID"].isin(product_map)]
    df = df.sample(frac=1.0, random_state=42)
    df = df[df.groupby("Clothing ID").cumcount() < REVIEWS_PER_PRODUCT]
    report = import_reviews(db, df, product_map=product_map, source="dataset")
    log.info("review import: %s", report)
    return report


def seed_users(db) -> tuple[User, User, list[User]]:
    admin = User(email=ADMIN[0], full_name=ADMIN[2], hashed_password=hash_password(ADMIN[1]), role="admin",
                 is_demo=True)
    demo = User(email=DEMO_CUSTOMER[0], full_name=DEMO_CUSTOMER[2], hashed_password=hash_password(DEMO_CUSTOMER[1]),
                role="customer", is_demo=True)
    shopper_hash = hash_password("Shopper@1234")
    shoppers = [User(email=f"shopper{i:02d}@demo.recosense.ai", full_name=f"Demo Shopper {i:02d}",
                     hashed_password=shopper_hash, role="customer", is_demo=True) for i in range(1, N_SHOPPERS + 1)]
    db.add_all([admin, demo, *shoppers])
    db.flush()
    db.add(UserPreference(user_id=admin.id, preferred_categories=[], preferred_brands=[], preferred_sizes=[],
                          extra={}))
    db.add(UserPreference(user_id=demo.id, preferred_categories=["dresses", "accessories"], preferred_brands=[],
                          preferred_sizes=["M"], min_price=1000, max_price=4000, onboarding_completed=True,
                          extra={}))
    return admin, demo, shoppers


def _price_band(p: Product, cat_prices: dict[str, list[float]]) -> str:
    prices = sorted(cat_prices[p.category.slug])
    rank = prices.index(p.final_price) / max(1, len(prices) - 1)
    return "budget" if rank < 0.34 else "mid" if rank < 0.67 else "premium"


def seed_interactions(db, shoppers: list[User], demo: User, rng: random.Random) -> int:
    """SYNTHETIC behaviour: each demo shopper has a persona (favourite categories + price band).
    Choice probability rises with category match, price match and real review sentiment."""
    products = db.scalars(select(Product)).all()
    for p in products:
        _ = p.category
    cat_prices: dict[str, list[float]] = {}
    for p in products:
        cat_prices.setdefault(p.category.slug, []).append(p.final_price)
    bands = {p.id: _price_band(p, cat_prices) for p in products}
    now = datetime.now(timezone.utc)
    rows = []

    def utility(p: Product, cats: list[str], band: str) -> float:
        u = 2.2 if p.category.slug in cats else 0.0
        u += 0.9 if bands[p.id] == band else 0.0
        u += 1.6 * ((p.sentiment_score if p.sentiment_score is not None else 0.55) - 0.5)
        return u + rng.gauss(0, 0.6)

    def add(user: User, p: Product, kind: str, when: datetime, value: float = 1.0):
        rows.append(UserInteraction(user_id=user.id, product_id=p.id, interaction_type=kind, value=value,
                                    is_demo=True, created_at=when, updated_at=when))

    for i, user in enumerate(shoppers):
        cats, band = DEMO_PERSONAS[i % len(DEMO_PERSONAS)]
        scored = sorted(products, key=lambda p: -utility(p, cats, band))
        n_views = rng.randint(14, 30)
        viewed = scored[:n_views]
        for rank, p in enumerate(viewed):
            when = now - timedelta(days=rng.uniform(1, 120), minutes=rng.uniform(0, 600))
            add(user, p, "view", when)
            if rng.random() < 0.5:
                add(user, p, "click", when + timedelta(seconds=30))
            top = rank < n_views * 0.4
            if top and rng.random() < 0.45:
                add(user, p, "wishlist", when + timedelta(minutes=2))
                db.add(WishlistItem(user_id=user.id, product_id=p.id))
            if top and rng.random() < 0.35:
                add(user, p, "cart", when + timedelta(minutes=5))
                if rng.random() < 0.7:
                    add(user, p, "purchase", when + timedelta(minutes=12))
                    add(user, p, "rating", when + timedelta(days=5),
                        value=float(min(5, max(1, round(3 + 2 * ((p.sentiment_score or 0.6) - 0.5) * 3
                                                        + rng.gauss(0.6, 0.8))))))
    # The demo customer gets a small, readable history (dresses & accessories fan).
    dresses = [p for p in products if p.category.slug == "dresses"][:4]
    acc = [p for p in products if p.category.slug == "accessories"][:2]
    for j, p in enumerate(dresses + acc):
        when = now - timedelta(days=10 - j)
        add(demo, p, "view", when)
        if j in (0, 2):
            add(demo, p, "wishlist", when + timedelta(minutes=1))
            db.add(WishlistItem(user_id=demo.id, product_id=p.id))
    db.add_all(rows)
    db.flush()
    # popularity = weighted interaction count
    weights = db.execute(select(UserInteraction.product_id, UserInteraction.interaction_type, func.count())
                         .group_by(UserInteraction.product_id, UserInteraction.interaction_type)).all()
    pop: dict[int, int] = {}
    for pid, kind, n in weights:
        pop[pid] = pop.get(pid, 0) + POPULARITY_WEIGHTS.get(kind, 1) * n
    for p in products:
        p.popularity = pop.get(p.id, 0)
    return len(rows)


def main(reset_db: bool) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    rng = random.Random(2026)
    if not (settings.MODEL_DIR / sentiment_train.LR_FILE).exists():
        log.info("No trained sentiment model found — training now (takes ~1 minute)…")
        sentiment_train.train()
    db = SessionLocal()
    try:
        if reset_db:
            reset(db)
        elif db.scalar(select(func.count()).select_from(Product)):
            log.warning("Database already has products. Use --reset to re-seed.")
            return
        by_cat = seed_catalog(db, rng)
        admin, demo, shoppers = seed_users(db)
        report = seed_reviews(db, by_cat, rng)
        n_inter = seed_interactions(db, shoppers, demo, rng)
        register_sentiment_models(db)
        db.commit()
        log.info("seeded %d products, %d reviews, %d synthetic interactions",
                 sum(len(v) for v in by_cat.values()), report["imported"], n_inter)
        try:
            from app.ml.recommendation.engine import engine
            from app.ml.recommendation.evaluation import evaluate_and_store
            engine.rebuild(db)
            evaluate_and_store(db)
            db.commit()
            log.info("recommendation models built and evaluated")
        except ImportError:
            log.info("recommendation engine not available yet — skipped")
    finally:
        db.close()
    print(f"\nDemo accounts (sample data):\n  admin    {ADMIN[0]} / {ADMIN[1]}\n"
          f"  customer {DEMO_CUSTOMER[0]} / {DEMO_CUSTOMER[1]}\n"
          f"  {N_SHOPPERS} synthetic shoppers shopperNN@demo.recosense.ai / Shopper@1234")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="truncate all tables before seeding")
    main(ap.parse_args().reset)
