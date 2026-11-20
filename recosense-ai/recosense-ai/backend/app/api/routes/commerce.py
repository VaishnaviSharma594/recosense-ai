import secrets
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser
from app.models import CartItem, Order, OrderItem, Product, ProductVariant, UserInteraction, WishlistItem
from app.repositories.products import get_products_by_ids
from app.schemas.commerce import (CartIn, CartItemOut, CartOut, CartUpdate, CheckoutIn, InteractionIn, OrderOut,
                                  WishlistIn, WishlistItemOut)
from app.schemas.common import Message
from app.schemas.product import ProductCard
from app.services.interactions import record_interaction

router = APIRouter(prefix="/api", tags=["commerce"])

FREE_SHIPPING_THRESHOLD = 1999
SHIPPING_FEE = 99


def _product_opts():
    return (selectinload(Product.category), selectinload(Product.images))


# ---------------- Wishlist ----------------
@router.get("/wishlist", response_model=list[WishlistItemOut])
def get_wishlist(user: CurrentUser, db: DB):
    return db.scalars(select(WishlistItem).where(WishlistItem.user_id == user.id)
                      .options(selectinload(WishlistItem.product).options(*_product_opts()))
                      .order_by(WishlistItem.created_at.desc())).all()


@router.post("/wishlist", response_model=Message, status_code=status.HTTP_201_CREATED)
def add_wishlist(body: WishlistIn, user: CurrentUser, db: DB):
    if not db.get(Product, body.product_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    exists = db.scalar(select(WishlistItem).where(WishlistItem.user_id == user.id,
                                                  WishlistItem.product_id == body.product_id))
    if exists:
        return Message(message="Already in wishlist")
    db.add(WishlistItem(user_id=user.id, product_id=body.product_id))
    record_interaction(db, user.id, body.product_id, "wishlist")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return Message(message="Added to wishlist")


@router.delete("/wishlist/{product_id}", response_model=Message)
def remove_wishlist(product_id: int, user: CurrentUser, db: DB):
    res = db.execute(delete(WishlistItem).where(WishlistItem.user_id == user.id,
                                                WishlistItem.product_id == product_id))
    db.commit()
    if not res.rowcount:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product is not in your wishlist")
    return Message(message="Removed from wishlist")


# ---------------- Cart ----------------
def _cart_items(db, user_id: int) -> list[CartItem]:
    return db.scalars(select(CartItem).where(CartItem.user_id == user_id)
                      .options(selectinload(CartItem.product).options(*_product_opts()),
                               selectinload(CartItem.variant))
                      .order_by(CartItem.created_at)).all()


def _availability(item: CartItem) -> str | None:
    p = item.product
    if not p.is_active:
        return "This product is no longer available"
    if item.variant is not None:
        if item.variant.stock <= 0:
            return "Selected size/colour is out of stock"
        if item.variant.stock < item.quantity:
            return f"Only {item.variant.stock} left in this size"
    if p.stock <= 0:
        return "Out of stock"
    if p.stock < item.quantity:
        return f"Only {p.stock} left in stock"
    return None


def _build_cart(db, user_id: int) -> CartOut:
    items = _cart_items(db, user_id)
    out, subtotal, final_sum, unavailable = [], 0.0, 0.0, False
    for it in items:
        issue = _availability(it)
        line_final = it.product.final_price * it.quantity
        if issue:
            unavailable = True
        else:
            subtotal += float(it.product.price) * it.quantity
            final_sum += line_final
        out.append(CartItemOut(id=it.id, quantity=it.quantity, product=ProductCard.model_validate(it.product),
                               variant=it.variant, available=issue is None, issue=issue,
                               line_total=round(line_final, 2)))
    shipping = 0 if final_sum == 0 or final_sum >= FREE_SHIPPING_THRESHOLD else SHIPPING_FEE
    return CartOut(items=out, item_count=sum(i.quantity for i in items), subtotal=round(subtotal, 2),
                   discount=round(subtotal - final_sum, 2), shipping_fee=shipping,
                   total=round(final_sum + shipping, 2), has_unavailable=unavailable)


@router.get("/cart", response_model=CartOut)
def get_cart(user: CurrentUser, db: DB):
    return _build_cart(db, user.id)


@router.post("/cart", response_model=CartOut, status_code=status.HTTP_201_CREATED)
def add_to_cart(body: CartIn, user: CurrentUser, db: DB):
    product = db.get(Product, body.product_id)
    if not product or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not available")
    variant_id = body.variant_id
    if variant_id is not None:
        v = db.get(ProductVariant, variant_id)
        if not v or v.product_id != product.id:
            raise HTTPException(422, "Invalid size/colour selection")
        if v.stock <= 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "Selected size/colour is out of stock")
    elif db.scalar(select(func.count()).select_from(ProductVariant).where(ProductVariant.product_id == product.id)):
        raise HTTPException(422, "Please choose a size/colour")
    if product.stock <= 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Product is out of stock")
    stmt = select(CartItem).where(CartItem.user_id == user.id, CartItem.product_id == product.id)
    stmt = stmt.where(CartItem.variant_id.is_(None)) if variant_id is None else stmt.where(
        CartItem.variant_id == variant_id)
    item = db.scalar(stmt)
    if item:
        item.quantity = min(20, item.quantity + body.quantity)
    else:
        db.add(CartItem(user_id=user.id, product_id=product.id, variant_id=variant_id, quantity=body.quantity))
    record_interaction(db, user.id, product.id, "cart")
    db.commit()
    return _build_cart(db, user.id)


@router.put("/cart/{item_id}", response_model=CartOut)
def update_cart(item_id: int, body: CartUpdate, user: CurrentUser, db: DB):
    item = db.get(CartItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart item not found")
    item.quantity = body.quantity
    db.commit()
    return _build_cart(db, user.id)


@router.delete("/cart/{item_id}", response_model=CartOut)
def remove_cart(item_id: int, user: CurrentUser, db: DB):
    item = db.get(CartItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart item not found")
    db.delete(item)
    db.commit()
    return _build_cart(db, user.id)


# ---------------- Orders (demo checkout — no real payment) ----------------
@router.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(body: CheckoutIn, user: CurrentUser, db: DB):
    items = _cart_items(db, user.id)
    if not items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty")
    problems = [f"{i.product.name}: {_availability(i)}" for i in items if _availability(i)]
    if problems:
        raise HTTPException(status.HTTP_409_CONFLICT, "Some items are unavailable — " + "; ".join(problems))
    cart = _build_cart(db, user.id)
    order = Order(
        user_id=user.id, status="confirmed", payment_method=body.payment_method,
        order_number=f"RS-{datetime.now(timezone.utc):%y%m%d}-{secrets.token_hex(3).upper()}",
        subtotal=Decimal(str(cart.subtotal)), discount=Decimal(str(cart.discount)),
        shipping_fee=Decimal(str(cart.shipping_fee)), total=Decimal(str(cart.total)),
        shipping_name=body.shipping_name, shipping_phone=body.shipping_phone,
        shipping_address=body.shipping_address, shipping_city=body.shipping_city,
        shipping_postal_code=body.shipping_postal_code,
    )
    for it in items:
        p = it.product
        order.items.append(OrderItem(
            product_id=p.id, variant_id=it.variant_id, product_name=p.name,
            image_url=p.images[0].url if p.images else None, size=it.variant.size if it.variant else None,
            color=it.variant.color if it.variant else p.color, unit_price=Decimal(str(p.final_price)),
            quantity=it.quantity))
        p.stock -= it.quantity
        if it.variant:
            it.variant.stock -= it.quantity
        record_interaction(db, user.id, p.id, "purchase", value=it.quantity)
        db.delete(it)
    db.add(order)
    db.commit()
    return _get_order(db, user.id, order.id)


def _get_order(db, user_id: int, order_id: int) -> Order:
    o = db.scalar(select(Order).where(Order.id == order_id, Order.user_id == user_id)
                  .options(selectinload(Order.items)))
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return o


@router.get("/orders", response_model=list[OrderOut])
def list_orders(user: CurrentUser, db: DB):
    return db.scalars(select(Order).where(Order.user_id == user.id).options(selectinload(Order.items))
                      .order_by(Order.created_at.desc())).all()


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, user: CurrentUser, db: DB):
    return _get_order(db, user.id, order_id)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: int, user: CurrentUser, db: DB):
    o = _get_order(db, user.id, order_id)
    if o.status not in ("placed", "confirmed"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"An order that is {o.status} cannot be cancelled")
    o.status = "cancelled"
    for it in o.items:
        if it.product_id and (p := db.get(Product, it.product_id)):
            p.stock += it.quantity
        if it.variant_id and (v := db.get(ProductVariant, it.variant_id)):
            v.stock += it.quantity
    db.commit()
    return _get_order(db, user.id, o.id)


# ---------------- Interactions / recently viewed ----------------
@router.post("/interactions", response_model=Message, status_code=status.HTTP_201_CREATED)
def track(body: InteractionIn, user: CurrentUser, db: DB):
    if not db.get(Product, body.product_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    record_interaction(db, user.id, body.product_id, body.interaction_type)
    db.commit()
    return Message(message="tracked")


@router.get("/interactions/recent", response_model=list[ProductCard])
def recently_viewed(user: CurrentUser, db: DB, limit: int = 8):
    rows = db.execute(select(UserInteraction.product_id, func.max(UserInteraction.created_at).label("t"))
                      .where(UserInteraction.user_id == user.id, UserInteraction.interaction_type == "view")
                      .group_by(UserInteraction.product_id).order_by(desc("t")).limit(min(limit, 20))).all()
    return [p for p in get_products_by_ids(db, [r[0] for r in rows]) if p.is_active]
