from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl, computed_field

from app.schemas.common import ORMModel


class CategoryOut(ORMModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    image_url: str | None = None


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=500)


class ImageOut(ORMModel):
    id: int
    url: str
    alt: str
    position: int


class VariantOut(ORMModel):
    id: int
    size: str
    color: str
    sku: str
    stock: int


class ProductCard(ORMModel):
    id: int
    name: str
    slug: str
    brand: str
    price: float
    discount_percent: int
    final_price: float
    color: str | None = None
    stock: int
    rating_avg: float
    review_count: int
    sentiment_score: float | None = None
    positive_pct: float
    negative_pct: float
    neutral_pct: float
    popularity: int
    is_active: bool
    category: CategoryOut
    images: list[ImageOut] = []

    @computed_field
    @property
    def in_stock(self) -> bool:
        return self.stock > 0

    @computed_field
    @property
    def image_url(self) -> str | None:
        return self.images[0].url if self.images else None


class ProductDetail(ProductCard):
    description: str
    material: str | None = None
    tags: list[str] = []
    variants: list[VariantOut] = []
    is_demo: bool
    created_at: datetime


class VariantIn(BaseModel):
    size: str = Field(min_length=1, max_length=20)
    color: str = Field(min_length=1, max_length=60)
    stock: int = Field(ge=0, le=100000)


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=5000)
    brand: str = Field(min_length=1, max_length=100)
    category_id: int
    price: float = Field(gt=0, le=1_000_000)
    discount_percent: int = Field(default=0, ge=0, le=90)
    material: str | None = Field(default=None, max_length=120)
    color: str | None = Field(default=None, max_length=60)
    tags: list[str] = Field(default_factory=list, max_length=20)
    image_urls: list[str] = Field(default_factory=list, max_length=8)
    variants: list[VariantIn] = Field(default_factory=list, max_length=40)
    is_active: bool = True

    def validated_image_urls(self) -> list[str]:
        out = []
        for u in self.image_urls:
            if u.startswith("/"):
                out.append(u)
            else:
                out.append(str(HttpUrl(u)))
        return out


class Suggestion(BaseModel):
    type: str  # product | category | brand
    label: str
    href: str
