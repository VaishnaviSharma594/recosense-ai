"""Test fixtures. Uses a separate PostgreSQL database (TEST_DATABASE_URL) migrated with Alembic.

The trained sentiment model in trained_models/ must exist (python -m app.ml.sentiment.train --quick).
"""
import os

TEST_DB = os.environ.get("TEST_DATABASE_URL",
                         "postgresql+psycopg://recosense:recosense@localhost:5432/recosense_test")
os.environ["DATABASE_URL"] = TEST_DB
os.environ["ENV"] = "test"

from decimal import Decimal  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import BASE_DIR  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.ml.recommendation.engine import engine as rec_engine  # noqa: E402
from app.models import Category, Product, ProductImage, ProductVariant, User, UserPreference  # noqa: E402

TABLES = ["chatbot_messages", "chatbot_conversations", "recommendations", "model_metrics", "user_interactions",
          "order_items", "orders", "cart_items", "wishlists", "sentiment_aspects", "sentiments", "reviews",
          "product_variants", "product_images", "products", "categories", "user_preferences", "users"]


@pytest.fixture(scope="session", autouse=True)
def migrated():
    cfg = Config(str(BASE_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BASE_DIR / "alembic"))
    command.upgrade(cfg, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def seeded(migrated):
    with SessionLocal() as db:
        db.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"))
        cats = [Category(name=n, slug=s) for n, s in [("Dresses", "dresses"), ("Tops", "tops"), ("Shoes", "shoes")]]
        db.add_all(cats)
        db.flush()
        specs = [
            ("Floral Wrap Dress", "Aurelle", 0, 2499, 20, "Rose", ["floral", "midi"]),
            ("Linen Maxi Dress", "Linen Society", 0, 3299, 0, "Sand", ["linen", "maxi"]),
            ("Satin Slip Dress", "Noir & Ivy", 0, 1899, 10, "Black", ["satin", "party"]),
            ("Essential Crew Tee", "Kora Basics", 1, 599, 0, "White", ["cotton", "basic"]),
            ("Cable Knit Sweater", "Aurelle", 1, 2299, 15, "Cream", ["knit", "winter"]),
            ("White Sneakers", "Stride Co.", 2, 2999, 0, "White", ["sneakers"]),
        ]
        for i, (name, brand, ci, price, disc, colour, tags) in enumerate(specs):
            p = Product(name=name, slug=f"p-{i}", brand=brand, category_id=cats[ci].id, price=Decimal(price),
                        discount_percent=disc, color=colour, tags=tags, description=f"{name} in {colour}", stock=10,
                        material="Cotton")
            p.images.append(ProductImage(url=f"/images/products/p-{i}.svg", alt=name))
            p.variants.append(ProductVariant(size="M", color=colour, sku=f"SKU-{i}-M", stock=6))
            p.variants.append(ProductVariant(size="L", color=colour, sku=f"SKU-{i}-L", stock=4))
            db.add(p)
        admin = User(email="admin@test.io", full_name="Admin", hashed_password=hash_password("Admin@1234"),
                     role="admin")
        db.add(admin)
        db.flush()
        db.add(UserPreference(user_id=admin.id, preferred_categories=[], preferred_brands=[], preferred_sizes=[],
                              extra={}))
        db.commit()
    rec_engine.state = None
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _token(client, email, password, register=False, name="Test User"):
    if register:
        r = client.post("/api/auth/register", json={"email": email, "password": password, "full_name": name})
        assert r.status_code == 201, r.text
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def customer(client):
    return _token(client, "jane@test.io", "Secret123", register=True, name="Jane")


@pytest.fixture
def admin(client):
    return _token(client, "admin@test.io", "Admin@1234")
