export type Phase = "betting" | "revealing" | "payout";

export interface CardDef {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  multiplier: number;
  weight: number;
  image: string;
}

export interface PlayerSession {
  id: string;
  /** Linked auth user id (if logged in) */
  userId?: string;
  name: string;
  avatar: string;
  balance: number;
  /** cardId -> amount for current round */
  bets: Map<number, number>;
  /** Số lần đặt cược trong ngày (mỗi lần confirm = 1) */
  guessesToday: number;
  /** Tổng xu thắng trong ngày (chỉ phần lời) */
  winToday: number;
  dayKey: string;
  /** Tổng xu đã đặt cược trong tuần (Sao bài Tarot) */
  stakeWeek: number;
  weekKey: string;
}

export interface RoundResult {
  round: number;
  win: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  winToday: number;
  isYou?: boolean;
}

/** Xếp hạng Sao bài — xu dùng dự đoán trong tuần */
export interface TarotStarEntry {
  rank: number;
  name: string;
  avatar: string;
  stakeWeek: number;
  isYou?: boolean;
}

/** Top 3 cao thủ + lá đang cược ván này (nếu có) */
export interface TopAcePreview {
  rank: number;
  name: string;
  avatar: string;
  winToday: number;
  isYou?: boolean;
  /** Lá đã chọn trong ván hiện tại */
  chosenCards: { cardId: number; amount: number }[];
}

/** Top 3 thắng cao nhất của ván vừa mở */
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

export interface PublicState {
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
  onlineReal: number;
  onlineDisplay: number;
  topAces: TopAcePreview[];
  roundTopWinners: RoundTopWinner[];
  /** Top xu dùng dự đoán tuần này */
  tarotStars: TarotStarEntry[];
  /** Quỹ VIP hiển thị (cosmetic, dao động) */
  vipPool: number;
  botPanel: BotPanelState;
}

export const PHASE_MS = {
  betting: 60_000,
  revealing: 5_000,
  payout: 4_000,
} as const;

export const STARTING_BALANCE = 20_000;
export const MIN_BET = 10;
/** Trần xu trên 1 cầu (1 lá) trong 1 ván. */
export const MAX_BET = 100_000;
/** Bước tăng xu khi đặt cược */
export const BET_STEP = 10;
/** Tối đa số lá khác nhau mỗi người được đặt trong 1 ván */
export const MAX_CARDS_PER_ROUND = 5;
export const TARGET_DISPLAY_CCU = 25;
export const MIN_BOTS = 0;
export const MAX_BOTS = 50;
export const HISTORY_LIMIT = 30;
export const LEADERBOARD_LIMIT = 20;
export const BOT_LOG_LIMIT = 80;

export interface BotPublic {
  id: string;
  name: string;
  isVip: boolean;
  /** Bot dí theo cầu stake lớn */
  isChaser: boolean;
  /** Lá đã đặt trong ván hiện tại */
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

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Tuần ISO (Monday start): YYYY-Www */
export function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
