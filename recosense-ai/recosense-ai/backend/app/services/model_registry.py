"""Write trained-model evaluation results into the model_metrics table."""
import json
from datetime import datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.ml.sentiment.train import META_FILE
from app.models import ModelMetric


def register_sentiment_models(db: Session) -> int:
    path = settings.MODEL_DIR / META_FILE
    if not path.exists():
        return 0
    meta = json.loads(path.read_text())
    trained_at = datetime.fromisoformat(meta["trained_at"])
    db.execute(update(ModelMetric).where(ModelMetric.model_type == "sentiment").values(is_active=False))
    for key, info in meta["models"].items():
        db.add(ModelMetric(
            model_type="sentiment", model_name=info["name"], model_version=meta["version"], status="trained",
            metrics={**info["metrics"], "params": info.get("params", {}), "train_seconds": info.get("train_seconds"),
                     "train_size": meta["train_size"], "label_distribution": meta["label_distribution"]},
            dataset_size=meta["dataset_size"], latency_ms=info["latency_ms"],
            is_active=(key == meta.get("active_model")), trained_at=trained_at,
            notes=f"Dataset: {meta['dataset']}. Labels from star rating (4-5 positive, 3 neutral, 1-2 negative). "
                  f"Stratified 80/20 split, random_state=42."))
    db.flush()
    return len(meta["models"])
