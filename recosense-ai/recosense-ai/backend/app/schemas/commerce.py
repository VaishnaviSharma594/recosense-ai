from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.product import ProductCard, VariantOut


class WishlistIn(BaseModel):
    product_id: int


class WishlistItemOut(ORMModel):
    id: int
    product: ProductCard
    created_at: datetime


class CartIn(BaseModel):
    product_id: int
    variant_id: int | None = None
    quantity: int = Field(default=1, ge=1, le=20)


class CartUpdate(BaseModel):
    quantity: int = Field(ge=1, le=20)


class CartItemOut(ORMModel):
    id: int
    quantity: int
    product: ProductCard
    variant: VariantOut | None = None
    available: bool = True
    issue: str | None = None
    line_total: float = 0


class CartOut(BaseModel):
    items: list[CartItemOut]
    item_count: int
    subtotal: float
    discount: float
    shipping_fee: float
    total: float
    has_unavailable: bool


class CheckoutIn(BaseModel):
    shipping_name: str = Field(min_length=2, max_length=120)
    shipping_phone: str = Field(min_length=7, max_length=30, pattern=r"^[0-9+\-\s()]+$")
    shipping_address: str = Field(min_length=5, max_length=300)
    shipping_city: str = Field(min_length=2, max_length=80)
    shipping_postal_code: str = Field(min_length=4, max_length=12, pattern=r"^[0-9A-Za-z\- ]+$")
    payment_method: str = Field(default="demo_card", pattern="^(demo_card|demo_upi|demo_cod)$")


class OrderItemOut(ORMModel):
    id: int
    product_id: int | None
    product_name: str
    image_url: str | None
    size: str | None
    color: str | None
    unit_price: float
    quantity: int


class OrderOut(ORMModel):
    id: int
    order_number: str
    status: str
    subtotal: float
    discount: float
    shipping_fee: float
    total: float
    payment_method: str
    shipping_name: str
    shipping_phone: str
    shipping_address: str
    shipping_city: str
    shipping_postal_code: str
    created_at: datetime
    items: list[OrderItemOut]


class InteractionIn(BaseModel):
    product_id: int
    interaction_type: str = Field(pattern="^(view|click)$")
