from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating"),
        # Postgres treats NULL user_id as distinct, so dataset reviews (no user) are unaffected.
        UniqueConstraint("user_id", "product_id", name="uq_review_user_product"),
        Index("ix_reviews_product_created", "product_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    title: Mapped[str | None] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(30), default="customer", nullable=False, index=True)
    reviewer_name: Mapped[str | None] = mapped_column(String(120))
    reviewer_age: Mapped[int | None] = mapped_column(Integer)
    recommended: Mapped[bool | None] = mapped_column(Boolean)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    sentiment: Mapped[Sentiment | None] = relationship(
        back_populates="review", uselist=False, cascade="all, delete-orphan"
    )
    aspects: Mapped[list[SentimentAspect]] = relationship(back_populates="review", cascade="all, delete-orphan")


class Sentiment(TimestampMixin, Base):
    __tablename__ = "sentiments"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # positive|neutral|negative
    is_mixed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)  # P(pos) - P(neg), range -1..1
    prob_positive: Mapped[float] = mapped_column(Float, nullable=False)
    prob_neutral: Mapped[float] = mapped_column(Float, nullable=False)
    prob_negative: Mapped[float] = mapped_column(Float, nullable=False)
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    model_version: Mapped[str] = mapped_column(String(40), nullable=False)

    review: Mapped[Review] = relationship(back_populates="sentiment")


class SentimentAspect(TimestampMixin, Base):
    __tablename__ = "sentiment_aspects"
    __table_args__ = (Index("ix_aspects_aspect_sentiment", "aspect", "sentiment"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), index=True, nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    aspect: Mapped[str] = mapped_column(String(40), nullable=False)
    sentiment: Mapped[str] = mapped_column(String(10), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    snippet: Mapped[str] = mapped_column(Text, nullable=False)

    review: Mapped[Review] = relationship(back_populates="aspects")
