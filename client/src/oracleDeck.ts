import type { DrawnOracleCard, OracleCard } from "./oracle";

export type RitualSpread = 1 | 3 | 5 | 10;

/** Full 78 · Major 22 · Minor 56 */
export type DeckPool = "full" | "major" | "minor";

/** Lá trong chồng đã xào — hướng xuôi/ngược cố định lúc xào */
export type PileCard = OracleCard & { reversedDraw: boolean };

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

export function filterDeckPool(
  cards: OracleCard[],
  pool: DeckPool = "full",
): OracleCard[] {
  const base = cards.filter((c) => c.enabled !== false && !c.draft);
  if (pool === "major") {
    return base.filter((c) => (c.suit ?? "major") === "major");
  }
  if (pool === "minor") {
    return base.filter((c) => (c.suit ?? "") !== "major" && c.suit !== "zodiac");
  }
  return base;
}

/** Xào bộ theo pool — giữ thứ tự sau xào, mỗi lá gán xuôi/ngược một lần */
export function shuffleFullDeck(
  cards: OracleCard[],
  opts?: { pool?: DeckPool },
): PileCard[] {
  const pool = filterDeckPool(cards, opts?.pool ?? "full");
  return fisherYates(pool).map((c) => ({
    ...c,
    reversedDraw: Math.random() < 0.5,
  }));
}

/** Vị trí chuẩn theo chất bói bài */
export function spreadPositions(count: RitualSpread): string[] {
  if (count === 1) return ["Lá chủ"];
  if (count === 3) return ["Quá khứ", "Hiện tại", "Tương lai"];
  if (count === 5) {
    return ["Bạn", "Đối phương", "Quan hệ", "Thách thức", "Lời khuyên"];
  }
  return [
    "1 · Hiện tại",
    "2 · Thách thức (chéo)",
    "3 · Nền / gốc",
    "4 · Gần đây",
    "5 · Vương miện / mục tiêu",
    "6 · Sắp tới",
    "7 · Bản thân",
    "8 · Môi trường",
    "9 · Hy vọng / sợ",
    "10 · Kết quả",
  ];
}

/** Rút từ đỉnh chồng (index 0 = đỉnh) — không xào lại */
export function dealFromTop(
  pile: PileCard[],
  count: RitualSpread,
): { dealt: DrawnOracleCard[]; remaining: PileCard[] } {
  const n = Math.min(count, pile.length);
  const taken = pile.slice(0, n);
  const remaining = pile.slice(n);
  const positions = spreadPositions(count);
  const dealt: DrawnOracleCard[] = taken.map((c, i) => ({
    key: c.key,
    deckId: c.deckId,
    name: c.name,
    nameVi: c.nameVi,
    number: c.number,
    suit: c.suit,
    element: c.element,
    upright: c.upright,
    reversed: c.reversed,
    keywords: [...(c.keywords ?? [])],
    image: c.image,
    blurb: c.blurb,
    reversedDraw: c.reversedDraw,
    meaning: c.reversedDraw ? c.reversed : c.upright,
    position: positions[i] ?? `Vị trí ${i + 1}`,
  }));
  return { dealt, remaining };
}

/** Layout class cho bàn trải chuẩn */
export function spreadLayoutClass(count: number): string {
  if (count === 1) return "boi-spread--1";
  if (count === 3) return "boi-spread--3";
  if (count === 5) return "boi-spread--5";
  if (count === 10) return "boi-spread--celtic";
  return "boi-spread--list";
}

export const QUESTION_PRESETS: { id: string; label: string; text: string }[] = [
  {
    id: "love",
    label: "Tình cảm",
    text: "Năng lượng của đối phương dành cho tôi lúc này là gì?",
  },
  {
    id: "career",
    label: "Sự nghiệp",
    text: "Cơ hội thăng tiến của tôi trong thời gian tới ra sao?",
  },
  {
    id: "finance",
    label: "Tài chính",
    text: "Tôi cần lưu ý điều gì về quản lý tài chính giai đoạn này?",
  },
  {
    id: "daily",
    label: "Hôm nay",
    text: "Thông điệp quan trọng nhất dành cho tôi hôm nay là gì?",
  },
  {
    id: "self",
    label: "Bản thân",
    text: "Bài học lớn nhất tôi cần rút ra lúc này là gì?",
  },
];
