export interface CardDef {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  multiplier: number;
  weight: number;
  image: string;
}

export type Phase = "betting" | "revealing" | "payout";

export interface RoundResult {
  round: number;
  win: number;
}

/** Lịch sử cược cá nhân (auth) — khớp server betStore.BetEntry */
export interface BetEntry {
  id: string;
  at: number;
  userId?: string;
  username?: string;
  round: number;
  cardId: number;
  amount: number;
  result: "win" | "lose";
  payout: number;
  profit: number;
  winningCardId: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  winToday: number;
  isYou?: boolean;
}

export interface TarotStarEntry {
  rank: number;
  name: string;
  avatar: string;
  stakeWeek: number;
  isYou?: boolean;
}

export interface TopAcePreview {
  rank: number;
  name: string;
  avatar: string;
  winToday: number;
  isYou?: boolean;
  chosenCards: { cardId: number; amount: number }[];
}

export interface RoundTopWinner {
  rank: number;
  name: string;
  avatar: string;
  profit: number;
  stake: number;
  payout: number;
  winningCardId: number;
  isYou?: boolean;
  isBot?: boolean;
}

export interface BotPublic {
  id: string;
  name: string;
  isVip: boolean;
  isChaser?: boolean;
  bets: { cardId: number; amount: number }[];
}

export interface BotLogEntry {
  id: string;
  at: number;
  round: number;
  botId: string;
  botName: string;
  cardId: number;
  amount: number;
  action: "bet" | "scale" | "round_reset";
  message: string;
}

export interface BotPanelState {
  targetCount: number;
  activeCount: number;
  bots: BotPublic[];
  logs: BotLogEntry[];
  botBetsTotal: number[];
}

export interface OnlinePlayerPublic {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  code?: string;
  winToday?: number;
  guessesToday?: number;
  userId?: string;
  isVip?: boolean;
  roundsPlayed?: number;
  vipGranted?: boolean;
  balance?: number;
  outcomeMode?: "normal" | "win" | "lose";
}

export interface GameState {
  phase: Phase;
  phaseEndsAt: number;
  serverTime: number;
  roundNumber: number;
  roundId: number;
  displayBets: number[];
  playerCounts: number[];
  history: RoundResult[];
  winningCard: number | null;
  yourBalance?: number;
  yourAvatar?: string;
  yourBets?: number[];
  guessesToday?: number;
  winToday?: number;
  onlineReal?: number;
  onlineDisplay: number;
  onlinePlayers?: OnlinePlayerPublic[];
  topAces?: TopAcePreview[];
  roundTopWinners?: RoundTopWinner[];
  tarotStars?: TarotStarEntry[];
  vipPool?: number;
  chatLines?: import("./shouts").ShoutEvent[];
  botPanel?: BotPanelState;
}

export const CARD_BACK = "/assets/cards/card-back.png?v=4";
export const BG_MAIN = "/assets/background/bg-main.png?v=4";

export const CARDS: CardDef[] = [
  {
    id: 1,
    key: "magician",
    name: "The Magician",
    nameVi: "Nhà Ảo Thuật",
    multiplier: 5,
    weight: 18,
    image: "/assets/cards/card-01-magician.png?v=4",
  },
  {
    id: 2,
    key: "priestess",
    name: "The High Priestess",
    nameVi: "Nữ Tư Tế",
    multiplier: 5,
    weight: 18,
    image: "/assets/cards/card-02-priestess.png?v=4",
  },
  {
    id: 3,
    key: "empress",
    name: "The Empress",
    nameVi: "Nữ Hoàng",
    multiplier: 6,
    weight: 15,
    image: "/assets/cards/card-03-empress.png?v=4",
  },
  {
    id: 4,
    key: "emperor",
    name: "The Emperor",
    nameVi: "Hoàng Đế",
    multiplier: 8,
    weight: 12,
    image: "/assets/cards/card-04-emperor.png?v=4",
  },
  {
    id: 5,
    key: "lovers",
    name: "The Lovers",
    nameVi: "Đôi Tình Nhân",
    multiplier: 8,
    weight: 12,
    image: "/assets/cards/card-05-lovers.png?v=4",
  },
  {
    id: 6,
    key: "chariot",
    name: "The Chariot",
    nameVi: "Chiến Xa",
    multiplier: 10,
    weight: 10,
    image: "/assets/cards/card-06-chariot.png?v=4",
  },
  {
    id: 7,
    key: "star",
    name: "The Star",
    nameVi: "Ngôi Sao",
    multiplier: 15,
    weight: 8,
    image: "/assets/cards/card-07-star.png?v=4",
  },
  {
    id: 8,
    key: "sun",
    name: "The Sun",
    nameVi: "Mặt Trời",
    multiplier: 20,
    weight: 7,
    image: "/assets/cards/card-08-sun.png?v=4",
  },
];

/** Trần xu trên 1 lá — đồng bộ server MAX_BET. */
export const MAX_BET_PER_CARD = 100_000;

export const QUICK_ADDS = [10, 100, 1_000, 10_000, 100_000] as const;

export function formatXu(n: number): string {
  return n.toLocaleString("vi-VN");
}

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "betting":
      return "Đặt cược";
    case "revealing":
      return "Mở bài";
    case "payout":
      return "Trả thưởng";
  }
}
