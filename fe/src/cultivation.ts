/** 9 cảnh giới Tu Tiên — mirror be/src/cultivationRanks.ts */
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

export function isCultivationRank(v: unknown): v is CultivationRank {
  return (
    typeof v === "string" &&
    (CULTIVATION_RANKS as readonly string[]).includes(v)
  );
}

export function cultivationLabel(rank: unknown): string {
  if (!isCultivationRank(rank)) return "";
  return CULTIVATION_LABELS[rank];
}

let cachedColors: CultivationColorMap = structuredClone(
  DEFAULT_CULTIVATION_COLORS,
);
let fetchPromise: Promise<CultivationColorMap> | null = null;

export function getCultivationColors(): CultivationColorMap {
  return cachedColors;
}

export function getCultivationColor(
  rank: unknown,
): CultivationColor | null {
  if (!isCultivationRank(rank)) return null;
  return cachedColors[rank] ?? DEFAULT_CULTIVATION_COLORS[rank];
}

export function setCultivationColorsCache(colors: CultivationColorMap) {
  cachedColors = { ...DEFAULT_CULTIVATION_COLORS, ...colors };
}

/** Tải bảng màu public (idempotent). */
export async function ensureCultivationColors(): Promise<CultivationColorMap> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const res = await fetch("/api/cultivation/colors");
      const data = (await res.json()) as {
        ok?: boolean;
        colors?: CultivationColorMap;
      };
      if (data?.ok && data.colors) {
        setCultivationColorsCache(data.colors);
      }
    } catch {
      /* keep defaults */
    }
    return cachedColors;
  })();
  return fetchPromise;
}
