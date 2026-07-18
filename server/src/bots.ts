import { todayKey, weekKey } from "./types.js";
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

/** Approximate normal-ish amount between 10 and 200. */
export function randomBotBetAmount(): number {
  const u1 = Math.random() || 0.01;
  const u2 = Math.random() || 0.01;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const raw = 60 + z * 40;
  const clamped = Math.max(10, Math.min(200, raw));
  return Math.round(clamped / 10) * 10;
}

/** Bot dí cầu — mức cược lớn hơn bot thường. */
export function randomChaserBetAmount(): number {
  const u1 = Math.random() || 0.01;
  const u2 = Math.random() || 0.01;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const raw = 180 + z * 70;
  const clamped = Math.max(50, Math.min(500, raw));
  return Math.round(clamped / 10) * 10;
}

export function randomCardId(): number {
  return 1 + Math.floor(Math.random() * 8);
}
