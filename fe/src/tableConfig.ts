/** Client mirror — kiểu xoay lá Tarot khi reveal + số lá đặt tối đa. */

export type RevealStyleId = "classic" | "fan" | "spiral";

export const REVEAL_STYLE_IDS: RevealStyleId[] = ["classic", "fan", "spiral"];

export const REVEAL_STYLE_LABELS: Record<RevealStyleId, string> = {
  classic: "Cổ điển — gom + xáo + lật",
  fan: "Quạt bài — trải quạt rồi rút",
  spiral: "Xoáy ốc — spiral rồi hiện lá",
};

/** Mặc định / fallback khi chưa có tableTiming từ server. */
export const DEFAULT_MAX_CARDS_PER_ROUND = 4;
export const MAX_CARDS_PER_ROUND_MIN = 1;
export const MAX_CARDS_PER_ROUND_MAX = 8;

export function normalizeRevealStyle(raw: unknown): RevealStyleId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return REVEAL_STYLE_IDS.includes(s as RevealStyleId)
    ? (s as RevealStyleId)
    : "classic";
}

export function normalizeMaxCardsPerRound(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_MAX_CARDS_PER_ROUND;
  return Math.max(
    MAX_CARDS_PER_ROUND_MIN,
    Math.min(MAX_CARDS_PER_ROUND_MAX, n),
  );
}

export interface TableTimingPublic {
  placingMs: number;
  revealingMs: number;
  payoutMs: number;
  revealStyle: RevealStyleId;
  maxCardsPerRound: number;
}
