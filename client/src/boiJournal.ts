import type { OracleDrawHistoryRow } from "./oracle";

const KEY = "boi-journal-v1";
const MAX = 15;

function readAll(): OracleDrawHistoryRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { rows?: OracleDrawHistoryRow[] };
    if (!Array.isArray(parsed?.rows)) return [];
    return parsed.rows.filter((r) => r && r.id && Array.isArray(r.cards));
  } catch {
    return [];
  }
}

function writeAll(rows: OracleDrawHistoryRow[]) {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, rows: rows.slice(0, MAX) }));
}

export function listGuestJournal(limit = 15): OracleDrawHistoryRow[] {
  return readAll().slice(0, Math.min(MAX, Math.max(1, limit)));
}

export function saveGuestJournal(row: OracleDrawHistoryRow): OracleDrawHistoryRow {
  const rows = readAll().filter((r) => r.id !== row.id);
  rows.unshift(row);
  writeAll(rows);
  return row;
}

export function updateGuestJournal(
  id: string,
  patch: { notes?: string; title?: string },
): OracleDrawHistoryRow | null {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const cur = { ...rows[idx]! };
  if (patch.notes !== undefined) cur.notes = patch.notes.trim().slice(0, 2000);
  if (patch.title !== undefined) {
    cur.title = patch.title.trim().slice(0, 120) || undefined;
  }
  rows[idx] = cur;
  writeAll(rows);
  return cur;
}

export function makeReadingTitle(
  question: string | undefined,
  spread: string | number,
): string {
  const q = (question ?? "").trim();
  if (q) {
    const words = q.split(/\s+/).slice(0, 5).join(" ");
    return words.length > 48 ? `${words.slice(0, 45)}…` : words;
  }
  const n = String(spread);
  if (n === "10") return "Trải Celtic Cross";
  if (n === "5") return "Trải 5 lá · Quan hệ";
  if (n === "3") return "Trải 3 lá · Thời gian";
  if (n === "1") return "Lá chủ";
  return `Trải ${n} lá`;
}
