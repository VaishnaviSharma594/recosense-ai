import hashlib
import re
import unicodedata


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^\w\s-]", "", value.lower())
    return re.sub(r"[-\s_]+", "-", value).strip("-")[:200]


def content_hash(*parts: str | int | None) -> str:
    joined = "|".join("" if p is None else str(p).strip().lower() for p in parts)
    return hashlib.sha256(joined.encode()).hexdigest()
