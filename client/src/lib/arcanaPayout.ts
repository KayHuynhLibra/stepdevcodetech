export const DEFAULT_PAYOUT_SCALE = 0.3;

export interface StreakBonusRules {
  enabled: boolean;
  minStreak: number;
  percentPerStep: number;
  capPercent: number;
  nextWinBonusPercent?: number;
}

export const DEFAULT_STREAK_BONUS: StreakBonusRules = {
  enabled: true,
  minStreak: 3,
  percentPerStep: 5,
  capPercent: 15,
};

export function previewArcanaPayout(
  stake: number,
  ratio: number,
  pickCount: number,
  payoutScale: number,
): number {
  const k = Math.max(1, pickCount);
  const scale = Math.max(0.01, Math.min(2, payoutScale));
  return Math.max(0, Math.floor((stake * ratio * scale) / k));
}

export function previewStreakBonusPercent(
  streakBefore: number,
  rules: StreakBonusRules,
  won: boolean,
): number {
  if (!won || !rules.enabled) return 0;
  if (streakBefore < rules.minStreak) return 0;
  const steps = streakBefore - rules.minStreak + 1;
  return Math.min(rules.capPercent, steps * rules.percentPerStep);
}

export function previewNextWinBonusPercent(
  luckStreak: number,
  rules: StreakBonusRules,
): number {
  return previewStreakBonusPercent(luckStreak, rules, true);
}

export function applyStreakBonusToPayout(
  payoutBase: number,
  bonusPct: number,
): number {
  if (payoutBase <= 0 || bonusPct <= 0) return payoutBase;
  return Math.max(0, Math.floor(payoutBase * (1 + bonusPct / 100)));
}

export type RarityTierKey = "high" | "mid" | "low";

/** VI: Epic / Hiếm / Thường — khớp Common / Rare / Epic */
export function rarityLabel(weightShare: number): "Epic" | "Hiếm" | "Thường" {
  if (weightShare <= 8) return "Epic";
  if (weightShare <= 15) return "Hiếm";
  return "Thường";
}

export function rarityLabelEn(
  weightShare: number,
): "EPIC" | "RARE" | "COMMON" {
  if (weightShare <= 8) return "EPIC";
  if (weightShare <= 15) return "RARE";
  return "COMMON";
}

export function rarityTierKey(weightShare: number): RarityTierKey {
  if (weightShare <= 8) return "high";
  if (weightShare <= 15) return "mid";
  return "low";
}

/** Segment fill for roulette-style wheel (Epic / Rare / Common). */
export function raritySegmentColor(weightShare: number): string {
  const tier = rarityTierKey(weightShare);
  if (tier === "high") return "#5a4020";
  if (tier === "mid") return "#1f4a40";
  return "#2a3550";
}
