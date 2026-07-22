/** Catalog nhẫn — đồng bộ server ringStore (xu ảo, không tiền thật). */

export interface RingItem {
  key: string;
  nameVi: string;
  /** Path `/assets/...` hoặc emoji (không bắt đầu bằng `/`) */
  image: string;
  price: number;
  blurb?: string;
  enabled: boolean;
  sort: number;
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
  },
  {
    key: "gold",
    nameVi: "Nhẫn vàng",
    image: "/assets/rings/ring-gold.svg",
    price: 5_000,
    blurb: "Ánh vàng ấm",
    enabled: true,
    sort: 20,
  },
  {
    key: "rose",
    nameVi: "Nhẫn hồng",
    image: "/assets/rings/ring-rose.svg",
    price: 10_000,
    blurb: "Hồng lãng mạn",
    enabled: true,
    sort: 30,
  },
  {
    key: "diamond",
    nameVi: "Kim cương",
    image: "/assets/rings/ring-diamond.svg",
    price: 50_000,
    blurb: "Đỉnh cao",
    enabled: true,
    sort: 40,
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
  return !s.startsWith("/") && !s.startsWith("http://") && !s.startsWith("https://");
}
