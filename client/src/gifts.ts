/** Catalog quà — đồng bộ server giftStore (xu ảo, không tiền thật). */

export type GiftCategory = "warm" | "prestige" | "legend" | "fun";

export type GiftFlyStyle = "toast" | "marquee" | "fly" | "fullscreen";

export interface GiftItem {
  key: string;
  nameVi: string;
  emoji: string;
  /** URL ảnh catalog (ưu tiên hiển thị); emoji là fallback */
  image?: string;
  price: number;
  category: GiftCategory;
  blurb?: string;
  enabled: boolean;
}

export interface GiftFlyTier {
  id: string;
  label: string;
  minAmount: number;
  durationMs: number;
  style: GiftFlyStyle;
  enabled: boolean;
}

export interface GiftFlyEvent {
  fromName: string;
  toName: string;
  amount: number;
  /** Người gửi / nhận — để FX bám ghế trên bàn nhiều người */
  fromUserId?: string;
  toUserId?: string;
  /** xu | gem */
  currency?: "xu" | "gem" | string;
  giftKey?: string;
  giftEmoji?: string;
  giftNameVi?: string;
  /** URL ảnh catalog (nếu có) — ưu tiên hiển thị trên overlay */
  giftImage?: string;
  fly: {
    id: string;
    label: string;
    style: GiftFlyStyle;
    durationMs: number;
  };
}

export const GIFT_CATEGORIES: { id: GiftCategory; label: string }[] = [
  { id: "warm", label: "Ấm áp" },
  { id: "prestige", label: "Uy tín" },
  { id: "legend", label: "Huyền thoại" },
  { id: "fun", label: "Vui" },
];

/** Fallback khi GET /api/gifts thất bại */
export const DEFAULT_GIFTS: GiftItem[] = [
  {
    key: "lotus",
    nameVi: "Hoa sen",
    emoji: "🪷",
    price: 100,
    category: "warm",
    blurb: "Lời chào nhẹ",
    enabled: true,
  },
  {
    key: "heart",
    nameVi: "Trái tim",
    emoji: "❤️",
    price: 200,
    category: "warm",
    blurb: "Gửi yêu thương",
    enabled: true,
  },
  {
    key: "star",
    nameVi: "Ngôi sao",
    emoji: "⭐",
    price: 500,
    category: "prestige",
    blurb: "Tăng khí vận",
    enabled: true,
  },
  {
    key: "crystal",
    nameVi: "Pha lê",
    emoji: "💎",
    price: 1_000,
    category: "prestige",
    blurb: "Quà trung",
    enabled: true,
  },
  {
    key: "crown",
    nameVi: "Vương miện",
    emoji: "👑",
    price: 5_000,
    category: "legend",
    blurb: "Tôn vinh",
    enabled: true,
  },
  {
    key: "phoenix",
    nameVi: "Phượng hoàng",
    emoji: "🔥",
    price: 20_000,
    category: "legend",
    blurb: "Quà lớn",
    enabled: true,
  },
  {
    key: "dragon",
    nameVi: "Rồng vàng",
    emoji: "🐉",
    price: 50_000,
    category: "legend",
    blurb: "Trần demo 50k",
    enabled: true,
  },
  {
    key: "tea",
    nameVi: "Ấm trà",
    emoji: "🍵",
    price: 300,
    category: "fun",
    blurb: "Mời một ấm",
    enabled: true,
  },
  {
    key: "dice",
    nameVi: "Xúc xắc",
    emoji: "🎲",
    price: 800,
    category: "fun",
    blurb: "Thử vận may",
    enabled: true,
  },
];

/** @deprecated alias — giữ tương thích call site cũ */
export type DemoGift = GiftItem;
export const DEMO_GIFTS = DEFAULT_GIFTS;

export function findDemoGift(key: string): GiftItem | undefined {
  return DEFAULT_GIFTS.find((g) => g.key === key);
}

export function findGiftInList(
  gifts: GiftItem[],
  key: string,
): GiftItem | undefined {
  return gifts.find((g) => g.key === key);
}
