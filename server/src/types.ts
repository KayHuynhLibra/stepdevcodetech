export type Phase = "placing" | "revealing" | "payout";

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
  /** Mã khách (localStorage) — khôi phục xu đặt khi reconnect */
  guestCode?: string;
  name: string;
  avatar: string;
  balance: number;
  /** cardId -> amount for current round */
  stakes: Map<number, number>;
  /** Số lần đặt xu trong ngày (mỗi lần confirm = 1) */
  guessesToday: number;
  /** Tổng xu thắng trong ngày (chỉ phần lời) */
  winToday: number;
  dayKey: string;
  /** Tổng xu đã đặt xu trong tuần (Sao bài Tarot) */
  stakeWeek: number;
  weekKey: string;
  /** Chuỗi thua/thắng Tarot (có đặt xu khi settle) */
  tarotLossStreak?: number;
  tarotWinStreak?: number;
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

/** Xếp hạng theo xu đang cầm */
export interface BalanceLeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  balance: number;
  isYou?: boolean;
  userId?: string;
  code?: string;
}

/** Xếp hạng Sao bài — xu dùng dự đoán trong tuần */
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

/** Top 3 cao thủ + lá đang đặt xu ván này (nếu có) */
export interface TopAcePreview {
  rank: number;
  name: string;
  avatar: string;
  winToday: number;
  isYou?: boolean;
  userId?: string;
  code?: string;
  isVip?: boolean;
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

/** Người / bot đang trong phòng (list popup) */
export interface OnlinePlayerPublic {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  /** Mã ID 5 số (user đã đăng nhập) */
  code?: string;
  winToday?: number;
  guessesToday?: number;
  /** Auth user id — để admin gọi API */
  userId?: string;
  /** VIP hiệu lực (admin hoặc đủ ván) */
  isVip?: boolean;
  roundsPlayed?: number;
  vipGranted?: boolean;
  /** Chỉ gửi khi viewer là staff */
  balance?: number;
  outcomeMode?: "normal" | "win" | "lose";
  /** Khách chưa login — staff only */
  guestCode?: string;
  /** Cảnh giới Tu Tiên (công khai nếu đã gán) */
  cultivationRank?: string;
  /** Mau nick cong khai (RoleAD) */
  nameColor?: string;
}

export interface PublicState {
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
  /** Danh sách nhân vật — chỉ gửi khi viewer là admin/mainadmin */
  onlinePlayers?: OnlinePlayerPublic[];
  /** VIP/ID viewer đăng nhập (không cần online list) */
  viewerAuth?: {
    code?: string;
    isVip?: boolean;
    roundsPlayed?: number;
    vipGranted?: boolean;
  };
  topAces: TopAcePreview[];
  roundTopWinners: RoundTopWinner[];
  /** Top xu dùng dự đoán tuần này */
  tarotStars: TarotStarEntry[];
  /** Mainadmin: ẩn/hiện BXH toàn site (thiếu → coi như hiện) */
  leaderboardFlags?: {
    winToday: boolean;
    balance: boolean;
    tarotStars: boolean;
  };
  /** Quỹ VIP hiển thị (cosmetic, dao động) */
  vipPool: number;
  /** Quỹ hũ Tarot thật (cộng dồn từ xu đặt, trả bonus ngẫu nhiên) */
  jackpotPool: number;
  lastJackpotWin?: { name: string; amount: number; round: number } | null;
  cardHeat: {
    cardId: number;
    wins: number;
    level: "hot" | "cold" | "neutral";
  }[];
  streakHighlights: { name: string; streak: number; at: number }[];
  viewerEngagement?: {
    lossStreak: number;
    winStreak: number;
    warmActive: boolean;
  };
  /** Khách chơi nhanh — ms còn lại trong phiên 20 phút */
  guestPlayRemainingMs?: number;
  guestPlayLimitMs?: number;
  /** Giá chat theo mode (Saint do admin chỉnh) */
  chatCosts?: { no: number; vip: number; saint: number };
  /** Chat realtime phòng (gần nhất) */
  chatLines: {
    name: string;
    avatar: string;
    text: string;
    cost: number;
    at: number;
  }[];
  botPanel: BotPanelState;
}

export const PHASE_MS = {
  placing: 30_000,
  revealing: 5_000,
  payout: 4_000,
} as const;

export const STARTING_BALANCE = 20_000;
export const MIN_STAKE = 10;
/** Trần giá vật phẩm / nhẫn / tặng xu P2P — tối đa 10 chữ số. */
export const ITEM_XU_MAX = 9_999_999_999;
/** Trần xu trên 1 lá trong 1 ván. */
export const MAX_STAKE = 1_000_000;
/** Bước tăng xu khi đặt xu */
export const STAKE_STEP = 10;
/** Tối đa số lá khác nhau mỗi người được đặt trong 1 ván */
export const MAX_CARDS_PER_ROUND = 5;
export const TARGET_DISPLAY_CCU = 2;
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
