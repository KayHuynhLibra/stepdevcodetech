/**
 * Quyền lợi VIP + Quý tộc — compose với Tu Tiên (cộng % / lấy max).
 * Trần cược: chỉ VIP. Shop Gem: chỉ Quý tộc.
 */

import { GIFT_GEM_MAX } from "./gem.js";
import { computeNobilityTier, NOBILITY_TIER_MAX } from "./nobilityRanks.js";
import { ITEM_XU_MAX } from "./types.js";
import { computeVipTier, VIP_TIER_MAX } from "./vipTiers.js";

const BASE_GIFT_XU_MAX = ITEM_XU_MAX;

const VIP_STAKE_MUL: Record<number, number> = {
  0: 1,
  1: 1.1,
  2: 1.25,
  3: 1.5,
  4: 1.75,
  5: 2,
};

const VIP_CHAT_PCT: Record<number, number> = {
  0: 0,
  1: 5,
  2: 10,
  3: 15,
  4: 20,
  5: 25,
};

const VIP_VOICE: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};

const NOBLE_SHOP_PCT: Record<number, number> = {
  0: 0,
  1: 5,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 25,
};

const NOBLE_CHAT_PCT: Record<number, number> = {
  0: 0,
  1: 5,
  2: 8,
  3: 10,
  4: 14,
  5: 17,
  6: 20,
};

const NOBLE_VOICE: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
};

const NOBLE_GIFT_XU_MUL: Record<number, number> = {
  0: 1,
  1: 1.2,
  2: 1.4,
  3: 1.6,
  4: 2,
  5: 2.5,
  6: 3,
};

const NOBLE_GIFT_GEM_MUL: Record<number, number> = {
  0: 1,
  1: 1.2,
  2: 1.4,
  3: 1.6,
  4: 2,
  5: 2.5,
  6: 3,
};

function clampTier(n: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(n || 0)));
}

export function vipStakeBonusMul(vipTier: number): number {
  const t = clampTier(vipTier, VIP_TIER_MAX);
  return VIP_STAKE_MUL[t] ?? 1;
}

export function shopGemDiscountPct(nobilityTier: number): number {
  const t = clampTier(nobilityTier, NOBILITY_TIER_MAX);
  return NOBLE_SHOP_PCT[t] ?? 0;
}

export function chatDiscountPct(
  vipTier: number,
  nobilityTier: number,
  cultPct: number,
): number {
  const vip = VIP_CHAT_PCT[clampTier(vipTier, VIP_TIER_MAX)] ?? 0;
  const noble = NOBLE_CHAT_PCT[clampTier(nobilityTier, NOBILITY_TIER_MAX)] ?? 0;
  const cult = Math.max(0, Math.min(80, Math.floor(cultPct || 0)));
  return Math.min(80, vip + noble + cult);
}

export function voicePriority(
  vipTier: number,
  nobilityTier: number,
  cultPri: number,
): number {
  const vip = VIP_VOICE[clampTier(vipTier, VIP_TIER_MAX)] ?? 0;
  const noble = NOBLE_VOICE[clampTier(nobilityTier, NOBILITY_TIER_MAX)] ?? 0;
  const cult = Math.max(0, Math.min(8, Math.floor(cultPri || 0)));
  return Math.max(vip, noble, cult);
}

export function giftXuMaxForNobility(nobilityTier: number): number {
  const mul = NOBLE_GIFT_XU_MUL[clampTier(nobilityTier, NOBILITY_TIER_MAX)] ?? 1;
  return Math.max(1, Math.floor(BASE_GIFT_XU_MAX * mul));
}

export function giftGemMaxForNobility(nobilityTier: number): number {
  const mul = NOBLE_GIFT_GEM_MUL[clampTier(nobilityTier, NOBILITY_TIER_MAX)] ?? 1;
  return Math.max(1, Math.floor(GIFT_GEM_MAX * mul));
}

/** Áp giảm giá Gem shop theo bậc Quý tộc. */
export function applyNobilityShopGemAmount(
  amount: number,
  nobilityTier: number,
): { amount: number; discountPct: number } {
  const pct = shopGemDiscountPct(nobilityTier);
  const raw = Math.max(0, Math.floor(amount || 0));
  if (pct <= 0 || raw <= 0) return { amount: raw, discountPct: 0 };
  const paid = Math.max(1, Math.floor(raw * (1 - pct / 100)));
  return { amount: paid, discountPct: pct };
}

export function applyNobilityShopPay(
  pay: { currency: "play" | "gem" | "free"; amount: number },
  nobilityTier: number,
): { currency: "play" | "gem" | "free"; amount: number; discountPct: number } {
  if (pay.currency !== "gem" || pay.amount <= 0) {
    return { currency: pay.currency, amount: pay.amount, discountPct: 0 };
  }
  const disc = applyNobilityShopGemAmount(pay.amount, nobilityTier);
  return {
    currency: "gem",
    amount: disc.amount,
    discountPct: disc.discountPct,
  };
}

export function tiersFromUser(u: {
  roundsPlayed?: number;
  vipGranted?: boolean;
  gemSpentLifetime?: number;
}): { vipTier: number; nobilityTier: number } {
  return {
    vipTier: computeVipTier(u),
    nobilityTier: computeNobilityTier(u.gemSpentLifetime),
  };
}
