import { todayKey } from "./types.js";

const FIRST = [
  "Minh",
  "Lan",
  "Huy",
  "An",
  "Trang",
  "Khoa",
  "My",
  "Duc",
  "Ha",
  "Phong",
  "Linh",
  "Tuan",
  "Nga",
  "Quang",
  "Vy",
  "Bao",
  "Chi",
  "Duy",
  "Giang",
  "Hung",
];

const LAST = [
  "Nguyen",
  "Tran",
  "Le",
  "Pham",
  "Hoang",
  "Vu",
  "Vo",
  "Dang",
  "Bui",
  "Do",
];

export interface BotIdentity {
  id: string;
  name: string;
  isVip: boolean;
  /** Tổng xu lời trong ngày — dùng chung list với người chơi */
  winToday: number;
  guessesToday: number;
  dayKey: string;
}

export function createIdentityPool(size = 50): BotIdentity[] {
  const pool: BotIdentity[] = [];
  const day = todayKey();
  for (let i = 0; i < size; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[Math.floor(i / FIRST.length) % LAST.length];
    const suffix = i >= FIRST.length * LAST.length ? String(i) : "";
    pool.push({
      id: `bot-${i + 1}`,
      name: `${first}${last}${suffix}`,
      isVip: Math.random() < 0.12,
      winToday: 0,
      guessesToday: 0,
      dayKey: day,
    });
  }
  return pool;
}

/** Approximate normal-ish amount between 100 and 2000. */
export function randomBotBetAmount(): number {
  const u1 = Math.random() || 0.01;
  const u2 = Math.random() || 0.01;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const raw = 600 + z * 400;
  const clamped = Math.max(100, Math.min(2000, raw));
  return Math.round(clamped / 100) * 100;
}

export function randomCardId(): number {
  return 1 + Math.floor(Math.random() * 8);
}
