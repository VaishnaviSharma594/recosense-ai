"""Import every model so Alembic autogenerate and Base.metadata see all 18 tables."""
from app.models.activity import (ChatbotConversation, ChatbotMessage, ModelMetric, Recommendation,
                                 UserInteraction)
from app.models.catalog import Category, Product, ProductImage, ProductVariant
from app.models.commerce import CartItem, Order, OrderItem, WishlistItem
from app.models.review import Review, Sentiment, SentimentAspect
from app.models.user import User, UserPreference

__all__ = [
    "User", "UserPreference", "Category", "Product", "ProductImage", "ProductVariant", "Review", "Sentiment",
    "SentimentAspect", "Recommendation", "UserInteraction", "WishlistItem", "CartItem", "Order", "OrderItem",
    "ModelMetric", "ChatbotConversation", "ChatbotMessage",
]
