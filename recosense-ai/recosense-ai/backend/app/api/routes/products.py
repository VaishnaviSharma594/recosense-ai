import math
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import distinct, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DB, AdminUser
from app.models import Category, Product, ProductImage, ProductVariant
from app.repositories.products import apply_filters, apply_sort, base_query
from app.schemas.common import Message, Page
from app.schemas.product import CategoryIn, CategoryOut, ProductCard, ProductDetail, ProductIn, Suggestion
from app.utils.text import slugify

router = APIRouter(prefix="/api", tags=["products"])

SORTS = "^(popularity|price_asc|price_desc|rating|sentiment|newest|relevance)$"


@router.get("/products", response_model=Page[ProductCard])
def list_products(
    db: DB,
    q: str | None = Query(default=None, max_length=100),
    category: str | None = None,
    brand: list[str] | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    min_sentiment: float | None = Query(default=None, ge=0, le=100, description="Minimum positive review %"),
    in_stock: bool | None = None,
    sort: str = Query(default="popularity", pattern=SORTS),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    include_inactive: bool = False,
):
    query = apply_filters(base_query(include_inactive), search=q, category=category, brands=brand,
                          min_price=min_price, max_price=max_price, min_rating=min_rating,
                          min_positive_pct=min_sentiment, in_stock=in_stock)
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    items = db.scalars(apply_sort(query, sort, q).offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=items, total=total or 0, page=page, page_size=page_size,
                pages=max(1, math.ceil((total or 0) / page_size)))


@router.get("/products/facets")
def product_facets(db: DB, category: str | None = None):
    q = select(Product).where(Product.is_active.is_(True))
    if category:
        q = q.where(Product.category.has(Category.slug == category))
    sub = q.subquery()
    brands = db.scalars(select(distinct(sub.c.brand)).order_by(sub.c.brand)).all()
    price = db.execute(select(func.min(sub.c.price * (100 - sub.c.discount_percent) / 100),
                              func.max(sub.c.price * (100 - sub.c.discount_percent) / 100))).one()
    return {"brands": brands, "min_price": float(price[0] or 0), "max_price": float(price[1] or 0)}


@router.get("/products/suggest", response_model=list[Suggestion])
def suggest(db: DB, q: str = Query(min_length=1, max_length=60)):
    like = f"%{q.strip()}%"
    out: list[Suggestion] = []
    for c in db.scalars(select(Category).where(Category.name.ilike(like)).limit(3)):
        out.append(Suggestion(type="category", label=c.name, href=f"/products?category={c.slug}"))
    for b in db.scalars(select(Product.brand).distinct().where(Product.brand.ilike(like), Product.is_active).limit(3)):
        out.append(Suggestion(type="brand", label=b, href=f"/products?brand={b}"))
    for p in db.scalars(select(Product).where(Product.name.ilike(like), Product.is_active)
                        .order_by(Product.popularity.desc()).limit(6)):
        out.append(Suggestion(type="product", label=p.name, href=f"/products/{p.id}"))
    return out


@router.get("/products/{product_id}", response_model=ProductDetail)
def get_product(product_id: int, db: DB):
    p = db.scalar(base_query(include_inactive=True).options(selectinload(Product.variants))
                  .where(Product.id == product_id))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return p


def _apply_product_input(db, p: Product, body: ProductIn) -> None:
    if not db.get(Category, body.category_id):
        raise HTTPException(422, "Category does not exist")
    try:
        urls = body.validated_image_urls()
    except ValueError:
        raise HTTPException(422, "One of the image URLs is invalid")
    p.name, p.description, p.brand = body.name.strip(), body.description.strip(), body.brand.strip()
    p.category_id, p.price, p.discount_percent = body.category_id, Decimal(str(body.price)), body.discount_percent
    p.material, p.color, p.tags, p.is_active = body.material, body.color, body.tags, body.is_active
    p.images.clear()
    for i, url in enumerate(urls):
        p.images.append(ProductImage(url=url, alt=p.name, position=i))
    db.flush()
    p.variants.clear()
    db.flush()
    for v in body.variants:
        p.variants.append(ProductVariant(size=v.size, color=v.color, stock=v.stock,
                                         sku=f"RS-{p.id}-{slugify(v.size)}-{slugify(v.color)}".upper()[:80]))
    if body.variants:
        p.stock = sum(v.stock for v in body.variants)


@router.post("/products", response_model=ProductDetail, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductIn, db: DB, _: AdminUser):
    base = slugify(body.name) or "product"
    slug, n = base, 1
    while db.scalar(select(Product.id).where(Product.slug == slug)):
        n += 1
        slug = f"{base}-{n}"
    p = Product(slug=slug, name=body.name, brand=body.brand, category_id=body.category_id, price=0, stock=0,
                tags=[], description="")
    db.add(p)
    db.flush()
    try:
        _apply_product_input(db, p, body)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Duplicate variant (size + colour must be unique)")
    return get_product(p.id, db)


@router.put("/products/{product_id}", response_model=ProductDetail)
def update_product(product_id: int, body: ProductIn, db: DB, _: AdminUser):
    p = db.scalar(select(Product).options(selectinload(Product.images), selectinload(Product.variants))
                  .where(Product.id == product_id))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    try:
        _apply_product_input(db, p, body)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Duplicate variant (size + colour must be unique)")
    return get_product(p.id, db)


@router.delete("/products/{product_id}", response_model=Message)
def delete_product(product_id: int, db: DB, _: AdminUser):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    db.delete(p)
    db.commit()
    return Message(message="Product deleted")


# ---------------- Categories ----------------
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: DB):
    return db.scalars(select(Category).order_by(Category.id)).all()


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryIn, db: DB, _: AdminUser):
    c = Category(name=body.name.strip(), slug=slugify(body.name), description=body.description,
                 image_url=body.image_url)
    db.add(c)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Category already exists")
    return c


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, body: CategoryIn, db: DB, _: AdminUser):
    c = db.get(Category, category_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    c.name, c.slug, c.description = body.name.strip(), slugify(body.name), body.description
    c.image_url = body.image_url
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Category name already in use")
    return c


@router.delete("/categories/{category_id}", response_model=Message)
def delete_category(category_id: int, db: DB, _: AdminUser):
    c = db.get(Category, category_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if db.scalar(select(func.count()).select_from(Product).where(Product.category_id == c.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Move or delete this category's products first")
    db.delete(c)
    db.commit()
    return Message(message="Category deleted")


