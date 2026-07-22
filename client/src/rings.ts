/** Catalog nhẫn — đồng bộ server ringStore (xu ảo, không tiền thật). */

/** Trần giá vật phẩm / nhẫn — 10 chữ số (khớp server ITEM_XU_MAX). */
export const ITEM_XU_MAX = 9_999_999_999;

export type RingEffect = "none" | "glow" | "pulse" | "sparkle" | "orbit";

export const RING_EFFECTS: RingEffect[] = [
  "none",
  "glow",
  "pulse",
  "sparkle",
  "orbit",
];

export const RING_EFFECT_LABELS: Record<RingEffect, string> = {
  none: "Không",
  glow: "Phát sáng",
  pulse: "Nhịp đập",
  sparkle: "Lấp lánh",
  orbit: "Quay quanh",
};

export interface RingItem {
  key: string;
  nameVi: string;
  /** Path `/assets/...` hoặc emoji (không bắt đầu bằng `/`) */
  image: string;
  price: number;
  blurb?: string;
  enabled: boolean;
  sort: number;
  effect?: RingEffect;
  imageSharpness?: number;
}

export type BondStatus = "pending" | "active";

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
    effect: "glow",
    imageSharpness: 75,
  },
  {
    key: "gold",
    nameVi: "Nhẫn vàng",
    image: "/assets/rings/ring-gold.svg",
    price: 5_000,
    blurb: "Ánh vàng ấm",
    enabled: true,
    sort: 20,
    effect: "pulse",
    imageSharpness: 80,
  },
  {
    key: "rose",
    nameVi: "Nhẫn hồng",
    image: "/assets/rings/ring-rose.svg",
    price: 10_000,
    blurb: "Hồng lãng mạn",
    enabled: true,
    sort: 30,
    effect: "sparkle",
    imageSharpness: 85,
  },
  {
    key: "diamond",
    nameVi: "Kim cương",
    image: "/assets/rings/ring-diamond.svg",
    price: 50_000,
    blurb: "Đỉnh cao",
    enabled: true,
    sort: 40,
    effect: "orbit",
    imageSharpness: 95,
  },
];

export function findRingInList(
  rings: RingItem[],
  key: string,
): RingItem | undefined {
  return rings.find((r) => r.key === key);
}

/** true nếu `image` là emoji / text, không phải URL path. */
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
