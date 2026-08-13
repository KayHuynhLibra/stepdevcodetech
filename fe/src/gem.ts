/**
 * Đơn vị Gem (Kim Cương) — client mirror.
 * Tách xu: skin / cosmetic · tặng gem · không stake game.
 */

export const STARTING_GEM = 0;
export const ACCOUNT_GEM_MAX = 999_999_999_999;
export const MIN_GEM_GIFT = 1;
export const GIFT_GEM_MAX = 1_000_000;

export function formatGem(n: number): string {
  return Math.max(0, Math.floor(n || 0)).toLocaleString("vi-VN");
}

export type ShopPayCurrency = "play" | "gem";

export function shopPriceLabel(item: {
  priceXu?: number;
  priceGem?: number;
}): string {
  const xu = Math.max(0, Math.floor(Number(item.priceXu) || 0));
  const gem = Math.max(0, Math.floor(Number(item.priceGem) || 0));
  if (xu <= 0 && gem <= 0) return "Free";
  if (gem > 0 && xu <= 0) return `${formatGem(gem)} 💎`;
  if (xu > 0 && gem <= 0) return `${xu.toLocaleString("vi-VN")} xu`;
  return `${formatGem(gem)} 💎 / ${xu.toLocaleString("vi-VN")} xu`;
}
