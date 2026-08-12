/** Quý tộc theo Gem lifetime — mirror server/src/nobilityRanks.ts */

export const NOBILITY_TIER_MAX = 6;

export const NOBILITY_THRESHOLDS: ReadonlyArray<{
  tier: number;
  gemSpent: number;
  id: string;
  label: string;
}> = [
  { tier: 1, gemSpent: 50, id: "hiep_si", label: "Hiệp sĩ" },
  { tier: 2, gemSpent: 200, id: "nam_tuoc", label: "Nam tước" },
  { tier: 3, gemSpent: 500, id: "tu_tuoc", label: "Tử tước" },
  { tier: 4, gemSpent: 1_500, id: "ba_tuoc", label: "Bá tước" },
  { tier: 5, gemSpent: 5_000, id: "hau_tuoc", label: "Hầu tước" },
  { tier: 6, gemSpent: 15_000, id: "cong_tuoc", label: "Công tước" },
];

export const NOBILITY_COLORS: Record<
  number,
  { bg: string; text: string; border: string; name: string }
> = {
  0: {
    bg: "transparent",
    text: "inherit",
    border: "transparent",
    name: "inherit",
  },
  1: { bg: "#eceff1", text: "#455a64", border: "#90a4ae", name: "#78909c" },
  2: { bg: "#e8f5e9", text: "#2e7d32", border: "#66bb6a", name: "#43a047" },
  3: { bg: "#e3f2fd", text: "#1565c0", border: "#42a5f5", name: "#1e88e5" },
  4: { bg: "#fff8e1", text: "#e65100", border: "#ffb300", name: "#ffa000" },
  5: { bg: "#f3e5f5", text: "#6a1b9a", border: "#ab47bc", name: "#8e24aa" },
  6: { bg: "#1a1208", text: "#ffe082", border: "#ffc107", name: "#ffd54f" },
};

/** Giảm giá shop Gem % theo bậc */
export const NOBLE_SHOP_PCT: Record<number, number> = {
  0: 0,
  1: 5,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 25,
};

export function computeNobilityTier(gemSpentRaw: unknown): number {
  const spent = Math.max(0, Math.floor(Number(gemSpentRaw) || 0));
  let tier = 0;
  for (const row of NOBILITY_THRESHOLDS) {
    if (spent >= row.gemSpent) tier = row.tier;
  }
  return tier;
}

export function nobilityTierOf(u: {
  nobilityTier?: number;
  gemSpentLifetime?: number;
}): number {
  if (typeof u.nobilityTier === "number" && Number.isFinite(u.nobilityTier)) {
    return Math.max(
      0,
      Math.min(NOBILITY_TIER_MAX, Math.floor(u.nobilityTier)),
    );
  }
  return computeNobilityTier(u.gemSpentLifetime);
}

export function nobilityLabel(tier: number): string {
  const t = Math.max(0, Math.min(NOBILITY_TIER_MAX, Math.floor(tier || 0)));
  if (t <= 0) return "";
  return NOBILITY_THRESHOLDS.find((r) => r.tier === t)?.label ?? "";
}

export function nextNobilityGemThreshold(currentTier: number): number | null {
  const t = Math.max(0, Math.min(NOBILITY_TIER_MAX, Math.floor(currentTier || 0)));
  const next = NOBILITY_THRESHOLDS.find((r) => r.tier === t + 1);
  return next ? next.gemSpent : null;
}

export function nobilityColors(tier: number) {
  const t = Math.max(0, Math.min(NOBILITY_TIER_MAX, Math.floor(tier || 0)));
  return NOBILITY_COLORS[t] ?? NOBILITY_COLORS[0]!;
}

export function shopGemDiscountPct(nobilityTier: number): number {
  const t = Math.max(0, Math.min(NOBILITY_TIER_MAX, Math.floor(nobilityTier || 0)));
  return NOBLE_SHOP_PCT[t] ?? 0;
}

export function discountedGemPrice(
  priceGem: number,
  nobilityTier: number,
): { amount: number; discountPct: number } {
  const pct = shopGemDiscountPct(nobilityTier);
  const raw = Math.max(0, Math.floor(priceGem || 0));
  if (pct <= 0 || raw <= 0) return { amount: raw, discountPct: 0 };
  return {
    amount: Math.max(1, Math.floor(raw * (1 - pct / 100))),
    discountPct: pct,
  };
}
