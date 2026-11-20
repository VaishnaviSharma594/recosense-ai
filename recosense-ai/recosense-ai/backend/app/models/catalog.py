from __future__ import annotations

from decimal import Decimal

from sqlalchemy import (Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, Numeric, String, Text,
                        UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, JSONType, TimestampMixin


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))

    products: Mapped[list[Product]] = relationship(back_populates="category")


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_products_price_nonneg"),
        CheckConstraint("discount_percent >= 0 AND discount_percent <= 90", name="ck_products_discount"),
        CheckConstraint("stock >= 0", name="ck_products_stock_nonneg"),
        Index("ix_products_category_active", "category_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    brand: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    material: Mapped[str | None] = mapped_column(String(120))
    color: Mapped[str | None] = mapped_column(String(60))
    tags: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_clothing_id: Mapped[int | None] = mapped_column(Integer, index=True)

    # Cached aggregates (recomputed from reviews/sentiments — never hand-entered)
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    positive_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    neutral_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    negative_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    popularity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    category: Mapped[Category] = relationship(back_populates="products")
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.position"
    )
    variants: Mapped[list[ProductVariant]] = relationship(back_populates="product", cascade="all, delete-orphan",
                                                         order_by="ProductVariant.id")

    @property
    def final_price(self) -> float:
        return round(float(self.price) * (100 - self.discount_percent) / 100, 2)


class ProductImage(TimestampMixin, Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped[Product] = relationship(back_populates="images")


class ProductVariant(TimestampMixin, Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("product_id", "size", "color", name="uq_variant_product_size_color"),
        CheckConstraint("stock >= 0", name="ck_variants_stock_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    size: Mapped[str] = mapped_column(String(20), nullable=False)
    color: Mapped[str] = mapped_column(String(60), nullable=False)
    sku: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped[Product] = relationship(back_populates="variants")
