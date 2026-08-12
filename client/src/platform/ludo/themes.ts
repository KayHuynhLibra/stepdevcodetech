export type LudoThemeId =
  | "classic"
  | "soccer"
  | "arena"
  | "garden"
  | "neon"
  | "frost";

export const LUDO_THEME_IDS: LudoThemeId[] = [
  "classic",
  "soccer",
  "arena",
  "garden",
  "neon",
  "frost",
];

export const LUDO_FREE_THEME_IDS: LudoThemeId[] = [
  "classic",
  "soccer",
  "arena",
];

export const LUDO_THEMES: {
  id: LudoThemeId;
  nameVi: string;
  blurb: string;
  swatch: string;
  free: boolean;
  /** Shop board item id */
  boardItemId: string;
  /** Xu price (legacy / optional); 0 = không bán xu */
  priceXu: number;
  /** Gem price for premium boards */
  priceGem: number;
  /** Bậc Quý tộc tối thiểu */
  minNobility?: number;
}[] = [
  {
    id: "classic",
    nameVi: "Cổ điển",
    blurb: "Gỗ · kem · bàn quen thuộc",
    swatch: "linear-gradient(135deg,#f7efe0,#c23b2e 40%,#2b6cb0)",
    free: true,
    boardItemId: "board-classic",
    priceXu: 0,
    priceGem: 0,
  },
  {
    id: "soccer",
    nameVi: "Sân bóng",
    blurb: "Cỏ · khung thành · safe bóng",
    swatch: "linear-gradient(135deg,#7bc67e,#1e7a3a 45%,#f5f5f5)",
    free: true,
    boardItemId: "board-soccer",
    priceXu: 0,
    priceGem: 0,
  },
  {
    id: "arena",
    nameVi: "Đấu trường",
    blurb: "Đá tối · nút khối lửa",
    swatch: "linear-gradient(135deg,#2a2030,#c45a12 50%,#1a1210)",
    free: true,
    boardItemId: "board-arena",
    priceXu: 0,
    priceGem: 0,
  },
  {
    id: "garden",
    nameVi: "Vườn",
    blurb: "Hàng rào · đá · đồi xanh",
    swatch: "linear-gradient(135deg,#8fd18a,#3d8b40 40%,#c8e6c9)",
    free: false,
    boardItemId: "board-garden",
    priceXu: 0,
    priceGem: 110,
    minNobility: 1,
  },
  {
    id: "neon",
    nameVi: "Neon Casino",
    blurb: "Viền sáng · chip · bàn gỗ bóng",
    swatch: "linear-gradient(135deg,#1a1030,#e040fb 45%,#00e5ff)",
    free: false,
    boardItemId: "board-neon",
    priceXu: 0,
    priceGem: 180,
    minNobility: 2,
  },
  {
    id: "frost",
    nameVi: "Băng tuyết",
    blurb: "Băng · tuyết · ánh lạnh",
    swatch: "linear-gradient(135deg,#e3f2fd,#4fc3f7 40%,#1565c0)",
    free: false,
    boardItemId: "board-frost",
    priceXu: 0,
    priceGem: 180,
    minNobility: 2,
  },
];

export function isLudoThemeId(v: unknown): v is LudoThemeId {
  return LUDO_THEME_IDS.includes(String(v ?? "").trim().toLowerCase() as LudoThemeId);
}

export function normalizeThemeId(v: unknown): LudoThemeId {
  return isLudoThemeId(v) ? (String(v).trim().toLowerCase() as LudoThemeId) : "classic";
}

export function isFreeLudoTheme(id: LudoThemeId): boolean {
  return LUDO_FREE_THEME_IDS.includes(id);
}

/** Seat / pawn hex — khớp `.ludo-page[data-theme=…]`. */
export function themeSeatColors(id: LudoThemeId): Record<
  "red" | "green" | "yellow" | "blue",
  string
> {
  switch (id) {
    case "soccer":
      return {
        red: "#c62828",
        green: "#2e7d32",
        yellow: "#f9a825",
        blue: "#1565c0",
      };
    case "arena":
      return {
        red: "#ff5a3c",
        green: "#3dd68c",
        yellow: "#ffc14a",
        blue: "#5b8cff",
      };
    case "garden":
      return {
        red: "#e65100",
        green: "#2e7d32",
        yellow: "#f9a825",
        blue: "#0277bd",
      };
    case "neon":
      return {
        red: "#ff1744",
        green: "#00e676",
        yellow: "#ffea00",
        blue: "#00e5ff",
      };
    case "frost":
      return {
        red: "#ef5350",
        green: "#66bb6a",
        yellow: "#ffee58",
        blue: "#42a5f5",
      };
    default:
      return {
        red: "#d32f2f",
        green: "#2e9a52",
        yellow: "#e6b00f",
        blue: "#2f78c4",
      };
  }
}

/** Track / cross path fill for 2D board. */
export function themeTrackColor(id: LudoThemeId): string {
  switch (id) {
    case "soccer":
      return "#f4f7f5";
    case "arena":
      return "#4a4058";
    case "garden":
      return "#efebe0";
    case "neon":
      return "#f5f0ff";
    case "frost":
      return "#e8f4fc";
    default:
      return "#faf7f0";
  }
}

/** @deprecated Pack PNGs unused — boards are procedural tiles. Kept for admin refs. */
export const LUDO_THEME_BOARD_ART: Partial<Record<LudoThemeId, string>> = {};
