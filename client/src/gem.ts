/**
 * Đơn vị Gem (Kim Cương) — client mirror.
 * Chưa gắn bàn chơi; dùng hiển thị / admin grant.
 */

export const STARTING_GEM = 0;
export const ACCOUNT_GEM_MAX = 999_999_999_999;

export function formatGem(n: number): string {
  return Math.max(0, Math.floor(n || 0)).toLocaleString("vi-VN");
}
