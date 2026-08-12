"""Rewrite oracleMeanings.ts to use PDF-sourced DOC_* meanings."""
from __future__ import annotations

from pathlib import Path

P = Path(r"d:\WEB\WEB GAME\server\src\oracleMeanings.ts")
text = P.read_text(encoding="utf-8")
idx = text.find("const ZODIAC_ROWS")
if idx < 0:
    raise SystemExit("ZODIAC_ROWS not found")
tail = text[idx:].replace(
    "export const ORACLE_THEORY_SEED_VERSION = 2;",
    "export const ORACLE_THEORY_SEED_VERSION = 3;",
)
head = r'''/** Nghĩa lá Bói bài — 78 lá từ tài liệu PDF + chiêm tinh / note truyền thống. */

import {
  DOC_MAJOR_MEANINGS,
  DOC_MINOR_MEANINGS,
} from "./oracleDoc78.gen.js";

export type MeaningRow = {
  upright: string;
  reversed: string;
  keywords: string[];
  notes?: string;
  citations?: string;
};

type RowInput = Omit<MeaningRow, "citations"> & { citations: string };

const makeRow = (row: RowInput): MeaningRow => row;

export const MARSEILLE_CITATION = "Tarot de Marseille · biểu tượng cổ châu Âu";
export const THOTH_CITATION = "Thoth Crowley · Qabalah / astrology / alchemy";
const ZODIAC_CITATION = "Chiêm tinh Tây · 12 cung";

/** Rider–Waite 22 Major — nguồn: TAROT Ý nghĩa 78 lá bài (156 trang). */
export const MAJOR_MEANINGS: Record<string, MeaningRow> = DOC_MAJOR_MEANINGS;

/** Rider–Waite 56 Minor — nguồn: TAROT Ý nghĩa 78 lá bài (156 trang). */
export const MINOR_MEANINGS: Record<string, MeaningRow> = DOC_MINOR_MEANINGS;

'''
P.write_text(head + tail, encoding="utf-8")
print("wrote", P, P.stat().st_size)
