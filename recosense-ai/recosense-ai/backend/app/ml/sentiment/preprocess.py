"""Text cleaning + tokenisation for review sentiment (NLTK tokenizer + negation marking).

Module-level functions are referenced by the pickled sklearn pipeline, so keep their names stable.
"""
import html
import re

from nltk.stem.snowball import SnowballStemmer
from nltk.tokenize import RegexpTokenizer

_TOKENIZER = RegexpTokenizer(r"[a-z]+(?:'[a-z]+)?|[.!?;,]")
_STEMMER = SnowballStemmer("english")

# Compact English stop-word list. Negations and intensifiers are deliberately KEPT because
# "not", "too", "very", "but" carry sentiment in fashion reviews ("too small", "not flattering").
STOPWORDS = frozenset("""a an the and or of to in on at for from by with as is are was were be been being am
it its it's this that these those i me my we our you your he she her his they them their there here
so than then just also would could should will can do does did have has had what which who whom
when where while about into over under again further once up down out off own same such only both each
""".split())
NEGATIONS = frozenset({"not", "no", "never", "nothing", "nor", "neither", "without", "hardly", "barely"})
PUNCT = frozenset(".!?;,")

_CONTRACTIONS = [
    (re.compile(r"\b(can)'?t\b"), "can not"), (re.compile(r"\bwon'?t\b"), "will not"),
    (re.compile(r"n't\b"), " not"), (re.compile(r"'re\b"), " are"), (re.compile(r"'ll\b"), " will"),
    (re.compile(r"'ve\b"), " have"), (re.compile(r"'m\b"), " am"), (re.compile(r"'d\b"), " would"),
]
_URL = re.compile(r"https?://\S+|www\.\S+")
_HTML_TAG = re.compile(r"<[^>]+>")
_NON_TEXT = re.compile(r"[^a-z'.!?;,\s]")
_REPEAT = re.compile(r"(.)\1{2,}")  # "sooooo" -> "soo"
_SPACES = re.compile(r"\s+")


def clean_text(text: str | None) -> str:
    """Lowercase, strip HTML/URLs/odd characters, expand contractions, normalise whitespace."""
    if not text:
        return ""
    t = html.unescape(str(text)).lower()
    t = t.replace("’", "'").replace("`", "'")
    t = _HTML_TAG.sub(" ", t)
    t = _URL.sub(" ", t)
    for pat, rep in _CONTRACTIONS:
        t = pat.sub(rep, t)
    t = _NON_TEXT.sub(" ", t)
    t = _REPEAT.sub(r"\1\1", t)
    return _SPACES.sub(" ", t).strip()


def tokenize(text: str) -> list[str]:
    """Tokenise already-cleaned text: stem, drop stop words, and mark up to 3 tokens after a
    negation with a NOT_ prefix (scope ends at punctuation)."""
    out: list[str] = []
    negate = 0
    for tok in _TOKENIZER.tokenize(text):
        if tok in PUNCT:
            negate = 0
            continue
        if tok in NEGATIONS:
            out.append("not")
            negate = 3
            continue
        if tok in STOPWORDS:
            continue
        stem = _STEMMER.stem(tok.replace("'", ""))
        if negate:
            out.append("NOT_" + stem)
            negate -= 1
        else:
            out.append(stem)
    return out


def rating_to_label(rating: int) -> str:
    if rating >= 4:
        return "positive"
    if rating == 3:
        return "neutral"
    return "negative"
