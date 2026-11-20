"""Background model-training jobs (in-process; status kept in memory)."""
import logging
import threading
import traceback
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.database.session import SessionLocal

log = logging.getLogger(__name__)
JOBS: dict[str, dict] = {}
_running = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run(job_id: str, target: str, reanalyze: bool, quick: bool) -> None:
    from app.ml.recommendation.engine import engine
    from app.ml.recommendation.evaluation import evaluate_and_store
    from app.ml.sentiment import train as sentiment_train
    from app.ml.sentiment.predictor import predictor
    from app.models import Review
    from app.services.model_registry import register_sentiment_models
    from app.services.sentiment_service import analyze_reviews, recompute_product_stats

    job = JOBS[job_id]
    if not _running.acquire(blocking=False):
        job.update(status="failed", error="Another training job is already running", finished_at=_now())
        return
    db = SessionLocal()
    try:
        job["status"] = "running"
        if target in ("sentiment", "all"):
            job["step"] = "Training sentiment models"
            meta = sentiment_train.train(quick=quick)
            predictor.load(force=True)
            register_sentiment_models(db)
            job["result"]["sentiment"] = {k: {"accuracy": v["metrics"]["accuracy"], "f1_macro": v["metrics"]["f1_macro"]}
                                          for k, v in meta["models"].items()}
            db.commit()
        if reanalyze and target in ("sentiment", "all"):
            job["step"] = "Re-analysing stored reviews"
            reviews = list(db.scalars(select(Review)))
            analyze_reviews(db, reviews)
            recompute_product_stats(db)
            db.commit()
            job["result"]["reviews_reanalysed"] = len(reviews)
        if target in ("recommendation", "all", "sentiment"):
            job["step"] = "Rebuilding recommendation models"
            engine.rebuild(db)
            report = evaluate_and_store(db)
            db.commit()
            if report:
                job["result"]["recommendation"] = {k: v["metrics"]["@10"] for k, v in report["strategies"].items()}
        job.update(status="completed", step="Done", finished_at=_now())
    except Exception as e:  # noqa: BLE001
        db.rollback()
        log.error("training job failed: %s", traceback.format_exc())
        job.update(status="failed", error=str(e), finished_at=_now())
    finally:
        db.close()
        _running.release()


def start_job(target: str, reanalyze: bool = True, quick: bool = True) -> dict:
    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {"id": job_id, "target": target, "status": "queued", "step": "Queued", "started_at": _now(),
                    "finished_at": None, "error": None, "result": {}}
    threading.Thread(target=_run, args=(job_id, target, reanalyze, quick), daemon=True).start()
    return JOBS[job_id]
