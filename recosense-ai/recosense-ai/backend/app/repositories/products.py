"""Product query helpers shared by routes, chatbot and admin."""
from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Category, Product

FINAL_PRICE = Product.price * (100 - Product.discount_percent) / 100


def base_query(include_inactive: bool = False) -> Select:
    q = select(Product).options(selectinload(Product.category), selectinload(Product.images))
    if not include_inactive:
        q = q.where(Product.is_active.is_(True))
    return q


def apply_filters(q: Select, *, search: str | None = None, category: str | None = None,
                  brands: list[str] | None = None, min_price: float | None = None, max_price: float | None = None,
                  min_rating: float | None = None, min_positive_pct: float | None = None,
                  in_stock: bool | None = None, color: str | None = None) -> Select:
    if search:
        terms = [t for t in search.lower().split() if t][:6]
        for t in terms:
            like = f"%{t}%"
            q = q.where(or_(Product.name.ilike(like), Product.brand.ilike(like), Product.description.ilike(like),
                            Product.color.ilike(like), Product.material.ilike(like),
                            Product.category.has(Category.name.ilike(like))))
    if category:
        q = q.where(Product.category.has(Category.slug == category))
    if brands:
        q = q.where(Product.brand.in_(brands))
    if min_price is not None:
        q = q.where(FINAL_PRICE >= min_price)
    if max_price is not None:
        q = q.where(FINAL_PRICE <= max_price)
    if min_rating is not None:
        q = q.where(Product.rating_avg >= min_rating)
    if min_positive_pct is not None:
        q = q.where(Product.positive_pct >= min_positive_pct)
    if in_stock:
        q = q.where(Product.stock > 0)
    if color:
        q = q.where(Product.color.ilike(f"%{color}%"))
    return q


def apply_sort(q: Select, sort: str, search: str | None = None) -> Select:
    if sort == "price_asc":
        return q.order_by(FINAL_PRICE.asc(), Product.id)
    if sort == "price_desc":
        return q.order_by(FINAL_PRICE.desc(), Product.id)
    if sort == "rating":
        return q.order_by(Product.rating_avg.desc(), Product.review_count.desc(), Product.id)
    if sort == "sentiment":
        return q.order_by(func.coalesce(Product.sentiment_score, 0).desc(), Product.review_count.desc(), Product.id)
    if sort == "newest":
        return q.order_by(Product.created_at.desc(), Product.id.desc())
    if sort == "relevance" and search:
        name_hit = case((Product.name.ilike(f"%{search}%"), 0), else_=1)
        return q.order_by(name_hit, Product.popularity.desc(), Product.id)
    return q.order_by(Product.popularity.desc(), Product.rating_avg.desc(), Product.id)


def get_products_by_ids(db: Session, ids: list[int]) -> list[Product]:
    if not ids:
        return []
    rows = db.scalars(base_query(include_inactive=True).where(Product.id.in_(ids))).all()
    by_id = {p.id: p for p in rows}
    return [by_id[i] for i in ids if i in by_id]
