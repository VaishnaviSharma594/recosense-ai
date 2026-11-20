from sqlalchemy.orm import Session

from app.models import Product, UserInteraction

POPULARITY_WEIGHTS = {"view": 1, "click": 1, "wishlist": 3, "cart": 2, "purchase": 5, "rating": 2}


def record_interaction(db: Session, user_id: int, product_id: int, kind: str, value: float = 1.0,
                       is_demo: bool = False) -> None:
    db.add(UserInteraction(user_id=user_id, product_id=product_id, interaction_type=kind, value=value,
                           is_demo=is_demo))
    product = db.get(Product, product_id)
    if product:
        product.popularity = (product.popularity or 0) + POPULARITY_WEIGHTS.get(kind, 1)
