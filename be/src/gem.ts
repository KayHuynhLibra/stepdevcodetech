/**
 * Đơn vị Gem (Kim Cương) — tách khỏi xu.
 * Dùng: skin / cosmetic shop · tặng gem · admin vault.
 * Không dùng cho stake/spin game (xu chơi).
 */

export const STARTING_GEM = 0;
/** Trần số dư Gem / tài khoản */
export const ACCOUNT_GEM_MAX = 999_999_999_999;
/** Trần mỗi lần cấp / điều chỉnh admin */
export const ITEM_GEM_MAX = ACCOUNT_GEM_MAX;
/** Tặng gem tối thiểu / lần */
export const MIN_GEM_GIFT = 1;
/** Tặng gem tối đa / lần */
export const GIFT_GEM_MAX = 1_000_000;

export function clampGem(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(ACCOUNT_GEM_MAX, n);
}

export function formatGem(n: number): string {
  return Math.max(0, Math.floor(n || 0)).toLocaleString("vi-VN");
}

/** Tiền tệ thanh toán shop cosmetic */
export type ShopPayCurrency = "play" | "gem";

export type ShopPricedItem = {
  priceXu?: number;
  priceGem?: number;
};

/**
 * Chọn cách trả: gem nếu client yêu cầu và có giá gem;
 * ngược lại xu chơi nếu có giá xu; free nếu cả hai = 0.
 */
export function resolveShopPay(
  item: ShopPricedItem,
  prefer?: string | null,
):
  | { ok: true; currency: ShopPayCurrency; amount: number }
  | { ok: true; currency: "free"; amount: 0 }
  | { ok: false; reason: string } {
  const xu = Math.max(0, Math.floor(Number(item.priceXu) || 0));
  const gem = Math.max(0, Math.floor(Number(item.priceGem) || 0));
  const want = String(prefer || "")
    .trim()
    .toLowerCase();

  if (want === "gem") {
    if (gem <= 0) {
      return { ok: false, reason: "Vật phẩm này không bán bằng Gem" };
    }
    return { ok: true, currency: "gem", amount: gem };
  }
  if (want === "play" || want === "xu") {
    if (xu <= 0) {
      return { ok: false, reason: "Vật phẩm này không bán bằng xu chơi" };
    }
    return { ok: true, currency: "play", amount: xu };
  }

  // Auto: ưu tiên gem nếu chỉ có gem; xu nếu chỉ có xu; cả hai → ưu tiên gem
  if (gem > 0 && xu <= 0) return { ok: true, currency: "gem", amount: gem };
  if (xu > 0 && gem <= 0) return { ok: true, currency: "play", amount: xu };
  if (gem > 0 && xu > 0) return { ok: true, currency: "gem", amount: gem };
  return { ok: true, currency: "free", amount: 0 };
}
