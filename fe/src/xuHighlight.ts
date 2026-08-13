/** Khoanh vùng giao dịch / cộng xu lớn trên lịch sử admin. */

/** ≥ mức này: khoanh vàng (đáng chú ý) */
export const XU_HIGHLIGHT_LARGE = 10_000;
/** ≥ mức này: khoanh đỏ (rất lớn) */
export const XU_HIGHLIGHT_HUGE = 100_000;

export type XuHitLevel = "normal" | "large" | "huge";

export function xuHitLevel(amount: unknown): XuHitLevel {
  const n = Math.abs(Math.floor(Number(amount)));
  if (!Number.isFinite(n) || n <= 0) return "normal";
  if (n >= XU_HIGHLIGHT_HUGE) return "huge";
  if (n >= XU_HIGHLIGHT_LARGE) return "large";
  return "normal";
}

/** Lấy số lớn nhất trong các giá trị (vd. stake + |profit|). */
export function xuHitLevelMax(...amounts: unknown[]): XuHitLevel {
  let best: XuHitLevel = "normal";
  for (const a of amounts) {
    const lv = xuHitLevel(a);
    if (lv === "huge") return "huge";
    if (lv === "large") best = "large";
  }
  return best;
}

/** Parse số từ audit detail: "+50000", "-1.2k", "vault +100000", … */
export function parseXuFromDetail(detail: unknown): number {
  const s = String(detail ?? "");
  const m = s.match(/[+-]?\d[\d,]*/);
  if (!m) return 0;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function xuHitRowClass(level: XuHitLevel): string {
  if (level === "huge") {
    return "xu-hit xu-hit--huge";
  }
  if (level === "large") {
    return "xu-hit xu-hit--large";
  }
  return "";
}
