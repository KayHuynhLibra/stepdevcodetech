/** Catalog quà demo — chỉ điểm xu ảo, không tiền thật. */
export interface DemoGift {
  key: string;
  nameVi: string;
  emoji: string;
  price: number;
  blurb: string;
}

export const DEMO_GIFTS: DemoGift[] = [
  {
    key: "lotus",
    nameVi: "Hoa sen",
    emoji: "🪷",
    price: 100,
    blurb: "Lời chào nhẹ",
  },
  {
    key: "star",
    nameVi: "Ngôi sao",
    emoji: "⭐",
    price: 500,
    blurb: "Tăng khí vận",
  },
  {
    key: "crystal",
    nameVi: "Pha lê",
    emoji: "💎",
    price: 1_000,
    blurb: "Quà trung",
  },
  {
    key: "crown",
    nameVi: "Vương miện",
    emoji: "👑",
    price: 5_000,
    blurb: "Tôn vinh",
  },
  {
    key: "phoenix",
    nameVi: "Phượng hoàng",
    emoji: "🔥",
    price: 20_000,
    blurb: "Quà lớn demo",
  },
  {
    key: "dragon",
    nameVi: "Rồng vàng",
    emoji: "🐉",
    price: 50_000,
    blurb: "Trần demo 50k",
  },
];

export function findDemoGift(key: string): DemoGift | undefined {
  return DEMO_GIFTS.find((g) => g.key === key);
}
