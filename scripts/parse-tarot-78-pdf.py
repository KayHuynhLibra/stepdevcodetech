"""Parse tmp-tarot-78.txt → server/src/oracleDoc78.json (strict ALL-CAPS headers)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"d:\WEB\WEB GAME")
TEXT = ROOT / "tmp-tarot-78.txt"
OUT = ROOT / "server" / "src" / "oracleDoc78.json"

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

NEG_MARKERS = (
    "tiêu cực",
    "cảnh báo",
    "cảnh cáo",
    "không phải là một dấu hiệu tốt",
    "không mang đến tín hiệu tốt",
    "không mang thông điệp rõ ràng",
    "rủi ro",
    "thất bại",
    "chia ly",
    "phản bội",
    "hoang phí",
    "bế tắc",
    "lo lắng",
    "mất mát",
    "lừa",
    "nguy",
    "khó khăn",
    "chán nản",
    "sụp đổ",
    "tan vỡ",
    "thất vọng",
    "đau khổ",
    "bất an",
    "áp lực",
    "lẩn tránh",
)


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


def squash(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    s = re.sub(r"\[.*?\]", "", s)
    s = re.sub(r"^ôi\s+", "", s, flags=re.I)
    return s.strip(" -–—")


def clip(s: str, n: int, *, keep_newlines: bool = False) -> str:
    if keep_newlines:
        s = re.sub(r"[ \t]+", " ", s or "")
        s = re.sub(r"\n{3,}", "\n\n", s).strip()
        s = re.sub(r"\[.*?\]", "", s)
        s = s.strip(" -–—")
    else:
        s = squash(s)
    if len(s) <= n:
        return s
    cut = s[: n - 1]
    for sep in [". ", "! ", "? ", "… ", "\n"]:
        i = cut.rfind(sep)
        if i > n * 0.55:
            return cut[: i + (0 if sep == "\n" else 1)].strip()
    return cut.rsplit(" ", 1)[0].rstrip(",;:") + "…"


def extract_section(body: str, start_labels: list[str], end_labels: list[str]) -> str:
    start = None
    for lab in start_labels:
        m = re.search(lab, body, re.I | re.M)
        if m:
            start = m.end()
            break
    if start is None:
        return ""
    end = len(body)
    for lab in end_labels:
        m = re.search(lab, body[start:], re.I | re.M)
        if m:
            end = start + m.start()
            break
    return body[start:end]


def main() -> None:
    text = TEXT.read_text(encoding="utf-8")
    clean = re.sub(r"\n===== PAGE \d+ =====\n", "\n", text)
    clean = re.sub(r"[ \t]+", " ", clean)
    clean = re.sub(r"\n{3,}", "\n\n", clean)

    # Strict: only ALL-CAPS English card titles (PDF card chapter headers)
    pat = re.compile(
        r"(?m)^\s*Ý NGHĨA LÁ BÀI\s+"
        r"("
        r"THE FOOL|THE MAGICIAN|THE HIGH PRIESTESS|THE EMPRESS|THE EMPEROR|"
        r"THE HIEROPHANT|THE LOVERS|THE CHARIOT|STRENGTH|THE HERMIT|"
        r"THE WHEEL OF FORTUNE|JUSTICE|THE HANGED MAN|DEATH|TEMPERANCE|"
        r"THE DEVIL|THE TOWER|THE STAR|THE MOON|THE SUN|JUDGEMENT|JUDGMENT|THE WORLD|"
        r"(?:ACE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|PAGE|KNIGHT|QUEEN|KING)"
        r" OF (?:WANDS|CUPS|SWORDS|PENTACLES|COINS)"
        r")"
        r"(?:\s*[–—:\-]\s*([^\n]+))?",
    )
    matches = list(pat.finditer(clean))
    print("matches", len(matches))

    cards: dict[str, dict] = {}
    missing_names: list[str] = []

    for i, m in enumerate(matches):
        name = m.group(1).strip()
        tagline = squash(m.group(2) or "")
        # tagline may continue on next line for wrapped titles
        if not tagline or len(tagline) < 3:
            after = clean[m.end() : m.end() + 80]
            first = after.split("\n", 1)[0].strip()
            if first and not first.lower().startswith(("lá ", "the ", "ace ", "two ", "[", "tổng")):
                if re.match(r"^[A-ZÀ-Ỹa-zà-ỹ ,]+$", first) and len(first) < 40:
                    tagline = squash(first)

        key = to_key(name)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(clean)
        body = clean[start:end]
        if not key:
            missing_names.append(name)
            continue

        love = extract_section(
            body,
            [
                r"\nVề tình yêu\s*\n",
                r"\nVề tình yêu\s+",
                r"\nTình yêu:\s*",
            ],
            [
                r"\nVề công việc",
                r"\nCông việc:",
                r"\nVề tiền bạc",
                r"\nTiền bạc:",
                r"\nVề sức khỏe",
                r"\nSức khỏe:",
                r"\nÝ nghĩa lá",
                r"\nÝ nghĩa của lá",
                r"\nÝ nghĩa Temperance",
            ],
        )
        work = extract_section(
            body,
            [
                r"\nVề công việc\s*\n",
                r"\nVề công việc\s+",
                r"\nCông việc:\s*",
            ],
            [
                r"\nVề tiền bạc",
                r"\nTiền bạc:",
                r"\nVề tình yêu",
                r"\nTình yêu:",
                r"\nVề sức khỏe",
                r"\nSức khỏe:",
                r"\nÝ nghĩa lá",
                r"\nÝ nghĩa của lá",
                r"\nÝ nghĩa Temperance",
            ],
        )
        money = extract_section(
            body,
            [
                r"\nVề tiền bạc\s*\n",
                r"\nVề tiền bạc\s+",
                r"\nTiền bạc:\s*",
                r"\nTài chính:\s*",
            ],
            [
                r"\nVề sức khỏe",
                r"\nSức khỏe:",
                r"\nÝ nghĩa lá",
                r"\nÝ nghĩa của lá",
                r"\nÝ nghĩa Temperance",
            ],
        )
        health = extract_section(
            body,
            [
                r"\nVề sức khỏe\s*\n",
                r"\nVề sức khỏe\s+",
                r"\nSức khỏe:\s*",
            ],
            [
                r"\nÝ nghĩa lá",
                r"\nÝ nghĩa của lá",
                r"\nÝ nghĩa Temperance",
                r"\nÝ nghĩa lá Temperance",
            ],
        )
        overview = extract_section(
            body,
            [r"Tổng quan[^\n]*\n", r"Tổng quan:\s*"],
            [
                r"\nVề tình yêu",
                r"\nTình yêu:",
                r"\nVề công việc",
                r"\nCông việc:",
                r"\nÝ nghĩa lá",
                r"\nÝ nghĩa của lá",
                r"\nÝ nghĩa Temperance",
            ],
        )
        if not overview:
            # intro paragraphs before domains
            overview = extract_section(
                body,
                [r"^", r"Dẫn nhập:\s*"],
                [
                    r"\nVề tình yêu",
                    r"\nTình yêu:",
                    r"\nVề công việc",
                    r"\nCông việc:",
                    r"\nÝ nghĩa lá",
                    r"\nÝ nghĩa của lá",
                ],
            )

        xuoi = extract_section(
            body,
            [
                r"Ý nghĩa lá bài[^\n]{0,100}xuôi\s*\n",
                r"Ý nghĩa của lá bài[^\n]{0,100}xuôi\s*\n",
                r"Ý nghĩa lá Temperance bài xuôi\s*\n",
                r"Ý nghĩa Temperance bài xuôi\s*\n",
            ],
            [r"\nÝ NGHĨA LÁ BÀI"],
        )
        # Prefer content after the xuôi heading; drop image-description-only if too short
        upright_src = xuoi if len(squash(xuoi)) > 80 else (xuoi + " " + overview)
        upright = clip(upright_src, 780)
        if len(upright) < 80:
            upright = clip(overview or love or work, 780)

        neg_bits: list[str] = []
        for chunk in [overview, love, work, money, health]:
            for sent in re.split(r"(?<=[\.!?…])\s+", squash(chunk)):
                low = sent.lower()
                if any(w in low for w in NEG_MARKERS) and len(sent) > 35:
                    neg_bits.append(sent)
        seen: set[str] = set()
        neg: list[str] = []
        for s in neg_bits:
            k = s[:60]
            if k in seen:
                continue
            seen.add(k)
            neg.append(s)

        reversed_txt = clip(" ".join(neg[:4]), 780)
        if len(reversed_txt) < 80:
            reversed_txt = clip(
                "Khi năng lượng lá bị đảo / lệch: bớt hấp tấp, soi lại động cơ và các cảnh báo "
                "trong tình yêu–công việc–tiền bạc–sức khỏe trước khi quyết. "
                + " ".join(neg[:2]),
                780,
            )

        notes_parts: list[str] = []
        if tagline:
            notes_parts.append(f"Chủ đề: {tagline}")
        if love:
            notes_parts.append("Tình yêu: " + clip(love, 420))
        if work:
            notes_parts.append("Công việc: " + clip(work, 420))
        if money:
            notes_parts.append("Tiền bạc: " + clip(money, 360))
        if health:
            notes_parts.append("Sức khỏe: " + clip(health, 360))
        if not notes_parts and overview:
            notes_parts.append("Tổng quan: " + clip(overview, 900))
        notes = clip("\n".join(notes_parts), 1950, keep_newlines=True)

        kws: list[str] = []
        for part in re.split(r"[,/–—\-:]", tagline):
            p = part.strip().lower()
            if 2 <= len(p) <= 28:
                kws.append(p)
        if not kws:
            kws = [key.replace("_", " ")]
        kws = kws[:5]

        cards[key] = {
            "upright": upright,
            "reversed": reversed_txt,
            "keywords": kws,
            "notes": notes,
            "citations": "Tài liệu: TAROT – Ý nghĩa 78 lá bài (156 trang)",
            "tagline": tagline,
        }

    expected = list(dict.fromkeys(NAME_TO_KEY.values()))
    for s in ["wands", "cups", "swords", "pentacles"]:
        for n in range(1, 15):
            expected.append(f"{s}_{n}")
    miss_keys = [k for k in expected if k not in cards]
    empty_notes = [k for k, v in cards.items() if not v.get("notes")]
    short_up = [k for k, v in cards.items() if len(v.get("upright", "")) < 100]
    print(
        "parsed",
        len(cards),
        "missing names",
        missing_names,
        "missing keys",
        miss_keys,
        "empty notes",
        empty_notes,
        "short upright",
        short_up,
    )
    for k in ["fool", "magician", "cups_3", "swords_10", "pentacles_1", "wands_14", "queen" if False else "wands_13"]:
        c = cards.get(k, {})
        print(
            "====",
            k,
            "up",
            len(c.get("upright", "")),
            "rev",
            len(c.get("reversed", "")),
            "notes",
            len(c.get("notes", "")),
        )
        print(c.get("upright", "")[:180])
        print("NOTES", c.get("notes", "")[:120])

    OUT.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
