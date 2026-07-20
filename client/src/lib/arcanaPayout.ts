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

export function rarityLabel(weightShare: number): "Hiếm" | "TB" | "Thường" {
  if (weightShare <= 8) return "Hiếm";
  if (weightShare <= 15) return "TB";
  return "Thường";
}

export function rarityLabelEn(
  weightShare: number,
): "RARE" | "MID" | "COMMON" {
  if (weightShare <= 8) return "RARE";
  if (weightShare <= 15) return "MID";
  return "COMMON";
}

export function rarityTierKey(
  weightShare: number,
): "high" | "mid" | "low" {
  if (weightShare <= 8) return "high";
  if (weightShare <= 15) return "mid";
  return "low";
}
