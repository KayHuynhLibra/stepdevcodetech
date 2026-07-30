/** Catalog nhẫn — đồng bộ server ringStore (xu ảo, không tiền thật). */

/** Trần giá vật phẩm / nhẫn — 12 chữ số (khớp server ITEM_XU_MAX). */
export const ITEM_XU_MAX = 999_999_999_999;

export type RingEffect = "none" | "glow" | "pulse" | "sparkle" | "orbit";

export type RingCategory = "classic" | "luxury" | "romance" | "legend";

export type CoupleFrameStyle =
  | "bronze"
  | "gold"
  | "rose"
  | "rainbow"
  | "midnight"
  | "jade"
  | "obsidian"
  | "pearl";

export type CoupleBorderStyle =
  | "classic"
  | "double"
  | "ornate"
  | "thin"
  | "crystal"
  | "flame";

export type CoupleFrameScale = "sm" | "md" | "lg" | "xl";

/** Động khung couple — giữ avatar + nhẫn. */
export type CoupleMotion = "none" | "breathe" | "sway" | "drift" | "sparkle";

/** Khoảng cách / độ rộng layout couple. */
export type CoupleGap = "tight" | "normal" | "wide" | "span";

/** Bố cục couple (cách xếp avatar + nhẫn). */
export type CoupleLayout =
  | "classic"
  | "heart_arch"
  | "banner"
  | "nest"
  | "orbit";

/** Khung pedestal nhẫn giữa hai avatar. */
export type RingFrameStyle =
  | "classic"
  | "crystal"
  | "gothic"
  | "celestial"
  | "flame"
  | "void"
  | "ornate"
  | "heart"
  | "heart_wide"
  | "diamond"
  | "hex"
  | "shield"
  | "clover"
  | "petal";

/** Scale rộng/hẹp khung nhẫn. */
export type RingFrameScale = "xs" | "sm" | "md" | "lg" | "xl";

export const RING_EFFECTS: RingEffect[] = [
  "none",
  "glow",
  "pulse",
  "sparkle",
  "orbit",
];

export const COUPLE_FRAMES: CoupleFrameStyle[] = [
  "bronze",
  "gold",
  "rose",
  "rainbow",
  "midnight",
  "jade",
  "obsidian",
  "pearl",
];

export const COUPLE_BORDERS: CoupleBorderStyle[] = [
  "classic",
  "double",
  "ornate",
  "thin",
  "crystal",
  "flame",
];

export const COUPLE_SCALES: CoupleFrameScale[] = ["sm", "md", "lg", "xl"];

export const COUPLE_MOTIONS: CoupleMotion[] = [
  "none",
  "breathe",
  "sway",
  "drift",
  "sparkle",
];

export const COUPLE_GAPS: CoupleGap[] = ["tight", "normal", "wide", "span"];

export const COUPLE_LAYOUTS: CoupleLayout[] = [
  "classic",
  "heart_arch",
  "banner",
  "nest",
  "orbit",
];

export const RING_FRAMES: RingFrameStyle[] = [
  "classic",
  "crystal",
  "gothic",
  "celestial",
  "flame",
  "void",
  "ornate",
  "heart",
  "heart_wide",
  "diamond",
  "hex",
  "shield",
  "clover",
  "petal",
];

export const RING_FRAME_SCALES: RingFrameScale[] = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
];

export const COUPLE_FRAME_LABELS: Record<CoupleFrameStyle, string> = {
  bronze: "Đồng cổ",
  gold: "Vàng",
  rose: "Hồng",
  rainbow: "Cầu vồng",
  midnight: "Đêm",
  jade: "Ngọc",
  obsidian: "Huyền đen",
  pearl: "Ngọc trai",
};

export const COUPLE_BORDER_LABELS: Record<CoupleBorderStyle, string> = {
  classic: "Cổ điển",
  double: "Đôi viền",
  ornate: "Trang trí",
  thin: "Mảnh",
  crystal: "Pha lê",
  flame: "Lửa",
};

export const COUPLE_SCALE_LABELS: Record<CoupleFrameScale, string> = {
  sm: "Nhỏ",
  md: "Vừa",
  lg: "Lớn",
  xl: "Rất lớn",
};

export const COUPLE_MOTION_LABELS: Record<CoupleMotion, string> = {
  none: "Tĩnh",
  breathe: "Thở nhẹ",
  sway: "Đung đưa",
  drift: "Trôi sao",
  sparkle: "Lấp lánh",
};

export const COUPLE_GAP_LABELS: Record<CoupleGap, string> = {
  tight: "Khít",
  normal: "Vừa",
  wide: "Rộng",
  span: "Trải rộng",
};

export const COUPLE_LAYOUT_LABELS: Record<CoupleLayout, string> = {
  classic: "Cổ điển",
  heart_arch: "Vòm tim",
  banner: "Banner",
  nest: "Tổ ấm",
  orbit: "Quỹ đạo",
};

export const RING_FRAME_LABELS: Record<RingFrameStyle, string> = {
  classic: "Oval cổ điển",
  crystal: "Pha lê",
  gothic: "Gothic",
  celestial: "Chiêm tinh",
  flame: "Lửa",
  void: "Hư không",
  ornate: "Khắc hoa",
  heart: "Trái tim",
  heart_wide: "Tim rộng",
  diamond: "Kim cương",
  hex: "Lục giác",
  shield: "Khiên",
  clover: "Cỏ bốn lá",
  petal: "Cánh hoa",
};

export const RING_FRAME_SCALE_LABELS: Record<RingFrameScale, string> = {
  xs: "Rất hẹp",
  sm: "Hẹp",
  md: "Vừa",
  lg: "Rộng",
  xl: "Rất rộng",
};

export const RING_EFFECT_LABELS: Record<RingEffect, string> = {
  none: "Không",
  glow: "Phát sáng",
  pulse: "Nhịp đập",
  sparkle: "Lấp lánh",
  orbit: "Quay quanh",
};

export const RING_CATEGORIES: { id: RingCategory; label: string }[] = [
  { id: "classic", label: "Cổ điển" },
  { id: "luxury", label: "Xa xỉ" },
  { id: "romance", label: "Lãng mạn" },
  { id: "legend", label: "Huyền thoại" },
];

export interface RingItem {
  key: string;
  nameVi: string;
  image: string;
  price: number;
  blurb?: string;
  enabled: boolean;
  sort: number;
  category?: RingCategory;
  /** catalog = shop; custom = nhẫn riêng cặp */
  kind?: "catalog" | "custom";
  ownerBondId?: string;
  effect?: RingEffect;
  imageSharpness?: number;
  coupleFrame?: CoupleFrameStyle;
  coupleBorder?: CoupleBorderStyle;
  coupleScale?: CoupleFrameScale;
  coupleMotion?: CoupleMotion;
  coupleGap?: CoupleGap;
  coupleLayout?: CoupleLayout;
  ringFrame?: RingFrameStyle;
  ringFrameScale?: RingFrameScale;
}

export type BondStatus = "pending" | "active";

export interface BondPartnerPublic {
  id: string;
  code: string;
  username: string;
  displayName: string;
  avatar: string;
}

export interface BondAdminRow {
  id: string;
  status: BondStatus;
  ringKey: string;
  ringNameVi: string;
  ringPrice: number;
  ringImage: string;
  ringEffect?: RingEffect | string;
  proposedBy: string;
  proposedAt: number;
  acceptedAt?: number;
  note?: string;
  couplePhrase?: string;
  coupleCode?: string;
  coupleXu?: number;
  coupleLevel?: number;
  designLocked?: boolean;
  ringHistory?: string[];
  a: BondPartnerPublic;
  b: BondPartnerPublic;
}

export interface UserBondSnippet {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  partnerAvatar: string;
  ringKey: string;
  ringNameVi: string;
  ringImage: string;
  ringEffect?: RingEffect | string;
  ringSharpness?: number;
  coupleFrame?: CoupleFrameStyle | string;
  coupleBorder?: CoupleBorderStyle | string;
  coupleScale?: CoupleFrameScale | string;
  coupleMotion?: CoupleMotion | string;
  coupleGap?: CoupleGap | string;
  coupleLayout?: CoupleLayout | string;
  ringFrame?: RingFrameStyle | string;
  ringFrameScale?: RingFrameScale | string;
  /** Chữ giữa A — … — B (Kim Cương); trống = «Với» */
  couplePhrase?: string;
  /** Mã cặp đôi (sau lên nhẫn) */
  coupleCode?: string;
  /** Xu nhẫn — metric Couple LV */
  coupleXu?: number;
  /** Couple LV */
  coupleLevel?: number;
  since: number;
  status: BondStatus;
}

export const DEFAULT_RINGS: RingItem[] = [
  {
    key: "silver",
    nameVi: "Nhẫn bạc",
    image: "/assets/rings/ring-silver.svg",
    price: 1_000,
    blurb: "Khởi đầu nhẹ nhàng",
    enabled: true,
    sort: 10,
    kind: "catalog",
    category: "classic",
    effect: "glow",
    imageSharpness: 75,
    coupleFrame: "bronze",
    coupleBorder: "classic",
    coupleScale: "md",
    coupleMotion: "breathe",
    coupleGap: "normal",
    coupleLayout: "classic",
    ringFrame: "classic",
    ringFrameScale: "md",
  },
  {
    key: "gold",
    nameVi: "Nhẫn vàng",
    image: "/assets/rings/ring-gold.svg",
    price: 5_000,
    blurb: "Ánh vàng ấm",
    enabled: true,
    sort: 20,
    kind: "catalog",
    category: "luxury",
    effect: "pulse",
    imageSharpness: 80,
    coupleFrame: "gold",
    coupleBorder: "double",
    coupleScale: "lg",
    coupleMotion: "sway",
    coupleGap: "wide",
    coupleLayout: "banner",
    ringFrame: "ornate",
    ringFrameScale: "lg",
  },
  {
    key: "rose",
    nameVi: "Nhẫn hồng",
    image: "/assets/rings/ring-rose.svg",
    price: 10_000,
    blurb: "Hồng lãng mạn",
    enabled: true,
    sort: 30,
    kind: "catalog",
    category: "romance",
    effect: "sparkle",
    imageSharpness: 85,
    coupleFrame: "rose",
    coupleBorder: "ornate",
    coupleScale: "lg",
    coupleMotion: "drift",
    coupleGap: "wide",
    coupleLayout: "heart_arch",
    ringFrame: "heart",
    ringFrameScale: "lg",
  },
  {
    key: "diamond",
    nameVi: "Kim cương",
    image: "/assets/rings/ring-diamond.svg",
    price: 50_000,
    blurb: "Đỉnh cao · chữ tuỳ chỉnh A — … — B",
    enabled: true,
    sort: 40,
    kind: "catalog",
    category: "legend",
    effect: "orbit",
    imageSharpness: 95,
    coupleFrame: "rainbow",
    coupleBorder: "crystal",
    coupleScale: "xl",
    coupleMotion: "sparkle",
    coupleGap: "span",
    coupleLayout: "orbit",
    ringFrame: "heart_wide",
    ringFrameScale: "xl",
  },
];

export function findRingInList(
  rings: RingItem[],
  key: string,
): RingItem | undefined {
  return rings.find((r) => r.key === key);
}

export function isRingEmoji(image: string | undefined | null): boolean {
  const s = String(image ?? "").trim();
  if (!s) return true;
  return (
    !s.startsWith("/") && !s.startsWith("http://") && !s.startsWith("https://")
  );
}

export function normalizeRingEffect(raw: unknown): RingEffect {
  const s = String(raw ?? "").trim().toLowerCase();
  return RING_EFFECTS.includes(s as RingEffect) ? (s as RingEffect) : "glow";
}

export function normalizeRingCategory(
  raw: unknown,
  key?: string,
): RingCategory {
  const s = String(raw ?? "").trim().toLowerCase();
  if (
    s === "classic" ||
    s === "luxury" ||
    s === "romance" ||
    s === "legend"
  ) {
    return s;
  }
  const k = String(key ?? "").trim().toLowerCase();
  if (k === "silver") return "classic";
  if (k === "gold") return "luxury";
  if (k === "rose") return "romance";
  if (k === "diamond") return "legend";
  return "classic";
}

export function normalizeCoupleFrame(
  raw: unknown,
  category?: RingCategory,
): CoupleFrameStyle {
  const s = String(raw ?? "").trim().toLowerCase();
  if (COUPLE_FRAMES.includes(s as CoupleFrameStyle)) {
    return s as CoupleFrameStyle;
  }
  switch (category) {
    case "luxury":
      return "gold";
    case "romance":
      return "rose";
    case "legend":
      return "rainbow";
    default:
      return "bronze";
  }
}

export function normalizeCoupleBorder(raw: unknown): CoupleBorderStyle {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_BORDERS.includes(s as CoupleBorderStyle)
    ? (s as CoupleBorderStyle)
    : "classic";
}

export function normalizeCoupleScale(raw: unknown): CoupleFrameScale {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_SCALES.includes(s as CoupleFrameScale)
    ? (s as CoupleFrameScale)
    : "md";
}

export function normalizeCoupleMotion(raw: unknown): CoupleMotion {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_MOTIONS.includes(s as CoupleMotion)
    ? (s as CoupleMotion)
    : "none";
}

export function normalizeCoupleGap(raw: unknown): CoupleGap {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_GAPS.includes(s as CoupleGap) ? (s as CoupleGap) : "normal";
}

export function normalizeRingFrame(raw: unknown): RingFrameStyle {
  const s = String(raw ?? "").trim().toLowerCase();
  return RING_FRAMES.includes(s as RingFrameStyle)
    ? (s as RingFrameStyle)
    : "classic";
}

export function normalizeRingFrameScale(raw: unknown): RingFrameScale {
  const s = String(raw ?? "").trim().toLowerCase();
  return RING_FRAME_SCALES.includes(s as RingFrameScale)
    ? (s as RingFrameScale)
    : "md";
}

export function normalizeCoupleLayout(raw: unknown): CoupleLayout {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_LAYOUTS.includes(s as CoupleLayout)
    ? (s as CoupleLayout)
    : "classic";
}

/** Nhẫn Kim Cương (và bản sao key diamond_*) được phép chữ tuỳ chỉnh. */
export function ringAllowsCustomPhrase(ringKey: unknown): boolean {
  const k = String(ringKey ?? "")
    .trim()
    .toLowerCase();
  return k === "diamond" || k.startsWith("diamond_");
}

export const COUPLE_PHRASE_MAX = 20;
export const COUPLE_PHRASE_DEFAULT = "Với";

/** Làm sạch chữ giữa A — … — B. Rỗng → dùng mặc định khi hiển thị. */
export function normalizeCouplePhrase(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, COUPLE_PHRASE_MAX);
  // Chặn ký tự điều khiển / URL-ish thô
  return s.replace(/[<>{}[\]\\|`]/g, "").trim();
}

/** Nhãn giữa hai tên: phrase tuỳ chỉnh hoặc «Với». */
export function coupleWithLabel(phrase?: string | null): string {
  const p = normalizeCouplePhrase(phrase);
  return p || COUPLE_PHRASE_DEFAULT;
}
