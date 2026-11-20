#!/usr/bin/env sh
# Production entrypoint: migrate, train/seed on first boot, then serve.
set -e
cd "$(dirname "$0")/.."
alembic upgrade head
if [ ! -f trained_models/sentiment_tfidf_logreg.joblib ]; then
  python -m app.ml.sentiment.train --quick
fi
python -m app.seed.run || true   # no-op when products already exist
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
