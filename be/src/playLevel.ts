/**
 * Cấp độ chơi bài theo số ván — công thức lấy từ levelPartsStore (part `play`).
 * Fallback: coef=5, power=2, max=99.
 */
import {
  levelFromMetric,
  levelProgress,
  metricToReachLevel,
  DEFAULT_PLAY_FORMULA,
} from "./levelFormula.js";
import { levelPartsStore } from "./levelPartsStore.js";

export const PLAY_LEVEL_MIN = 1;

/** Trần hiện tại (admin chỉnh được). */
export function getPlayLevelMax(): number {
  return levelPartsStore.playFormula().maxLevel;
}

/** @deprecated Dùng getPlayLevelMax() — giữ alias cho import cũ. */
export const PLAY_LEVEL_MAX = DEFAULT_PLAY_FORMULA.maxLevel;

export function roundsToReachLevel(level: number): number {
  return metricToReachLevel(level, levelPartsStore.playFormula());
}

export function playLevelFromRounds(roundsRaw: unknown): number {
  return levelFromMetric(roundsRaw, levelPartsStore.playFormula());
}

export type PlayLevelProgress = ReturnType<typeof levelProgress>;

export function playLevelProgress(roundsRaw: unknown): PlayLevelProgress {
  return levelProgress(roundsRaw, levelPartsStore.playFormula());
}

export function playLevelTitle(levelRaw: unknown): string {
  const max = getPlayLevelMax();
  const L = Math.max(
    PLAY_LEVEL_MIN,
    Math.min(max, Math.floor(Number(levelRaw) || 1)),
  );
  if (L >= Math.floor(max * 0.9)) return "Huyền thoại";
  if (L >= Math.floor(max * 0.7)) return "Cao thủ";
  if (L >= Math.floor(max * 0.5)) return "Tinh anh";
  if (L >= Math.floor(max * 0.3)) return "Lão luyện";
  if (L >= Math.floor(max * 0.15)) return "Thành thạo";
  if (L >= 5) return "Tập sự";
  return "Tân thủ";
}
