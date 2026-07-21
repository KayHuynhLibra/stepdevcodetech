/** 9 cảnh giới Tu Tiên (thứ tự tăng dần). */
export const CULTIVATION_RANKS = [
  "luyen_khi",
  "truc_co",
  "kim_dan",
  "nguyen_anh",
  "hoa_than",
  "luyen_hu",
  "hop_the",
  "dai_thua",
  "do_kiep",
] as const;

export type CultivationRank = (typeof CULTIVATION_RANKS)[number];

export const CULTIVATION_LABELS: Record<CultivationRank, string> = {
  luyen_khi: "Luyện Khí",
  truc_co: "Trúc Cơ",
  kim_dan: "Kim Đan",
  nguyen_anh: "Nguyên Anh",
  hoa_than: "Hóa Thần",
  luyen_hu: "Luyện Hư",
  hop_the: "Hợp Thể",
  dai_thua: "Đại Thừa",
  do_kiep: "Độ Kiếp",
};

export interface CultivationColor {
  bg: string;
  text: string;
  border: string;
}

export type CultivationColorMap = Record<CultivationRank, CultivationColor>;

export interface CultivationBenefit {
  /** Giảm % phí chat No/VIP/Saint (0–80) */
  chatDiscountPct: number;
  /** Ưu tiên khi auto-gán ghế voice (0–8) */
  voiceSeatPriority: number;
  /** Bonus giữ ghế (ms) — MVP metadata / soft hold */
  voiceHoldBonusMs: number;
}

export type CultivationPeriod = "day" | "week";

export interface CultivationMaintenance {
  period: CultivationPeriod;
  feeXu: number;
}

export type CultivationBenefitMap = Record<CultivationRank, CultivationBenefit>;
export type CultivationMaintenanceMap = Record<
  CultivationRank,
  CultivationMaintenance
>;

/** Palette mặc định — từ nhạt → đậm theo bậc. */
export const DEFAULT_CULTIVATION_COLORS: CultivationColorMap = {
  luyen_khi: { bg: "#e8f5e9", text: "#1b5e20", border: "#66bb6a" },
  truc_co: { bg: "#e3f2fd", text: "#0d47a1", border: "#42a5f5" },
  kim_dan: { bg: "#fff8e1", text: "#e65100", border: "#ffb300" },
  nguyen_anh: { bg: "#f3e5f5", text: "#6a1b9a", border: "#ab47bc" },
  hoa_than: { bg: "#e8eaf6", text: "#283593", border: "#5c6bc0" },
  luyen_hu: { bg: "#eceff1", text: "#37474f", border: "#78909c" },
  hop_the: { bg: "#fff3e0", text: "#bf360c", border: "#ff7043" },
  dai_thua: { bg: "#fce4ec", text: "#880e4f", border: "#ec407a" },
  do_kiep: { bg: "#1a0a0a", text: "#ffd54f", border: "#c62828" },
};

/** Default lợi ích / phí — bậc cao giảm chat nhiều, phí duy trì cao hơn. */
export const DEFAULT_CULTIVATION_BENEFITS: CultivationBenefitMap = {
  luyen_khi: { chatDiscountPct: 0, voiceSeatPriority: 0, voiceHoldBonusMs: 0 },
  truc_co: { chatDiscountPct: 5, voiceSeatPriority: 1, voiceHoldBonusMs: 60_000 },
  kim_dan: { chatDiscountPct: 10, voiceSeatPriority: 2, voiceHoldBonusMs: 120_000 },
  nguyen_anh: {
    chatDiscountPct: 15,
    voiceSeatPriority: 3,
    voiceHoldBonusMs: 180_000,
  },
  hoa_than: {
    chatDiscountPct: 20,
    voiceSeatPriority: 4,
    voiceHoldBonusMs: 240_000,
  },
  luyen_hu: {
    chatDiscountPct: 25,
    voiceSeatPriority: 5,
    voiceHoldBonusMs: 300_000,
  },
  hop_the: {
    chatDiscountPct: 30,
    voiceSeatPriority: 6,
    voiceHoldBonusMs: 360_000,
  },
  dai_thua: {
    chatDiscountPct: 40,
    voiceSeatPriority: 7,
    voiceHoldBonusMs: 480_000,
  },
  do_kiep: {
    chatDiscountPct: 50,
    voiceSeatPriority: 8,
    voiceHoldBonusMs: 600_000,
  },
};

export const DEFAULT_CULTIVATION_MAINTENANCE: CultivationMaintenanceMap = {
  luyen_khi: { period: "day", feeXu: 10 },
  truc_co: { period: "day", feeXu: 25 },
  kim_dan: { period: "day", feeXu: 50 },
  nguyen_anh: { period: "day", feeXu: 100 },
  hoa_than: { period: "day", feeXu: 200 },
  luyen_hu: { period: "week", feeXu: 500 },
  hop_the: { period: "week", feeXu: 1_000 },
  dai_thua: { period: "week", feeXu: 2_000 },
  do_kiep: { period: "week", feeXu: 5_000 },
};

export function isCultivationRank(v: unknown): v is CultivationRank {
  return (
    typeof v === "string" &&
    (CULTIVATION_RANKS as readonly string[]).includes(v)
  );
}

export function periodMs(period: CultivationPeriod): number {
  return period === "week" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

export function rankIndex(rank: CultivationRank): number {
  return CULTIVATION_RANKS.indexOf(rank);
}

/** Hạ 1 bậc; Luyện Khí → null (mất bậc). */
export function demoteRank(rank: CultivationRank): CultivationRank | null {
  const i = rankIndex(rank);
  if (i <= 0) return null;
  return CULTIVATION_RANKS[i - 1]!;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHexColor(
  raw: unknown,
  fallback: string,
): string {
  const s = String(raw ?? "").trim();
  if (!HEX_RE.test(s)) return fallback;
  if (s.length === 4) {
    const r = s[1]!;
    const g = s[2]!;
    const b = s[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return s.toLowerCase();
}
