/**
 * Đơn vị Gem (Kim Cương) — tách khỏi xu.
 * Phase A: ví + kho. Bàn Gem / settle để sau.
 */

export const STARTING_GEM = 0;
/** Trần số dư Gem / tài khoản */
export const ACCOUNT_GEM_MAX = 999_999_999_999;
/** Trần mỗi lần cấp / điều chỉnh admin */
export const ITEM_GEM_MAX = ACCOUNT_GEM_MAX;

export function clampGem(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(ACCOUNT_GEM_MAX, n);
}

export function formatGem(n: number): string {
  return Math.max(0, Math.floor(n || 0)).toLocaleString("vi-VN");
}
