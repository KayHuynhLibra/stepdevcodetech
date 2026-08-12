"""Extract featured card images from TAROT 78-lá PDF → client/public/assets/oracle/tarot/*.jpg"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(r"d:\WEB\WEB GAME")
PDF = ROOT / "tmp-tarot-78.pdf"
OUT = ROOT / "client" / "public" / "assets" / "oracle" / "tarot"
MANIFEST = ROOT / "scripts" / "tarot-pdf-image-manifest.json"

NAME_TO_KEY = {
    "THE FOOL": "fool",
    "THE MAGICIAN": "magician",
    "THE HIGH PRIESTESS": "priestess",
    "THE EMPRESS": "empress",
    "THE EMPEROR": "emperor",
    "THE HIEROPHANT": "hierophant",
    "THE LOVERS": "lovers",
    "THE CHARIOT": "chariot",
    "STRENGTH": "strength",
    "THE HERMIT": "hermit",
    "THE WHEEL OF FORTUNE": "wheel",
    "JUSTICE": "justice",
    "THE HANGED MAN": "hanged",
    "DEATH": "death",
    "TEMPERANCE": "temperance",
    "THE DEVIL": "devil",
    "THE TOWER": "tower",
    "THE STAR": "star",
    "THE MOON": "moon",
    "THE SUN": "sun",
    "JUDGEMENT": "judgement",
    "JUDGMENT": "judgement",
    "THE WORLD": "world",
}
SUIT_MAP = {
    "WANDS": "wands",
    "CUPS": "cups",
    "SWORDS": "swords",
    "PENTACLES": "pentacles",
    "COINS": "pentacles",
}
RANK_MAP = {
    "ACE": 1,
    "TWO": 2,
    "THREE": 3,
    "FOUR": 4,
    "FIVE": 5,
    "SIX": 6,
    "SEVEN": 7,
    "EIGHT": 8,
    "NINE": 9,
    "TEN": 10,
    "PAGE": 11,
    "KNIGHT": 12,
    "QUEEN": 13,
    "KING": 14,
}


def to_key(name: str) -> str | None:
    n = re.sub(r"\s+", " ", name.upper().strip())
    if n in NAME_TO_KEY:
        return NAME_TO_KEY[n]
    m = re.match(
        r"(ACE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|PAGE|KNIGHT|QUEEN|KING) OF (WANDS|CUPS|SWORDS|PENTACLES|COINS)",
        n,
    )
    if m:
        return f"{SUIT_MAP[m.group(2)]}_{RANK_MAP[m.group(1)]}"
    return None


def largest_image_name(page) -> str | None:
    content = page.get_contents()
    if content is None:
        return None
    if isinstance(content, list):
        data = b"".join(c.get_data() for c in content)
    else:
        data = content.get_data()
    text = data.decode("latin1", errors="ignore")
    ops = re.findall(
        r"([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+cm\s*/(Im\d+)\s+Do",
        text,
    )
    if not ops:
        return None
    ranked = []
    for a, b, c, d, e, f, im in ops:
        area = abs(float(a) * float(d))
        ranked.append((area, im))
    ranked.sort(reverse=True)
    return ranked[0][1]


def main() -> None:
    if not PDF.exists():
        raise SystemExit(f"Missing PDF: {PDF}")
    OUT.mkdir(parents=True, exist_ok=True)
    r = PdfReader(str(PDF))

    # Build page → card key from headers
    page_keys: list[tuple[int, str, str]] = []
    for i, p in enumerate(r.pages):
        t = p.extract_text() or ""
        m = re.search(
            r"Ý NGHĨA LÁ BÀI\s+"
            r"("
            r"THE FOOL|THE MAGICIAN|THE HIGH PRIESTESS|THE EMPRESS|THE EMPEROR|"
            r"THE HIEROPHANT|THE LOVERS|THE CHARIOT|STRENGTH|THE HERMIT|"
            r"THE WHEEL OF FORTUNE|JUSTICE|THE HANGED MAN|DEATH|TEMPERANCE|"
            r"THE DEVIL|THE TOWER|THE STAR|THE MOON|THE SUN|JUDGEMENT|JUDGMENT|THE WORLD|"
            r"(?:ACE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|PAGE|KNIGHT|QUEEN|KING)"
            r" OF (?:WANDS|CUPS|SWORDS|PENTACLES|COINS)"
            r")",
            t,
        )
        if not m:
            continue
        name = m.group(1).strip()
        key = to_key(name)
        if key:
            page_keys.append((i, name, key))

    print("header pages", len(page_keys))

    # Image name → bytes from any page (shared XObjects)
    # Prefer extracting from the page that features the card
    import json

    manifest = []
    seen_keys: set[str] = set()
    for page_i, name, key in page_keys:
        if key in seen_keys:
            continue
        page = r.pages[page_i]
        im_name = largest_image_name(page)
        if not im_name:
            print("NO IMAGE", page_i + 1, name)
            continue
        # find matching page.images entry (names are like Im4.jpg)
        data = None
        size = None
        want = {im_name, f"{im_name}.jpg", f"/{im_name}", im_name.lstrip("/")}
        for im in page.images:
            n = im.name.replace("/", "")
            if n in want or n.replace(".jpg", "") in want:
                data = im.data
                size = im.image.size if im.image else None
                break
        if data is None:
            # fallback: XObject raw DCT bytes
            try:
                xobj = page["/Resources"]["/XObject"].get_object()
                o = xobj[f"/{im_name}"]
                data = o.get_data()
                size = (int(o.get("/Width") or 0), int(o.get("/Height") or 0))
            except Exception as e:
                print("MISS bytes", page_i + 1, name, im_name, e)
                continue
        if data is None:
            print("MISS bytes", page_i + 1, name, im_name)
            continue
        dest = OUT / f"{key}.jpg"
        dest.write_bytes(data)
        seen_keys.add(key)
        manifest.append(
            {
                "key": key,
                "name": name,
                "page": page_i + 1,
                "xobject": im_name,
                "file": f"/assets/oracle/tarot/{key}.jpg",
                "bytes": len(data),
                "size": list(size) if size else None,
                "md5": hashlib.md5(data).hexdigest(),
            }
        )
        print("OK", key, im_name, size, dest.stat().st_size)

    expected = list(dict.fromkeys(NAME_TO_KEY.values()))
    for s in ["wands", "cups", "swords", "pentacles"]:
        for n in range(1, 15):
            expected.append(f"{s}_{n}")
    missing = [k for k in expected if k not in seen_keys]
    print("saved", len(seen_keys), "missing", missing)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("manifest", MANIFEST)


if __name__ == "__main__":
    main()
