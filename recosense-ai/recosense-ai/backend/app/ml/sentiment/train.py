"""Train and evaluate the review sentiment classifiers.

Labels come from the star rating (4-5 positive, 3 neutral, 1-2 negative). Two models are trained
on the same stratified 80/20 split so they can be compared fairly:
  * TF-IDF (word 1-2 grams) + Logistic Regression  -> production model
  * TF-IDF + Complement Naive Bayes                 -> baseline
The held-out test review ids are saved so the demo catalogue only shows reviews the model never saw.

Run:  python -m app.ml.sentiment.train
"""
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             precision_recall_fscore_support)
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline

from app.core.config import settings
from app.ml.sentiment.preprocess import clean_text, rating_to_label, tokenize

log = logging.getLogger(__name__)
LABELS = ["negative", "neutral", "positive"]
MODEL_VERSION = "1.0.0"
DATASET_FILE = "womens_clothing_reviews.csv"
LR_FILE = "sentiment_tfidf_logreg.joblib"
NB_FILE = "sentiment_tfidf_cnb.joblib"
META_FILE = "sentiment_meta.json"
SPLIT_FILE = "sentiment_split.json"


def load_dataset(path: Path | None = None) -> pd.DataFrame:
    """Load the Kaggle Women's E-Commerce Clothing Reviews CSV, clean it and attach labels."""
    path = path or settings.DATASET_DIR / DATASET_FILE
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}. See backend/datasets/README.md")
    df = pd.read_csv(path)
    df = df.rename(columns={df.columns[0]: "row_id"}) if df.columns[0].startswith("Unnamed") else df
    if "row_id" not in df.columns:
        df["row_id"] = np.arange(len(df))
    df["Title"] = df.get("Title", pd.Series(dtype=str)).fillna("")
    df = df.dropna(subset=["Review Text", "Rating"])
    df["Rating"] = df["Rating"].astype(int)
    df = df[df["Rating"].between(1, 5)]
    df["text"] = (df["Title"].astype(str) + ". " + df["Review Text"].astype(str)).str.strip(". ")
    df["clean"] = df["text"].map(clean_text)
    df = df[df["clean"].str.len() >= 3]
    before = len(df)
    df = df.drop_duplicates(subset=["clean"])
    log.info("dropped %d duplicate reviews", before - len(df))
    df["label"] = df["Rating"].map(rating_to_label)
    return df.reset_index(drop=True)


def _vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(tokenizer=tokenize, preprocessor=None, lowercase=False, token_pattern=None,
                           ngram_range=(1, 2), min_df=2, max_df=0.9, sublinear_tf=True, max_features=80000)


@dataclass
class EvalResult:
    name: str
    metrics: dict
    latency_ms: float


def evaluate(name: str, model: Pipeline, x_test: pd.Series, y_test: pd.Series) -> EvalResult:
    t0 = time.perf_counter()
    y_pred = model.predict(x_test)
    latency = (time.perf_counter() - t0) * 1000 / max(1, len(x_test))
    p, r, f, _ = precision_recall_fscore_support(y_test, y_pred, labels=LABELS, average="macro", zero_division=0)
    pw, rw, fw, _ = precision_recall_fscore_support(y_test, y_pred, labels=LABELS, average="weighted",
                                                    zero_division=0)
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision_macro": round(float(p), 4), "recall_macro": round(float(r), 4), "f1_macro": round(float(f), 4),
        "precision_weighted": round(float(pw), 4), "recall_weighted": round(float(rw), 4),
        "f1_weighted": round(float(fw), 4),
        "labels": LABELS,
        "confusion_matrix": confusion_matrix(y_test, y_pred, labels=LABELS).tolist(),
        "classification_report": classification_report(y_test, y_pred, labels=LABELS, output_dict=True,
                                                       zero_division=0),
        "test_size": int(len(x_test)),
    }
    return EvalResult(name, metrics, round(latency, 4))


def train(dataset_path: Path | None = None, out_dir: Path | None = None, quick: bool = False) -> dict:
    out_dir = out_dir or settings.MODEL_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    df = load_dataset(dataset_path)
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df["label"])
    log.info("train=%d test=%d", len(train_df), len(test_df))

    lr = Pipeline([("tfidf", _vectorizer()),
                   ("clf", LogisticRegression(max_iter=3000, class_weight="balanced", solver="lbfgs"))])
    t0 = time.perf_counter()
    if quick:
        lr.set_params(clf__C=2.0).fit(train_df["clean"], train_df["label"])
        best_c = 2.0
    else:
        grid = GridSearchCV(lr, {"clf__C": [0.5, 1.0, 2.0, 4.0]}, scoring="f1_macro", cv=3, n_jobs=-1)
        grid.fit(train_df["clean"], train_df["label"])
        lr, best_c = grid.best_estimator_, grid.best_params_["clf__C"]
    lr_train_s = time.perf_counter() - t0

    nb = Pipeline([("tfidf", _vectorizer()), ("clf", ComplementNB(alpha=0.5))])
    t0 = time.perf_counter()
    nb.fit(train_df["clean"], train_df["label"])
    nb_train_s = time.perf_counter() - t0

    lr_eval = evaluate("TF-IDF + Logistic Regression", lr, test_df["clean"], test_df["label"])
    nb_eval = evaluate("TF-IDF + Complement Naive Bayes", nb, test_df["clean"], test_df["label"])

    joblib.dump(lr, out_dir / LR_FILE, compress=3)
    joblib.dump(nb, out_dir / NB_FILE, compress=3)
    trained_at = datetime.now(timezone.utc).isoformat()
    meta = {
        "version": MODEL_VERSION, "trained_at": trained_at, "dataset": DATASET_FILE,
        "dataset_size": int(len(df)), "train_size": int(len(train_df)), "test_size": int(len(test_df)),
        "label_distribution": df["label"].value_counts().to_dict(),
        "models": {
            "logreg": {"name": lr_eval.name, "file": LR_FILE, "metrics": lr_eval.metrics,
                       "latency_ms": lr_eval.latency_ms, "train_seconds": round(lr_train_s, 2),
                       "params": {"C": best_c, "ngram_range": [1, 2], "class_weight": "balanced"}},
            "cnb": {"name": nb_eval.name, "file": NB_FILE, "metrics": nb_eval.metrics,
                    "latency_ms": nb_eval.latency_ms, "train_seconds": round(nb_train_s, 2),
                    "params": {"alpha": 0.5}},
        },
        "active_model": "logreg",
    }
    (out_dir / META_FILE).write_text(json.dumps(meta, indent=2))
    (out_dir / SPLIT_FILE).write_text(json.dumps({"test_row_ids": test_df["row_id"].astype(int).tolist()}))
    return meta


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO)
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="skip hyper-parameter search")
    args = ap.parse_args()
    m = train(quick=args.quick)
    for key, info in m["models"].items():
        mm = info["metrics"]
        print(f"{info['name']}: acc={mm['accuracy']} f1_macro={mm['f1_macro']} latency={info['latency_ms']}ms")
