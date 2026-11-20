from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, JSONType, TimestampMixin

INTERACTION_TYPES = ("view", "click", "wishlist", "cart", "purchase", "rating")


class UserInteraction(TimestampMixin, Base):
    __tablename__ = "user_interactions"
    __table_args__ = (
        Index("ix_interactions_user_product", "user_id", "product_id"),
        Index("ix_interactions_type_created", "interaction_type", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    interaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Recommendation(TimestampMixin, Base):
    __tablename__ = "recommendations"
    __table_args__ = (Index("ix_recommendations_user_score", "user_id", "score"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    content_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    collaborative_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    rating_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    algorithm: Mapped[str] = mapped_column(String(30), nullable=False)
    reasons: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)


class ModelMetric(TimestampMixin, Base):
    __tablename__ = "model_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # sentiment | recommendation
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    model_version: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="trained", nullable=False)
    metrics: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    dataset_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latency_ms: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ChatbotConversation(TimestampMixin, Base):
    __tablename__ = "chatbot_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), default="New conversation", nullable=False)

    messages: Mapped[list[ChatbotMessage]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="ChatbotMessage.id"
    )


class ChatbotMessage(TimestampMixin, Base):
    __tablename__ = "chatbot_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("chatbot_conversations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)

    conversation: Mapped[ChatbotConversation] = relationship(back_populates="messages")
