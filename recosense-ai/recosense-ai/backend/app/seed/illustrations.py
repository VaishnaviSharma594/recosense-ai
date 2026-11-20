"""Generates clean, consistent flat product illustrations (SVG) for the sample catalogue.

Using locally generated artwork avoids hot-linking third-party photos whose licences or URLs may
change. Admins can replace any product image with a real photo URL from the admin panel.
"""
from pathlib import Path


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _mix(h: str, other: str, t: float) -> str:
    a, b = _hex_to_rgb(h), _hex_to_rgb(other)
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(a, b))


def _luma(h: str) -> float:
    r, g, b = _hex_to_rgb(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


SHAPES: dict[str, str] = {
    "dress_a": """<path d="M262 118h20l14 52q4 8 8 0l14-52h20l12 112q3 30-8 58l86 320q-128 44-256 0l86-320q-11-28-8-58z" fill="{c}"/>
<path d="M244 280h112v22H244z" fill="{d}"/><path d="M300 302v330" stroke="{d}" stroke-width="3" opacity=".25"/>
<path d="M160 618q140 40 280 0" stroke="{d}" stroke-width="6" fill="none" opacity=".35"/>""",
    "dress_wrap": """<path d="M262 118h22l16 60 16-60h22l18 70 40 42-28 26-24-22 4 54 90 320q-136 44-272 0l90-320 4-54-24 22-28-26 40-42z" fill="{c}"/>
<path d="M284 118l58 170M316 118l-60 172" stroke="{d}" stroke-width="5" opacity=".45"/>
<circle cx="236" cy="320" r="7" fill="{d}"/><circle cx="364" cy="320" r="7" fill="{d}"/>
<circle cx="300" cy="460" r="9" fill="{l}" opacity=".7"/><circle cx="250" cy="540" r="9" fill="{l}" opacity=".7"/><circle cx="350" cy="560" r="9" fill="{l}" opacity=".7"/><circle cx="210" cy="600" r="9" fill="{l}" opacity=".7"/><circle cx="390" cy="610" r="9" fill="{l}" opacity=".7"/>""",
    "dress_maxi": """<path d="M266 108h18l16 50 16-50h18l10 120q2 26-6 50l76 400q-114 40-228 0l76-400q-8-24-6-50z" fill="{c}"/>
<path d="M232 380q68 22 136 0M216 500q84 26 168 0" stroke="{d}" stroke-width="5" fill="none" opacity=".4"/>
<path d="M248 270h104" stroke="{d}" stroke-width="10"/>""",
    "dress_slip": """<path d="M268 110l6 0 10 70q16 14 32 0l10-70h6l14 130q4 30-4 60l58 320q-104 34-208 0l58-320q-8-30-4-60z" fill="{c}"/>
<path d="M248 300q52 20 104 0" stroke="{l}" stroke-width="4" fill="none" opacity=".6"/>
<path d="M270 330l-30 270M330 330l30 270" stroke="{l}" stroke-width="3" opacity=".35"/>""",
    "dress_bodycon": """<path d="M250 120h28q22 26 44 0h28l26 26-18 70-14-4 8 70-10 340q-80 26-160 0l-10-340 8-70-14 4-18-70z" fill="{c}"/>
<path d="M240 260v350M270 250v370M300 250v374M330 250v370M360 260v350" stroke="{d}" stroke-width="3" opacity=".22"/>""",
    "tee": """<path d="M212 150l56-24q32 34 64 0l56 24 74 82-50 40-30-28v318H218V244l-30 28-50-40z" fill="{c}"/>
<path d="M268 126q32 34 64 0" stroke="{d}" stroke-width="8" fill="none"/><path d="M218 540h164" stroke="{d}" stroke-width="5" opacity=".35"/>""",
    "tank": """<path d="M244 120h30q26 70 52 0h30l10 100q22 30 22 60v290H212V280q0-30 22-60z" fill="{c}"/>
<path d="M274 120q26 70 52 0" stroke="{d}" stroke-width="6" fill="none"/><path d="M212 300h176M212 330h176M212 360h176" stroke="{d}" stroke-width="2" opacity=".25"/>""",
    "knit": """<path d="M206 148l60-22q34 26 68 0l60 22 52 120 30 230-56 12-34-210v290H210V300l-34 210-56-12 30-230z" fill="{c}"/>
<path d="M266 126q34 26 68 0" stroke="{d}" stroke-width="12" fill="none"/>
<path d="M210 560h180M120 498l56 12M424 510l56-12" stroke="{d}" stroke-width="12" opacity=".5"/>
<path d="M300 200v330M260 200v330M340 200v330" stroke="{d}" stroke-width="4" opacity=".2" stroke-dasharray="10 8"/>""",
    "blouse_v": """<path d="M214 150l58-22 28 70 28-70 58 22 66 110 10 40-60 8-34-70v330H224V268l-34 70-60-8 10-40z" fill="{c}"/>
<path d="M272 128l28 70 28-70" stroke="{d}" stroke-width="6" fill="none"/>
<path d="M130 300l60 8M410 308l60-8" stroke="{d}" stroke-width="8" opacity=".4"/>
<path d="M224 330q76 22 152 0" stroke="{l}" stroke-width="4" fill="none" opacity=".6"/>""",
    "shirt": """<path d="M214 148l52-20 34 40 34-40 52 20 46 104 26 248-48 10-28-200v290H218V310l-28 200-48-10 26-248z" fill="{c}"/>
<path d="M266 128l34 40-22 30-30-46zM334 128l-34 40 22 30 30-46z" fill="{d}" opacity=".55"/>
<path d="M300 168v432" stroke="{d}" stroke-width="3" opacity=".5"/>
<circle cx="300" cy="230" r="5" fill="{d}"/><circle cx="300" cy="300" r="5" fill="{d}"/><circle cx="300" cy="370" r="5" fill="{d}"/><circle cx="300" cy="440" r="5" fill="{d}"/><circle cx="300" cy="510" r="5" fill="{d}"/>
<path d="M232 260h44v40h-44z" fill="none" stroke="{d}" stroke-width="3" opacity=".5"/>""",
    "jeans_skinny": """<path d="M220 130h160l6 80 -18 450h-62l-6-400-6 400h-62l-18-450z" fill="{c}"/>
<path d="M220 156h166" stroke="{d}" stroke-width="6"/><path d="M300 156v110" stroke="{d}" stroke-width="3"/>
<path d="M232 170q20 40 50 40M368 170q-20 40-50 40" stroke="{d}" stroke-width="3" fill="none"/>
<path d="M248 300l12 360M352 300l-12 360" stroke="{l}" stroke-width="2" opacity=".45" stroke-dasharray="6 6"/>""",
    "jeans_straight": """<path d="M214 130h172l10 90 4 440h-86l-14-400-14 400h-86l4-440z" fill="{c}"/>
<path d="M214 156h172" stroke="{d}" stroke-width="6"/><path d="M300 156v110" stroke="{d}" stroke-width="3"/>
<path d="M228 170q22 44 56 44M372 170q-22 44-56 44" stroke="{d}" stroke-width="3" fill="none"/>
<path d="M240 300l2 360M360 300l-2 360" stroke="{l}" stroke-width="2" opacity=".45" stroke-dasharray="6 6"/>""",
    "jeans_wide": """<path d="M216 130h168l12 100 46 430h-118l-24-390-24 390H158l46-430z" fill="{c}"/>
<path d="M216 156h168" stroke="{d}" stroke-width="6"/><path d="M300 156v110" stroke="{d}" stroke-width="3"/>
<path d="M230 170q22 44 56 44M370 170q-22 44-56 44" stroke="{d}" stroke-width="3" fill="none"/>
<path d="M236 300l-40 360M364 300l40 360" stroke="{l}" stroke-width="2" opacity=".45" stroke-dasharray="6 6"/>""",
    "sneaker": """<path d="M110 470q6-80 100-96l78-46q40-18 64 12l44 62q84 8 98 60l4 30H110z" fill="{c}"/>
<path d="M104 492h390q8 0 8 10v14q0 10-10 10H112q-10 0-10-10v-14q0-10 2-10z" fill="{d}"/>
<path d="M248 360l40 30M270 346l40 30M292 334l40 30" stroke="{l}" stroke-width="6" stroke-linecap="round"/>
<path d="M150 450q60-20 120 0" stroke="{d}" stroke-width="4" fill="none" opacity=".45"/>""",
    "heel": """<path d="M150 470q70-6 120-60 40-44 82-24l100 60q24 18 6 34l-78 4-30-8-150 20q-50 6-50-26z" fill="{c}"/>
<path d="M428 500l-14 110h-14l-6-100z" fill="{d}"/><path d="M150 496q90-10 160-6" stroke="{d}" stroke-width="5" fill="none"/>""",
    "flat": """<path d="M120 470q10-56 90-62l200-8q84 4 92 50 4 32-30 40H150q-36-2-30-20z" fill="{c}"/>
<path d="M118 490h372" stroke="{d}" stroke-width="10" stroke-linecap="round"/>
<ellipse cx="200" cy="430" rx="34" ry="14" fill="{l}" opacity=".75"/>""",
    "boot": """<path d="M230 170h120l10 250q90 6 116 50l6 40H170l14-80z" fill="{c}"/>
<path d="M166 500h330v26H166z" fill="{d}"/><path d="M238 260h108" stroke="{d}" stroke-width="16" opacity=".55"/>
<path d="M232 180h116" stroke="{l}" stroke-width="6" opacity=".6"/>""",
    "bag": """<path d="M220 260q0-110 80-110t80 110" stroke="{d}" stroke-width="16" fill="none"/>
<path d="M160 260h280l30 340q2 20-20 20H150q-22 0-20-20z" fill="{c}"/>
<path d="M160 320h280" stroke="{d}" stroke-width="5" opacity=".4"/><rect x="282" y="306" width="36" height="28" rx="6" fill="{l}"/>""",
    "watch": """<rect x="260" y="110" width="80" height="530" rx="30" fill="{d}"/>
<circle cx="300" cy="375" r="118" fill="{c}"/><circle cx="300" cy="375" r="96" fill="#ffffff"/>
<path d="M300 375v-62M300 375l44 26" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
<circle cx="300" cy="375" r="8" fill="#0f172a"/><rect x="414" y="360" width="22" height="30" rx="6" fill="{c}"/>""",
    "sunglasses": """<path d="M120 330h360" stroke="{d}" stroke-width="12"/>
<path d="M140 330h140q6 0 6 8 0 90-80 92-70-2-72-92 0-8 6-8z" fill="{c}"/><path d="M320 330h140q6 0 6 8-2 90-72 92-80-2-80-92 0-8 6-8z" fill="{c}"/>
<path d="M286 342q14-14 28 0" stroke="{d}" stroke-width="10" fill="none"/>
<path d="M170 350q20 30 40 34M350 350q20 30 40 34" stroke="#ffffff" stroke-width="8" opacity=".4" fill="none"/>""",
    "scarf": """<path d="M210 140q90-30 180 0 20 120-10 230 40 120 10 260l-60 0q30-130-10-250-30 120 0 250h-60q-34-150 0-260-40-110-50-230z" fill="{c}"/>
<path d="M230 200q70-20 140 0M232 260q68-18 136 0" stroke="{l}" stroke-width="6" fill="none" opacity=".7"/>
<path d="M276 630v26M296 630v26M316 630v26M336 630v26M216 630v26M236 630v26" stroke="{d}" stroke-width="4"/>""",
    "earrings": """<path d="M226 170q0-30 30-30M374 170q0-30-30-30" stroke="{d}" stroke-width="8" fill="none"/>
<circle cx="226" cy="190" r="12" fill="{d}"/><circle cx="374" cy="190" r="12" fill="{d}"/>
<path d="M226 202v120M374 202v120" stroke="{d}" stroke-width="4"/>
<circle cx="226" cy="370" r="54" fill="{c}" stroke="{d}" stroke-width="3"/><circle cx="374" cy="370" r="54" fill="{c}" stroke="{d}" stroke-width="3"/>
<circle cx="210" cy="352" r="14" fill="#ffffff" opacity=".7"/><circle cx="358" cy="352" r="14" fill="#ffffff" opacity=".7"/>""",
    "belt": """<path d="M90 380q210-90 420 0" stroke="{c}" stroke-width="64" fill="none"/>
<rect x="250" y="300" width="100" height="84" rx="12" fill="none" stroke="{d}" stroke-width="12"/>
<path d="M300 300v84" stroke="{d}" stroke-width="8"/><circle cx="420" cy="368" r="7" fill="{d}"/><circle cx="460" cy="384" r="7" fill="{d}"/>""",
}


def render(style: str, colour_hex: str) -> str:
    c = colour_hex
    # Very light garments need a darker outline tone to stay visible.
    dark_mix = 0.45 if _luma(c) > 200 else 0.3
    d, l = _mix(c, "#0f172a", dark_mix), _mix(c, "#ffffff", 0.55)
    bg1, bg2 = _mix(c, "#ffffff", 0.88), _mix(c, "#f1f5f9", 0.94)
    body = SHAPES[style].format(c=c, d=d, l=l)
    outline = f' stroke="{d}" stroke-width="3" stroke-linejoin="round"' if _luma(c) > 215 else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" role="img">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0f172a" flood-opacity=".14"/></filter></defs>
<rect width="600" height="750" fill="url(#bg)"/>
<ellipse cx="300" cy="676" rx="170" ry="16" fill="#0f172a" opacity=".06"/>
<g filter="url(#sh)"{outline}>{body}</g>
</svg>"""


def write_all(products: list[tuple[str, str, str]], out_dir: Path) -> None:
    """products: list of (slug, style, hex)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for slug, style, hex_ in products:
        (out_dir / f"{slug}.svg").write_text(render(style, hex_))
