"""Aspect extraction for fashion reviews.

Pipeline: review -> sentences -> clauses (split on contrast words like "but"/"however") ->
aspect detection with a curated fashion-domain lexicon -> each clause is scored by the trained
sentiment model blended with a small opinion lexicon (negation-aware). See predictor.analyze().
"""
import re

ASPECT_LABELS = {
    "fabric_quality": "Fabric quality",
    "fit": "Fit & sizing",
    "comfort": "Comfort",
    "design": "Design & style",
    "color": "Colour",
    "length": "Length",
    "value": "Value for money",
    "durability": "Durability & washing",
}

ASPECT_TERMS: dict[str, list[str]] = {
    "fabric_quality": ["fabric", "material", "quality", "cotton", "linen", "silk", "silky", "polyester", "rayon",
                       "wool", "denim", "knit", "texture", "thin", "thick", "sheer", "see through", "see-through",
                       "flimsy", "well made", "stitching", "seams", "lining", "lined", "scratchy"],
    "fit": ["fit", "fits", "fitting", "fitted", "size", "sizes", "sizing", "sized", "runs small", "runs large",
            "runs big", "tight", "loose", "snug", "baggy", "boxy", "true to size", "tts", "waist", "bust",
            "shoulders", "hips", "roomy"],
    "comfort": ["comfortable", "comfy", "comfort", "cozy", "cosy", "soft", "breathable", "uncomfortable",
                "itchy", "itch", "stretchy", "stretch"],
    "design": ["design", "style", "stylish", "pattern", "print", "silhouette", "beautiful", "gorgeous", "cute",
               "pretty", "elegant", "flattering", "unflattering", "details", "detail", "embroidery", "neckline",
               "looks", "look", "adorable", "chic", "classy", "frumpy"],
    "color": ["color", "colors", "colour", "colours", "shade", "hue", "vibrant", "muted", "dye"],
    "length": ["length", "hem", "cropped", "midi", "maxi", "too long", "too short", "hits at", "hit at"],
    "value": ["price", "priced", "pricey", "price point", "worth the price", "worth the money", "for the money",
              "worth every penny", "value", "expensive", "overpriced", "bargain", "steal", "full price"],
    "durability": ["wash", "washed", "washing", "shrink", "shrank", "shrunk", "pilling", "pilled", "pills",
                   "fade", "faded", "ripped", "tear", "torn", "hole", "durable", "fell apart", "unraveled"],
}

_ASPECT_PATTERNS = {
    a: re.compile(r"\b(" + "|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True)) + r")\b")
    for a, terms in ASPECT_TERMS.items()
}

# Opinion lexicon used to sharpen clause-level polarity (model output is the primary signal).
POSITIVE_WORDS = set("""love loved lovely great excellent perfect perfectly beautiful gorgeous amazing awesome
nice soft comfortable comfy flattering cute pretty elegant fantastic wonderful stunning quality well
favorite favourite recommend happy pleased impressed best good fine true flatters classy chic vibrant
durable sturdy worth bargain compliments glad""".split())
NEGATIVE_WORDS = set("""bad poor terrible awful horrible disappointing disappointed disappointment cheap
flimsy itchy scratchy unflattering frumpy boxy baggy sheer thin tight wrong returned returning return
ugly weird odd strange worse worst unfortunately sadly overpriced shrunk shrank faded pilled pilling
ripped torn huge tiny awkward uncomfortable see-through""".split())
NEGATIVE_PHRASES = ["runs small", "runs large", "runs big", "too small", "too big", "too tight", "too loose",
                    "too short", "too long", "too thin", "see through", "fell apart", "not worth",
                    "sent it back", "going back", "did not fit", "does not fit", "not flattering"]
POSITIVE_PHRASES = ["true to size", "fits perfectly", "fits great", "well made", "worth every", "so soft"]
NEGATORS = {"not", "no", "never", "n't", "hardly", "barely", "without"}

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
_CLAUSE_SPLIT = re.compile(r"\s*(?:,?\s*\bbut\b|\bhowever\b|\balthough\b|\bthough\b|\byet\b|\bexcept\b|;)\s*",
                           re.IGNORECASE)


def split_clauses(text: str) -> list[str]:
    clauses: list[str] = []
    for sent in _SENT_SPLIT.split(text.strip()):
        for c in _CLAUSE_SPLIT.split(sent):
            c = c.strip(" ,.-")
            if len(c) >= 3:
                clauses.append(c)
    return clauses


def detect_aspects(clause: str) -> list[str]:
    low = clause.lower()
    return [a for a, pat in _ASPECT_PATTERNS.items() if pat.search(low)]


def lexicon_score(clause: str) -> float:
    """Return polarity in [-1, 1] from the opinion lexicon, flipping words preceded by a negator."""
    low = clause.lower().replace("n't", " not")
    pos = sum(low.count(p) for p in POSITIVE_PHRASES)
    neg = sum(low.count(p) for p in NEGATIVE_PHRASES)
    tokens = re.findall(r"[a-z\-]+", low)
    for i, tok in enumerate(tokens):
        negated = any(t in NEGATORS for t in tokens[max(0, i - 3):i])
        if tok in POSITIVE_WORDS:
            if negated:
                neg += 1
            else:
                pos += 1
        elif tok in NEGATIVE_WORDS:
            if negated:
                pos += 0.5
            else:
                neg += 1
    total = pos + neg
    return 0.0 if total == 0 else (pos - neg) / total
