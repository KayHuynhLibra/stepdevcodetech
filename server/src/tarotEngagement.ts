import type { RoundResult } from "./types.js";
import { CARDS } from "./cards.js";
import type { InterMode, RotateMode } from "./interStore.js";
import { isForceCardMode } from "./interStore.js";

export const WARM_MIN_LOSS_STREAK = 3;
export const WARM_BOOST_PER_STEP = 0.06;
export const WARM_BOOST_CAP = 0.24;

export const HEAT_WINDOW = 20;
export const HEAT_COLD_BOOST = 1.12;
export const HEAT_HOT_DAMP = 0.94;

export const JACKPOT_FEED_RATE = 0.008;
export const JACKPOT_MIN_POOL = 5_000;
export const JACKPOT_TRIGGER_CHANCE = 0.08;
export const JACKPOT_MIN_STAKE = 500;
export const JACKPOT_PAYOUT_SHARE = 0.18;
export const JACKPOT_MAX_PAYOUT = 50_000;
export const JACKPOT_CAP = 500_000;
export const JACKPOT_START = 12_000;

export const PUBLIC_WIN_STREAK_MIN = 3;

export const ALL_AUTH_HIGH = 80_000;
export const ALL_AUTH_MED = 40_000;
export const ALL_DISPLAY_HIGH = 300_000;

export type CardHeatLevel = "hot" | "cold" | "neutral";

export type CardHeatRow = {
  cardId: number;
  wins: number;
  level: CardHeatLevel;
};

export type WarmPlayerBias = {
  stakes: number[];
  lossStreak: number;
};

export type PickEngagement = {
  heatHistory?: number[];
  warmPlayers?: WarmPlayerBias[];
};

export function computeCardHeat(history: RoundResult[]): CardHeatRow[] {
  const wins = new Array(CARDS.length).fill(0) as number[];
  for (const row of history.slice(0, HEAT_WINDOW)) {
    const idx = row.win - 1;
    if (idx >= 0 && idx < CARDS.length) wins[idx]! += 1;
  }
  const total = wins.reduce((a, b) => a + b, 0);
  const avg = total / CARDS.length;
  return CARDS.map((c, i) => {
    const w = wins[i] ?? 0;
    let level: CardHeatLevel = "neutral";
    if (total >= 4) {
      if (w >= avg + 0.75) level = "hot";
      else if (w <= avg - 0.75) level = "cold";
    }
    return { cardId: c.id, wins: w, level };
  });
}

export function applyEngagementToWeights(
  weights: number[],
  engagement?: PickEngagement,
): number[] {
  let next = weights.map((w) => Math.max(0, w));

  const heatIds = engagement?.heatHistory ?? [];
  if (heatIds.length >= 4) {
    const counts = new Array(CARDS.length).fill(0) as number[];
    for (const id of heatIds.slice(0, HEAT_WINDOW)) {
      const idx = id - 1;
      if (idx >= 0 && idx < CARDS.length) counts[idx]! += 1;
    }
    const avg =
      counts.reduce((a, b) => a + b, 0) / CARDS.length || 0;
    next = next.map((w, i) => {
      const c = counts[i] ?? 0;
      if (c <= avg - 0.75) return w * HEAT_COLD_BOOST;
      if (c >= avg + 0.75) return w * HEAT_HOT_DAMP;
      return w;
    });
  }

  const warm = engagement?.warmPlayers ?? [];
  if (warm.length > 0) {
    const boost = new Array(CARDS.length).fill(0) as number[];
    for (const p of warm) {
      if (p.lossStreak < WARM_MIN_LOSS_STREAK) continue;
      let best = -1;
      let bestAmt = 0;
      for (let i = 0; i < CARDS.length; i++) {
        const amt = p.stakes[i] ?? 0;
        if (amt > bestAmt) {
          bestAmt = amt;
          best = i;
        }
      }
      if (best < 0 || bestAmt <= 0) continue;
      const steps = p.lossStreak - WARM_MIN_LOSS_STREAK + 1;
      boost[best]! += Math.min(
        WARM_BOOST_CAP,
        steps * WARM_BOOST_PER_STEP,
      );
    }
    next = next.map((w, i) => w * (1 + (boost[i] ?? 0)));
  }

  return next;
}

/** ALL: điều chỉnh mode slot theo lưu lượng xu. */
export function adaptAllEffectiveMode(
  base: RotateMode,
  traffic: { authStake: number; displayStake: number },
): RotateMode {
  let mode = base;
  if (traffic.authStake >= ALL_AUTH_HIGH) {
    if (mode === "fed" || mode === "app") mode = "user";
  } else if (traffic.authStake >= ALL_AUTH_MED && mode === "fed") {
    mode = "small";
  }
  if (
    traffic.displayStake >= ALL_DISPLAY_HIGH &&
    (mode === "user" || mode === "small")
  ) {
    mode = "hedge";
  }
  return mode;
}

export function feedJackpotFromStake(authStake: number, pool: number): number {
  if (authStake <= 0) return pool;
  const add = Math.floor(authStake * JACKPOT_FEED_RATE);
  if (add <= 0) return pool;
  return Math.min(JACKPOT_CAP, pool + add);
}

export type JackpotCandidate = {
  playerId: string;
  name: string;
  userId?: string;
  stake: number;
  balance: number;
};

export function rollJackpotPayout(
  pool: number,
  candidates: JackpotCandidate[],
): { winner: JackpotCandidate; amount: number } | null {
  if (pool < JACKPOT_MIN_POOL || candidates.length === 0) return null;
  if (Math.random() > JACKPOT_TRIGGER_CHANCE) return null;
  const totalWeight = candidates.reduce((s, c) => s + c.stake, 0);
  if (totalWeight <= 0) return null;
  let roll = Math.random() * totalWeight;
  let winner = candidates[0]!;
  for (const c of candidates) {
    roll -= c.stake;
    if (roll <= 0) {
      winner = c;
      break;
    }
  }
  const amount = Math.min(
    JACKPOT_MAX_PAYOUT,
    Math.max(500, Math.floor(pool * JACKPOT_PAYOUT_SHARE)),
  );
  return { winner, amount };
}

export function engagementAllowedForMode(mode: InterMode): boolean {
  return !isForceCardMode(mode);
}
