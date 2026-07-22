/**
 * Cấp độ chơi bài 1–99 theo số ván lifetime (`roundsPlayed`).
 * Công thức tích lũy: roundsToReach(L) = 5 × (L−1)²
 * → Lv.45 ≈ 9 680 (gần VIP 10k) · Lv.99 ≈ 48 020 ván.
 */

export const PLAY_LEVEL_MIN = 1;
export const PLAY_LEVEL_MAX = 99;

/** Số ván cần để ĐẠT cấp `level` (cấp 1 = 0). */
export function roundsToReachLevel(level: number): number {
  const L = Math.max(
    PLAY_LEVEL_MIN,
    Math.min(PLAY_LEVEL_MAX, Math.floor(level)),
  );
  if (L <= 1) return 0;
  const n = L - 1;
  return 5 * n * n;
}

/** Cấp từ số ván đã chơi. */
export function playLevelFromRounds(roundsRaw: unknown): number {
  const rounds = Math.max(0, Math.floor(Number(roundsRaw) || 0));
  let lo = PLAY_LEVEL_MIN;
  let hi = PLAY_LEVEL_MAX;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (rounds >= roundsToReachLevel(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface PlayLevelProgress {
  level: number;
  rounds: number;
  intoLevel: number;
  needForNext: number;
  ratio: number;
  isMax: boolean;
}

export function playLevelProgress(roundsRaw: unknown): PlayLevelProgress {
  const rounds = Math.max(0, Math.floor(Number(roundsRaw) || 0));
  const level = playLevelFromRounds(rounds);
  const isMax = level >= PLAY_LEVEL_MAX;
  const floor = roundsToReachLevel(level);
  const next = isMax ? floor : roundsToReachLevel(level + 1);
  const span = Math.max(1, next - floor);
  const intoLevel = Math.max(0, rounds - floor);
  const needForNext = isMax ? 0 : Math.max(0, next - rounds);
  const ratio = isMax ? 1 : Math.min(1, intoLevel / span);
  return { level, rounds, intoLevel, needForNext, ratio, isMax };
}

export function playLevelTitle(levelRaw: unknown): string {
  const L = Math.max(
    PLAY_LEVEL_MIN,
    Math.min(PLAY_LEVEL_MAX, Math.floor(Number(levelRaw) || 1)),
  );
  if (L >= 90) return "Huyền thoại";
  if (L >= 70) return "Cao thủ";
  if (L >= 50) return "Tinh anh";
  if (L >= 30) return "Lão luyện";
  if (L >= 15) return "Thành thạo";
  if (L >= 5) return "Tập sự";
  return "Tân thủ";
}
