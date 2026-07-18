import {
  effectiveWeights,
  isPolicyMode,
  type InterMode,
  type PolicyMode,
} from "./interStore.js";
import type { CardDef } from "./types.js";

export const CARDS: CardDef[] = [
  {
    id: 1,
    key: "magician",
    name: "The Magician",
    nameVi: "Nhà Ảo Thuật",
    multiplier: 5,
    weight: 18,
    image: "/assets/cards/card-01-magician.png",
  },
  {
    id: 2,
    key: "priestess",
    name: "The High Priestess",
    nameVi: "Nữ Tư Tế",
    multiplier: 5,
    weight: 18,
    image: "/assets/cards/card-02-priestess.png",
  },
  {
    id: 3,
    key: "empress",
    name: "The Empress",
    nameVi: "Nữ Hoàng",
    multiplier: 6,
    weight: 15,
    image: "/assets/cards/card-03-empress.png",
  },
  {
    id: 4,
    key: "emperor",
    name: "The Emperor",
    nameVi: "Hoàng Đế",
    multiplier: 8,
    weight: 12,
    image: "/assets/cards/card-04-emperor.png",
  },
  {
    id: 5,
    key: "lovers",
    name: "The Lovers",
    nameVi: "Đôi Tình Nhân",
    multiplier: 8,
    weight: 12,
    image: "/assets/cards/card-05-lovers.png",
  },
  {
    id: 6,
    key: "chariot",
    name: "The Chariot",
    nameVi: "Chiến Xa",
    multiplier: 10,
    weight: 10,
    image: "/assets/cards/card-06-chariot.png",
  },
  {
    id: 7,
    key: "star",
    name: "The Star",
    nameVi: "Ngôi Sao",
    multiplier: 15,
    weight: 8,
    image: "/assets/cards/card-07-star.png",
  },
  {
    id: 8,
    key: "sun",
    name: "The Sun",
    nameVi: "Mặt Trời",
    multiplier: 20,
    weight: 7,
    image: "/assets/cards/card-08-sun.png",
  },
];

export function getCard(id: number): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}

/** Liability = stake × hệ số nhân nếu lá đó thắng. */
export function cardLiabilities(realBets: number[] = []): number[] {
  return CARDS.map((c, i) => Math.max(0, realBets[i] ?? 0) * c.multiplier);
}

/** Lời nhà cái nếu lá i thắng = tổng stake − trả thưởng lá đó. */
export function houseProfitByCard(realBets: number[] = []): number[] {
  const totalStake = realBets.reduce((a, b) => a + Math.max(0, b), 0);
  return cardLiabilities(realBets).map((L) => totalStake - L);
}

/**
 * App = hút xu mềm (weight cao khi liability thấp, vẫn random).
 * Fed = đọc cầu → 100% lá app lời tối đa (min liability).
 * User = nhả xu (weight cao khi liability cao).
 * Không có cược → fallback weight gốc.
 */
export function policyWeights(
  mode: PolicyMode,
  realBets: number[] = [],
): number[] {
  const liab = cardLiabilities(realBets);
  const totalStake = realBets.reduce((a, b) => a + Math.max(0, b), 0);
  if (totalStake <= 0) return CARDS.map((c) => c.weight);

  if (mode === "fed") {
    const profits = houseProfitByCard(realBets);
    const maxProfit = Math.max(...profits);
    const mask = profits.map((p) => (p === maxProfit ? 1 : 0));
    const n = mask.reduce<number>((a, b) => a + b, 0) || 1;
    return mask.map((m) => (m / n) * 100);
  }

  if (mode === "app") {
    // Scale tiền ÷10: chia nhỏ hơn để vẫn lệch rõ
    return liab.map((L) => 1 / Math.pow(1 + L / 50, 3.5));
  }
  return liab.map((L) => Math.pow(1 + L / 50, 3.5));
}

function resolveWeights(mode: InterMode, realBets?: number[]): number[] {
  if (isPolicyMode(mode)) return policyWeights(mode, realBets ?? []);
  return effectiveWeights(
    CARDS.map((c) => c.weight),
    mode,
    CARDS.map((c) => c.id),
  );
}

/**
 * Weighted random theo mode Inter (mainadmin).
 * auto / small / big / ép lá — không nhìn stake.
 * app / user / fed — nhìn stake user đăng nhập (auth bets).
 */
export function pickWinningCard(
  mode: InterMode = "auto",
  realBets?: number[],
): number {
  const weights = resolveWeights(mode, realBets);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < CARDS.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return CARDS[i]!.id;
  }
  return CARDS[CARDS.length - 1]!.id;
}

/** Xác suất hiển thị cho tab Inter (%). Policy modes cần auth bets ván hiện tại. */
export function cardProbabilities(
  mode: InterMode = "auto",
  realBets?: number[],
): {
  cardId: number;
  nameVi: string;
  weight: number;
  percent: number;
  group: "small" | "big";
  liability: number;
  houseProfit: number;
}[] {
  const bets = realBets ?? [];
  const weights = resolveWeights(mode, bets);
  const liab = cardLiabilities(bets);
  const profits = houseProfitByCard(bets);
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  return CARDS.map((c, i) => ({
    cardId: c.id,
    nameVi: c.nameVi,
    weight: Math.round(weights[i]! * 100) / 100,
    percent: Math.round((weights[i]! / total) * 1000) / 10,
    group: c.id <= 4 ? ("small" as const) : ("big" as const),
    liability: liab[i]!,
    houseProfit: profits[i]!,
  }));
}
