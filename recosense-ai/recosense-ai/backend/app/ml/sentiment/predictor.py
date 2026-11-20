"""Load the trained sentiment model and run review-level + aspect-level analysis."""
import json
import threading
import time
from dataclasses import dataclass, field

import joblib
import numpy as np

from app.core.config import settings
from app.ml.sentiment.aspects import ASPECT_LABELS, detect_aspects, lexicon_score, split_clauses
from app.ml.sentiment.preprocess import clean_text
from app.ml.sentiment.train import LR_FILE, META_FILE, MODEL_VERSION

MODEL_BLEND = 0.6  # clause polarity = 0.6 * model + 0.4 * opinion lexicon
NEUTRAL_BAND = 0.15


class ModelNotTrainedError(RuntimeError):
    pass


@dataclass
class AspectResult:
    aspect: str          # machine key, e.g. fabric_quality
    label: str           # display label
    sentiment: str       # positive | negative | neutral
    score: float
    snippet: str


@dataclass
class Analysis:
    label: str
    is_mixed: bool
    confidence: float
    score: float
    probs: dict[str, float]
    aspects: list[AspectResult] = field(default_factory=list)

    @property
    def overall(self) -> str:
        return "mixed" if self.is_mixed else self.label

    @property
    def positive_aspects(self) -> list[str]:
        return list(dict.fromkeys(a.label for a in self.aspects if a.sentiment == "positive"))

    @property
    def negative_aspects(self) -> list[str]:
        return list(dict.fromkeys(a.label for a in self.aspects if a.sentiment == "negative"))


class SentimentPredictor:
    def __init__(self):
        self._lock = threading.Lock()
        self.model = None
        self.meta: dict = {}

    @property
    def model_name(self) -> str:
        return "tfidf-logreg"

    @property
    def version(self) -> str:
        return self.meta.get("version", MODEL_VERSION)

    def is_ready(self) -> bool:
        return (settings.MODEL_DIR / LR_FILE).exists()

    def load(self, force: bool = False) -> None:
        with self._lock:
            if self.model is not None and not force:
                return
            path = settings.MODEL_DIR / LR_FILE
            if not path.exists():
                raise ModelNotTrainedError("Sentiment model has not been trained yet")
            self.model = joblib.load(path)
            meta_path = settings.MODEL_DIR / META_FILE
            self.meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    def _probs(self, cleaned: list[str]) -> np.ndarray:
        self.load()
        proba = self.model.predict_proba(cleaned)
        classes = list(self.model.classes_)
        order = [classes.index(c) for c in ("negative", "neutral", "positive")]
        return proba[:, order]

    def analyze_many(self, texts: list[str]) -> list[Analysis]:
        if not texts:
            return []
        cleaned = [clean_text(t) for t in texts]
        review_probs = self._probs(cleaned)

        # Clause-level pass for aspects (batched into a single predict call)
        clause_index: list[tuple[int, str, list[str]]] = []
        for i, t in enumerate(texts):
            for clause in split_clauses(t):
                aspects = detect_aspects(clause)
                if aspects:
                    clause_index.append((i, clause, aspects))
        clause_probs = self._probs([clean_text(c) for _, c, _ in clause_index]) if clause_index else np.empty((0, 3))

        results: list[Analysis] = []
        for i, p in enumerate(review_probs):
            neg, neu, pos = (float(x) for x in p)
            label = ("negative", "neutral", "positive")[int(np.argmax(p))]
            results.append(Analysis(label=label, is_mixed=False, confidence=round(max(neg, neu, pos), 4),
                                    score=round(pos - neg, 4),
                                    probs={"negative": round(neg, 4), "neutral": round(neu, 4),
                                           "positive": round(pos, 4)}))

        for (i, clause, aspects), p in zip(clause_index, clause_probs):
            model_score = float(p[2] - p[0])
            lex = lexicon_score(clause)
            score = MODEL_BLEND * model_score + (1 - MODEL_BLEND) * lex if lex else model_score
            sentiment = "positive" if score > NEUTRAL_BAND else "negative" if score < -NEUTRAL_BAND else "neutral"
            snippet = clause.strip()[:280]
            existing = {a.aspect: a for a in results[i].aspects}
            for a in aspects:
                prev = existing.get(a)
                # keep the strongest opinion per aspect within one review
                if prev and abs(prev.score) >= abs(score):
                    continue
                if prev:
                    results[i].aspects.remove(prev)
                ar = AspectResult(a, ASPECT_LABELS[a], sentiment, round(score, 4), snippet)
                results[i].aspects.append(ar)
                existing[a] = ar

        for r in results:
            has_pos = any(a.sentiment == "positive" and a.score > 0.25 for a in r.aspects)
            has_neg = any(a.sentiment == "negative" and a.score < -0.25 for a in r.aspects)
            r.is_mixed = has_pos and has_neg
        return results

    def analyze(self, text: str) -> tuple[Analysis, float]:
        t0 = time.perf_counter()
        res = self.analyze_many([text])[0]
        return res, round((time.perf_counter() - t0) * 1000, 2)


predictor = SentimentPredictor()
