import { MAX_BET, MIN_BET, todayKey, weekKey } from "./types.js";
import { AVATARS, DEFAULT_AVATAR } from "./avatars.js";

/**
 * Tên ngắn tiếng Việt (có dấu) — dễ hiển thị trên UI hẹp.
 * Không dùng họ dài / đệm để tránh cắt chữ.
 */
const TEN_NGAN = [
  "An",
  "Bình",
  "Chi",
  "Duy",
  "Đạt",
  "Hà",
  "Hương",
  "Huy",
  "Khoa",
  "Lan",
  "Linh",
  "Long",
  "Mai",
  "Minh",
  "My",
  "Mỹ",
  "Nam",
  "Nga",
  "Nhi",
  "Phong",
  "Phúc",
  "Quân",
  "Quỳnh",
  "Sơn",
  "Tâm",
  "Thảo",
  "Thy",
  "Trang",
  "Trâm",
  "Tuấn",
  "Vy",
  "Yến",
  "Bảo",
  "Cường",
  "Dũng",
  "Giang",
  "Hạnh",
  "Hiếu",
  "Hùng",
  "Huệ",
  "Khánh",
  "Kiệt",
  "Lộc",
  "Ngân",
  "Nhung",
  "Phương",
  "Thịnh",
  "Thư",
  "Uyên",
  "Vân",
  "Xuân",
  "Ánh",
  "Đức",
  "Hải",
  "Kiên",
  "Lam",
  "Oanh",
  "Tú",
  "Vũ",
  "Diễm",
  "Hòa",
  "Kim",
  "Loan",
  "Ngọc",
  "Sáng",
  "Tuyết",
  "Vinh",
  "Đan",
  "Hồng",
  "Lệ",
  "Nhã",
  "Thắng",
  "Trúc",
  "Vỹ",
  "Ý",
  "Bích",
  "Cẩm",
  "Đông",
  "Hạc",
  "Liễu",
];

export interface BotIdentity {
  id: string;
  name: string;
  avatar: string;
  isVip: boolean;
  /** Bot chuyên dí theo cầu đang có stake lớn nhất */
  isChaser: boolean;
  /** Tổng xu lời trong ngày — dùng chung list với người chơi */
  winToday: number;
  guessesToday: number;
  dayKey: string;
  stakeWeek: number;
  weekKey: string;
}

/** Luôn giữ 2 bot dí cầu khi có đủ bot active */
export const CHASER_BOT_COUNT = 2;

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Tạo pool bot: tên ngắn có dấu, không trùng trong pool. */
export function createIdentityPool(size = 50): BotIdentity[] {
  const day = todayKey();
  const week = weekKey();
  const poolNames = shuffleInPlace([...TEN_NGAN]);

  const pool: BotIdentity[] = [];
  for (let i = 0; i < size; i++) {
    const base = poolNames[i % poolNames.length]!;
    const name =
      i < poolNames.length ? base : `${base}${Math.floor(i / poolNames.length) + 1}`;
    const avatar =
      AVATARS.length > 0
        ? AVATARS[(i + 1) % AVATARS.length] ?? DEFAULT_AVATAR
        : DEFAULT_AVATAR;
    const isChaser = i < CHASER_BOT_COUNT;
    pool.push({
      id: `bot-${i + 1}`,
      name,
      avatar,
      isVip: isChaser || Math.random() < 0.12,
      isChaser,
      winToday: 0,
      guessesToday: 0,
      dayKey: day,
      stakeWeek: 0,
      weekKey: week,
    });
  }
  return pool;
}

type BetTier = { min: number; max: number; weight: number };

/** Mệnh giá đa dạng — giống người chơi (nhỏ nhiều, lớn hiếm). */
const NORMAL_BET_TIERS: BetTier[] = [
  { min: 10, max: 100, weight: 28 },
  { min: 100, max: 500, weight: 22 },
  { min: 500, max: 2_000, weight: 18 },
  { min: 2_000, max: 10_000, weight: 14 },
  { min: 10_000, max: 50_000, weight: 10 },
  { min: 50_000, max: 200_000, weight: 6 },
  { min: 200_000, max: 800_000, weight: 2 },
];

const CHASER_BET_TIERS: BetTier[] = [
  { min: 500, max: 5_000, weight: 15 },
  { min: 5_000, max: 30_000, weight: 25 },
  { min: 30_000, max: 150_000, weight: 28 },
  { min: 150_000, max: 500_000, weight: 20 },
  { min: 500_000, max: MAX_BET, weight: 12 },
];

function pickWeightedTier(tiers: BetTier[]): BetTier {
  let total = 0;
  for (const t of tiers) total += t.weight;
  let r = Math.random() * total;
  for (const t of tiers) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return tiers[tiers.length - 1]!;
}

function roundHumanBetAmount(raw: number): number {
  let n = Math.floor(raw);
  if (n >= 100_000) n = Math.round(n / 10_000) * 10_000;
  else if (n >= 10_000) n = Math.round(n / 1_000) * 1_000;
  else if (n >= 1_000) n = Math.round(n / 100) * 100;
  else n = Math.round(n / 10) * 10;
  return Math.max(MIN_BET, Math.min(MAX_BET, n));
}

function randomAmountInTier(tier: BetTier): number {
  const span = tier.max - tier.min;
  const raw = tier.min + Math.random() * (span > 0 ? span : 1);
  return roundHumanBetAmount(raw);
}

/** Cược bot thường — nhiều mức nhỏ/lớn như user. */
export function randomBotBetAmount(): number {
  return randomAmountInTier(pickWeightedTier(NORMAL_BET_TIERS));
}

/** Bot dí cầu — thiên về mệnh giá lớn hơn. */
export function randomChaserBetAmount(): number {
  return randomAmountInTier(pickWeightedTier(CHASER_BET_TIERS));
}

/** Số lệnh cược mỗi bot thường trong một ván (1–4). */
export function randomBotBetsPerRound(): number {
  const r = Math.random();
  if (r < 0.35) return 1;
  if (r < 0.65) return 2;
  if (r < 0.88) return 3;
  return 4;
}

export function randomCardId(): number {
  return 1 + Math.floor(Math.random() * 8);
}
