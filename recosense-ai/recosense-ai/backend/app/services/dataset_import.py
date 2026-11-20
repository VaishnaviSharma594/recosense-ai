"""CSV review import: validation, missing values, duplicate detection, preprocessing, product
association and sentiment prediction. Used by the seed script and the admin upload endpoint.

Accepted columns (case-insensitive):
  required: "Review Text" (or "review"/"text"/"body"), "Rating" (1-5)
  optional: "Title", "Clothing ID" (matched to products.source_clothing_id), "product_id",
            "Age", "Recommended IND", "Positive Feedback Count", "date"
"""
import io
import random
from datetime import datetime, timedelta, timezone

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.sentiment.preprocess import clean_text
from app.models import Product, Review
from app.services.sentiment_service import analyze_reviews, recompute_product_stats
from app.utils.text import content_hash

ALIASES = {
    "review text": "body", "review": "body", "text": "body", "body": "body", "review_text": "body",
    "rating": "rating", "title": "title", "clothing id": "clothing_id", "clothing_id": "clothing_id",
    "product_id": "product_id", "age": "age", "recommended ind": "recommended",
    "positive feedback count": "helpful", "date": "date", "created_at": "date",
}


class DatasetValidationError(ValueError):
    pass


def read_csv_bytes(data: bytes) -> pd.DataFrame:
    try:
        return pd.read_csv(io.BytesIO(data))
    except Exception as e:  # noqa: BLE001 - surface parser errors to the admin
        raise DatasetValidationError(f"Could not parse CSV: {e}") from e


def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns={c: ALIASES.get(str(c).strip().lower(), str(c).strip().lower()) for c in df.columns})
    missing = {"body", "rating"} - set(df.columns)
    if missing:
        raise DatasetValidationError("Missing required column(s): " + ", ".join(sorted(missing)) +
                                     ". Expected 'Review Text' and 'Rating'.")
    return df


def import_reviews(db: Session, df: pd.DataFrame, *, product_map: dict | None = None, source: str = "dataset",
                   spread_dates_days: int = 365, seed: int = 7, max_rows: int = 50000) -> dict:
    """Import reviews. product_map optionally maps clothing_id -> product_id (seed uses this)."""
    rng = random.Random(seed)
    report = {"rows_received": int(len(df)), "missing_values_dropped": 0, "invalid_rating_dropped": 0,
              "duplicates_in_file": 0, "duplicates_existing": 0, "unassociated": 0, "imported": 0,
              "products_updated": 0}
    if len(df) > max_rows:
        raise DatasetValidationError(f"File has {len(df)} rows; the limit is {max_rows}")
    df = normalise_columns(df.copy())

    before = len(df)
    df = df.dropna(subset=["body", "rating"])
    df = df[df["body"].astype(str).str.strip().str.len() >= 3]
    report["missing_values_dropped"] = before - len(df)

    df["rating"] = pd.to_numeric(df["rating"], errors="coerce")
    before = len(df)
    df = df[df["rating"].between(1, 5)]
    df["rating"] = df["rating"].round().astype(int)
    report["invalid_rating_dropped"] = before - len(df)

    df["title"] = df["title"].fillna("").astype(str).str.strip() if "title" in df else ""
    df["body"] = df["body"].astype(str).str.strip()
    df["clean"] = df["body"].map(clean_text)
    before = len(df)
    df = df.drop_duplicates(subset=["clean"])
    report["duplicates_in_file"] = before - len(df)

    # Product association
    clothing_lookup = dict(product_map or {})
    if not product_map and "clothing_id" in df:
        ids = pd.to_numeric(df["clothing_id"], errors="coerce").dropna().astype(int).unique().tolist()
        if ids:
            clothing_lookup = dict(db.execute(select(Product.source_clothing_id, Product.id)
                                              .where(Product.source_clothing_id.in_(ids))).all())
    valid_product_ids = set(db.scalars(select(Product.id)))

    def resolve(row) -> int | None:
        if "product_id" in row and pd.notna(row.get("product_id")):
            pid = int(row["product_id"])
            return pid if pid in valid_product_ids else None
        if "clothing_id" in row and pd.notna(row.get("clothing_id")):
            return clothing_lookup.get(int(row["clothing_id"]))
        return None

    df["pid"] = df.apply(resolve, axis=1)
    report["unassociated"] = int(df["pid"].isna().sum())
    df = df[df["pid"].notna()]
    df["pid"] = df["pid"].astype(int)

    df["hash"] = [content_hash(p, t, b) for p, t, b in zip(df["pid"], df["title"], df["body"])]
    existing = set(db.scalars(select(Review.content_hash).where(Review.content_hash.in_(df["hash"].tolist()))))
    report["duplicates_existing"] = int(df["hash"].isin(existing).sum())
    df = df[~df["hash"].isin(existing)]

    now = datetime.now(timezone.utc)
    new_reviews: list[Review] = []
    for row in df.to_dict("records"):
        created = None
        if row.get("date") and not pd.isna(row.get("date")):
            created = pd.to_datetime(row["date"], errors="coerce", utc=True)
            created = None if pd.isna(created) else created.to_pydatetime()
        if created is None:
            # The Kaggle dataset has no timestamps: spread reviews over the past year (documented).
            created = now - timedelta(days=rng.uniform(0, spread_dates_days), hours=rng.uniform(0, 24))
        age = row.get("age")
        r = Review(product_id=row["pid"], user_id=None, title=row["title"] or None, body=row["body"],
                   rating=int(row["rating"]), source=source, content_hash=row["hash"],
                   reviewer_name="Verified dataset reviewer",
                   reviewer_age=int(age) if age is not None and not pd.isna(age) else None,
                   recommended=bool(row["recommended"]) if "recommended" in row and not pd.isna(
                       row.get("recommended")) else None,
                   helpful_count=int(row["helpful"]) if "helpful" in row and not pd.isna(row.get("helpful")) else 0,
                   created_at=created, updated_at=created)
        new_reviews.append(r)
    db.add_all(new_reviews)
    db.flush()
    analyze_reviews(db, new_reviews)
    touched = sorted({r.product_id for r in new_reviews})
    if touched:
        recompute_product_stats(db, touched)
    report["imported"] = len(new_reviews)
    report["products_updated"] = len(touched)
    return report
