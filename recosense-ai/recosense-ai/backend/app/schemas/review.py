from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class AspectOut(ORMModel):
    aspect: str
    sentiment: str
    score: float
    snippet: str


class SentimentOut(ORMModel):
    label: str
    is_mixed: bool
    confidence: float
    score: float
    prob_positive: float
    prob_neutral: float
    prob_negative: float
    model_name: str
    model_version: str


class ReviewOut(ORMModel):
    id: int
    product_id: int
    user_id: int | None
    title: str | None
    body: str
    rating: int
    source: str
    reviewer_name: str | None
    reviewer_age: int | None
    recommended: bool | None
    helpful_count: int
    created_at: datetime
    sentiment: SentimentOut | None = None
    aspects: list[AspectOut] = []


class ReviewIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    body: str = Field(min_length=10, max_length=5000)
    rating: int = Field(ge=1, le=5)


class AnalyzeIn(BaseModel):
    text: str = Field(min_length=3, max_length=5000)


class AnalyzeOut(BaseModel):
    text: str
    label: str
    overall: str  # positive | negative | neutral | mixed
    confidence: float
    score: float
    probabilities: dict[str, float]
    positive_aspects: list[str]
    negative_aspects: list[str]
    aspects: list[AspectOut]
    model_name: str
    model_version: str
    latency_ms: float


class AspectStat(BaseModel):
    aspect: str
    positive: int
    negative: int
    neutral: int
    total: int
    positive_pct: float


class TrendPoint(BaseModel):
    period: str
    positive: int
    neutral: int
    negative: int
    avg_score: float


class ProductSentimentOut(BaseModel):
    product_id: int
    review_count: int
    analysed_count: int
    positive_pct: float
    neutral_pct: float
    negative_pct: float
    mixed_count: int
    sentiment_score: float | None
    rating_avg: float
    distribution: dict[str, int]
    aspects: list[AspectStat]
    top_positive_aspects: list[str]
    top_negative_aspects: list[str]
    trend: list[TrendPoint]
