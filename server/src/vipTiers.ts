/**
 * VIP nhiều cấp — theo roundsPlayed + vipGranted (floor VIP3).
 * Không đụng Gem / Quý tộc. Trần cược chỉ nhân theo VIP.
 */

export const VIP_TIER_MAX = 5;

/** Mốc ván lifetime → VIP tier (không gồm grant). */
export const VIP_ROUNDS_THRESHOLDS: ReadonlyArray<{ tier: number; rounds: number }> = [
  { tier: 1, rounds: 1_000 },
  { tier: 2, rounds: 3_000 },
  { tier: 3, rounds: 10_000 },
  { tier: 4, rounds: 25_000 },
  { tier: 5, rounds: 50_000 },
];

/** Admin vipGranted → tối thiểu VIP3 (tương thích VIP10K). */
export const VIP_GRANT_FLOOR = 3;

export const VIP_TIER_LABELS: Record<number, string> = {
  0: "",
  1: "VIP1",
  2: "VIP2",
  3: "VIP3",
  4: "VIP4",
  5: "VIP5",
};

export function vipTierFromRounds(roundsRaw: unknown): number {
  const rounds = Math.max(0, Math.floor(Number(roundsRaw) || 0));
  let tier = 0;
  for (const row of VIP_ROUNDS_THRESHOLDS) {
    if (rounds >= row.rounds) tier = row.tier;
  }
  return tier;
}

export function computeVipTier(u: {
  roundsPlayed?: number;
  vipGranted?: boolean;
}): number {
  const fromRounds = vipTierFromRounds(u.roundsPlayed);
  const fromGrant = u.vipGranted ? VIP_GRANT_FLOOR : 0;
  return Math.min(VIP_TIER_MAX, Math.max(fromRounds, fromGrant));
}

export function vipLabel(tier: number): string {
  const t = Math.max(0, Math.min(VIP_TIER_MAX, Math.floor(tier || 0)));
  return VIP_TIER_LABELS[t] ?? "";
}

/** Ván cần để đạt tier kế (null nếu đã max). */
export function nextVipRoundsThreshold(currentTier: number): number | null {
  const t = Math.max(0, Math.min(VIP_TIER_MAX, Math.floor(currentTier || 0)));
  const next = VIP_ROUNDS_THRESHOLDS.find((r) => r.tier === t + 1);
  return next ? next.rounds : null;
}
