"""Emit oracleDoc78.gen.ts from oracleDoc78.json"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(r"d:\WEB\WEB GAME")
SRC = ROOT / "server" / "src" / "oracleDoc78.json"
OUT = ROOT / "server" / "src" / "oracleDoc78.gen.ts"

MAJ = [
    "fool",
    "magician",
    "priestess",
    "empress",
    "emperor",
    "hierophant",
    "lovers",
    "chariot",
    "strength",
    "hermit",
    "wheel",
    "justice",
    "hanged",
    "death",
    "temperance",
    "devil",
    "tower",
    "star",
    "moon",
    "sun",
    "judgement",
    "world",
]


def pack(c: dict) -> dict:
    return {
        "upright": c["upright"],
        "reversed": c["reversed"],
        "keywords": c["keywords"],
        "notes": c.get("notes") or "",
        "citations": c.get("citations") or "",
    }


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    lines: list[str] = [
        "/** Auto-generated from TAROT – Ý nghĩa 78 lá bài (156 trang). */",
        "/** Re-run: py -3 scripts/parse-tarot-78-pdf.py && py -3 scripts/emit-oracle-doc78.py */",
        "",
        "export type DocMeaningRow = {",
        "  upright: string;",
        "  reversed: string;",
        "  keywords: string[];",
        "  notes?: string;",
        "  citations?: string;",
        "};",
        "",
        "function row(r: DocMeaningRow): DocMeaningRow {",
        "  return r;",
        "}",
        "",
        "export const DOC_MAJOR_MEANINGS: Record<string, DocMeaningRow> = {",
    ]
    for k in MAJ:
        payload = json.dumps(pack(data[k]), ensure_ascii=False)
        lines.append(f"  {json.dumps(k)}: row({payload}),")
    lines.append("};")
    lines.append("")
    lines.append("export const DOC_MINOR_MEANINGS: Record<string, DocMeaningRow> = {")
    for suit in ["wands", "cups", "swords", "pentacles"]:
        for n in range(1, 15):
            k = f"{suit}_{n}"
            payload = json.dumps(pack(data[k]), ensure_ascii=False)
            lines.append(f"  {json.dumps(k)}: row({payload}),")
    lines.append("};")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("wrote", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
