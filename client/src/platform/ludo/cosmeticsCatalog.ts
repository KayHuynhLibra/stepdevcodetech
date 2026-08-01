import { PLAYER_COLORS, type LudoColor } from "./boardMap";

export type LudoPaletteId =
  | "classic"
  | "neon"
  | "pastel"
  | "royal"
  | "ember"
  | "custom";

export type LudoViewMode = "orbit" | "screen" | "cinema";

export const LUDO_VIEW_MODE_CYCLE: LudoViewMode[] = [
  "orbit",
  "screen",
  "cinema",
];

export const LUDO_VIEW_MODE_LABEL: Record<
  LudoViewMode,
  { short: string; title: string; hint: string; locked: boolean }
> = {
  orbit: {
    short: "XOAY",
    title: "Mở xoay",
    hint: "Kéo xoay bàn tự do · zoom được",
    locked: false,
  },
  screen: {
    short: "MÀN",
    title: "Khóa màn hình",
    hint: "Nhìn từ trên · sân nhà ở dưới · không xoay",
    locked: true,
  },
  cinema: {
    short: "ĐẸP",
    title: "Khóa góc đẹp",
    hint: "Góc 3/4 vừa khung · không xoay · bàn không bị cắt",
    locked: true,
  },
};

export type LudoPlayerColors = Record<LudoColor, string>;

export const LUDO_PALETTE_LIST: {
  id: LudoPaletteId;
  label: string;
  colors: LudoPlayerColors;
}[] = [
  {
    id: "classic",
    label: "Cổ điển",
    colors: { ...PLAYER_COLORS },
  },
  {
    id: "neon",
    label: "Neon",
    colors: {
      red: "#ff1744",
      green: "#00e676",
      yellow: "#ffea00",
      blue: "#2979ff",
    },
  },
  {
    id: "pastel",
    label: "Pastel",
    colors: {
      red: "#ef9a9a",
      green: "#a5d6a7",
      yellow: "#fff59d",
      blue: "#90caf9",
    },
  },
  {
    id: "royal",
    label: "Hoàng gia",
    colors: {
      red: "#b71c1c",
      green: "#1b5e20",
      yellow: "#f9a825",
      blue: "#0d47a1",
    },
  },
  {
    id: "ember",
    label: "Than hồng",
    colors: {
      red: "#ff6e40",
      green: "#69f0ae",
      yellow: "#ffd740",
      blue: "#40c4ff",
    },
  },
  {
    id: "custom",
    label: "Tuỳ chỉnh",
    colors: { ...PLAYER_COLORS },
  },
];

export const LUDO_PAWN_MODELS: {
  id: string;
  label: string;
  /** null = procedural mesh */
  url: string | null;
}[] = [
  { id: "procedural", label: "Procedural (mặc định)", url: null },
  {
    id: "url",
    label: "URL tuỳ chỉnh (ô bên dưới)",
    url: null,
  },
];

export const LUDO_BOARD_MODELS: {
  id: string;
  label: string;
  url: string | null;
}[] = [
  { id: "procedural", label: "Procedural (mặc định)", url: null },
  {
    id: "url",
    label: "URL tuỳ chỉnh (ô bên dưới)",
    url: null,
  },
];

export function isLudoPaletteId(v: unknown): v is LudoPaletteId {
  return (
    v === "classic" ||
    v === "neon" ||
    v === "pastel" ||
    v === "royal" ||
    v === "ember" ||
    v === "custom"
  );
}

export function isLudoViewMode(v: unknown): v is LudoViewMode {
  return v === "orbit" || v === "screen" || v === "cinema";
}

export function nextLudoViewMode(cur: LudoViewMode): LudoViewMode {
  const i = LUDO_VIEW_MODE_CYCLE.indexOf(cur);
  return LUDO_VIEW_MODE_CYCLE[(i + 1) % LUDO_VIEW_MODE_CYCLE.length]!;
}

export function paletteColors(id: LudoPaletteId): LudoPlayerColors {
  const row = LUDO_PALETTE_LIST.find((p) => p.id === id);
  return { ...(row?.colors ?? PLAYER_COLORS) };
}

export function resolveCatalogModelUrl(
  models: { id: string; url: string | null }[],
  modelId: string | undefined,
  overrideUrl: string | undefined,
): string | null {
  const o = (overrideUrl || "").trim();
  if (o) return o;
  const id = (modelId || "procedural").trim().toLowerCase();
  const row = models.find((m) => m.id === id);
  return row?.url ?? null;
}

/** Camera azimuth (Y rotation) so seat yard sits toward bottom of screen. */
export function seatFacingAzimuth(color: string | null | undefined): number {
  switch (color) {
    case "red":
      return 0;
    case "green":
      return Math.PI / 2;
    case "yellow":
      return Math.PI;
    case "blue":
      return -Math.PI / 2;
    default:
      return 0;
  }
}

/**
 * CSS rotate (deg) for 2D top-down board — same seat-at-bottom as 3D screen mode.
 * Positive = clockwise.
 */
export function seatFacingRotationDeg(
  color: string | null | undefined,
): number {
  switch (color) {
    case "green":
      return -90;
    case "yellow":
      return 180;
    case "blue":
      return 90;
    default:
      return 0;
  }
}
