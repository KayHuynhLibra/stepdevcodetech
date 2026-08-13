import type { RoleDisplayPublic } from "./roleDisplay";

export interface CardDef {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  multiplier: number;
  weight: number;
  image: string;
  /** Lore ngắn (bàn cược) — không ảnh hưởng odds */
  lore?: string;
}

export type Phase = "placing" | "revealing" | "payout";

export interface RoundResult {
  round: number;
  win: number;
}

/** Lịch sử ván cá nhân (auth) — khớp server stakeStore.StakeEntry */
export interface StakeEntry {
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

export interface BalanceLeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  balance: number;
  isYou?: boolean;
  userId?: string;
  code?: string;
}

export interface LevelLeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  playLevel: number;
  roundsPlayed: number;
  isYou?: boolean;
  userId?: string;
  code?: string;
  isVip?: boolean;
}

export interface TarotStarEntry {
  rank: number;
  name: string;
  avatar: string;
  stakeWeek: number;
  isYou?: boolean;
  userId?: string;
  code?: string;
  isVip?: boolean;
}

export interface TopAcePreview {
  rank: number;
  name: string;
  avatar: string;
  winToday: number;
  isYou?: boolean;
  userId?: string;
  code?: string;
  isVip?: boolean;
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
  stakes: { cardId: number; amount: number }[];
}

export interface BotLogEntry {
  id: string;
  at: number;
  round: number;
  botId: string;
  botName: string;
  cardId: number;
  amount: number;
  action: "stake" | "scale" | "round_reset";
  message: string;
}

export interface BotPanelState {
  targetCount: number;
  activeCount: number;
  bots: BotPublic[];
  logs: BotLogEntry[];
  botStakesTotal: number[];
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
  playLevel?: number;
  vipGranted?: boolean;
  balance?: number;
  outcomeMode?: "normal" | "win" | "lose";
  guestCode?: string;
  cultivationRank?: string;
  nameColor?: string;
  nameEffect?: string;
  avatarFrame?: string;
  profileTheme?: string;
  nameFrame?: string;
  idFrame?: string;
  displayBadges?: string[];
}

export interface GameState {
  phase: Phase;
  phaseEndsAt: number;
  serverTime: number;
  roundNumber: number;
  roundId: number;
  displayStakes: number[];
  playerCounts: number[];
  history: RoundResult[];
  winningCard: number | null;
  yourBalance?: number;
  yourAvatar?: string;
  yourStakes?: number[];
  guessesToday?: number;
  winToday?: number;
  onlineReal?: number;
  onlineDisplay?: number;
  onlinePlayers?: OnlinePlayerPublic[];
  viewerAuth?: {
    code?: string;
    isVip?: boolean;
    roundsPlayed?: number;
    playLevel?: number;
    vipGranted?: boolean;
  };
  topAces?: TopAcePreview[];
  roundTopWinners?: RoundTopWinner[];
  tarotStars?: TarotStarEntry[];
  levelLeaders?: LevelLeaderboardEntry[];
  /** Mainadmin: ẩn/hiện BXH toàn site (thiếu → hiện) */
  leaderboardFlags?: {
    winToday: boolean;
    balance: boolean;
    tarotStars: boolean;
    streak: boolean;
    roundWinners: boolean;
    level: boolean;
  };
  /** Thời gian phase + kiểu reveal (admin Tổng quan) */
  tableTiming?: {
    placingMs: number;
    revealingMs: number;
    payoutMs: number;
    revealStyle: "classic" | "fan" | "spiral";
    /** Tối đa số lá đặt / ván — mặc định 4 nếu thiếu */
    maxCardsPerRound?: number;
  };
  /** Thứ tự / size / khung / chữ / tên role rail (cosmetic) */
  roleDisplay?: RoleDisplayPublic;
  vipPool?: number;
  jackpotPool?: number;
  lastJackpotWin?: { name: string; amount: number; round: number } | null;
  cardHeat?: {
    cardId: number;
    wins: number;
    level: "hot" | "cold" | "neutral";
  }[];
  streakHighlights?: { name: string; streak: number; at: number }[];
  viewerEngagement?: {
    lossStreak: number;
    winStreak: number;
    warmActive: boolean;
  };
  guestPlayRemainingMs?: number;
  guestPlayLimitMs?: number;
  chatCosts?: { no: number; vip: number; saint: number };
  chatLines?: import("./shouts").ShoutEvent[];
  /** Tip / gợi ý — staff luôn hiện; player theo flags */
  aiUx?: {
    tips: string[];
    chatSuggests: string[];
    playTipsForPlayers: boolean;
    chatSuggestsForPlayers: boolean;
  };
  botPanel?: BotPanelState;
}

export const CARD_BACK = "/assets/cards/card-back.webp?v=6";
export const BG_MAIN = "/assets/background/bg-main.png?v=5";

export const CARDS: CardDef[] = [
  {
    id: 1,
    key: "magician",
    name: "The Magician",
    nameVi: "Nhà Ảo Thuật",
    multiplier: 5,
    weight: 18,
    image: "/assets/cards/card-01-magician.webp?v=6",
    lore: "Ý chí biến ý tưởng thành hiện thực — tập trung nguồn lực đang có.",
  },
  {
    id: 2,
    key: "priestess",
    name: "The High Priestess",
    nameVi: "Nữ Tư Tế",
    multiplier: 5,
    weight: 18,
    image: "/assets/cards/card-02-priestess.webp?v=6",
    lore: "Trực giác và tri thức ẩn — lắng nghe trước khi hành động.",
  },
  {
    id: 3,
    key: "empress",
    name: "The Empress",
    nameVi: "Nữ Hoàng",
    multiplier: 6,
    weight: 15,
    image: "/assets/cards/card-03-empress.webp?v=6",
  },
  {
    id: 4,
    key: "emperor",
    name: "The Emperor",
    nameVi: "Hoàng Đế",
    multiplier: 8,
    weight: 12,
    image: "/assets/cards/card-04-emperor.webp?v=6",
  },
  {
    id: 5,
    key: "lovers",
    name: "The Lovers",
    nameVi: "Đôi Tình Nhân",
    multiplier: 8,
    weight: 12,
    image: "/assets/cards/card-05-lovers.webp?v=6",
  },
  {
    id: 6,
    key: "chariot",
    name: "The Chariot",
    nameVi: "Chiến Xa",
    multiplier: 10,
    weight: 10,
    image: "/assets/cards/card-06-chariot.webp?v=6",
  },
  {
    id: 7,
    key: "star",
    name: "The Star",
    nameVi: "Ngôi Sao",
    multiplier: 15,
    weight: 8,
    image: "/assets/cards/card-07-star.webp?v=6",
  },
  {
    id: 8,
    key: "sun",
    name: "The Sun",
    nameVi: "Mặt Trời",
    multiplier: 20,
    weight: 7,
    image: "/assets/cards/card-08-sun.webp?v=6",
  },
];

/** Trần xu trên 1 lá — đồng bộ server MAX_STAKE. */
export const MAX_STAKE_PER_CARD = 1_000_000;

export const QUICK_ADDS = [10, 100, 1_000, 10_000, 100_000, 1_000_000] as const;

export function formatXu(n: number): string {
  return n.toLocaleString("vi-VN");
}

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "placing":
      return "Đặt xu";
    case "revealing":
      return "Mở bài";
    case "payout":
      return "Kết toán";
  }
}
