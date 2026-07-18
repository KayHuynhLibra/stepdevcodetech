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

/** Fair weighted random — does not look at bets. */
export function pickWinningCard(): number {
  const total = CARDS.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const card of CARDS) {
    roll -= card.weight;
    if (roll <= 0) return card.id;
  }
  return CARDS[CARDS.length - 1].id;
}
