/**
 * Olympus Casino — original tumble slot demo.
 * Vietnamese players often call Pragmatic's "Gates of Olympus" by this nickname;
 * this is NOT that product — original symbols/math for ComS352 platform labs.
 */
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { authStore } from "../auth.js";
import { clientIp, rateLimit, clearRateBuckets } from "../rateLimit.js";
import { appendLedger, dbReady, query, upsertUserMirror } from "./db.js";
import { loadPlatformConfig } from "./config.js";
import { getKv, kvReady, setKv } from "./kv.js";

export const OLYMPUS_COLS = 6;
export const OLYMPUS_ROWS = 5;
const BOARD = OLYMPUS_COLS * OLYMPUS_ROWS; // 30

/** Original gem set — not Pragmatic assets */
export const SYMBOLS = [
  "ruby",
  "sapphire",
  "emerald",
  "amethyst",
  "topaz",
  "pearl",
  "crown",
  "bolt", // multiplier orb
  "zeus", // free-spins scatter
] as const;

export type OlympusSymbol = (typeof SYMBOLS)[number];
export type PayMode = "scatter" | "cluster";

const PAY: Record<string, number> = {
  ruby: 0.25,
  sapphire: 0.3,
  emerald: 0.35,
  amethyst: 0.4,
  topaz: 0.5,
  pearl: 0.8,
  crown: 1.2,
  bolt: 0,
  zeus: 0,
};

/** Gate-like orb ladder — weighted toward smaller values */
const ORB_VALUES = [2, 5, 10, 25, 50, 100, 250, 500] as const;
const ORB_WEIGHTS = [28, 22, 18, 12, 10, 6, 3, 1];

const BETS = [20, 50, 100, 200, 500, 1000] as const;
export const OLYMPUS_BETS: readonly number[] = BETS;

const FS_AWARD = 15;
const FS_RETRIGGER = 5;
const FS_CAP = 100;
const BUY_BONUS_MULT = 100;
const HOLD_TRIGGER_CROWNS = 6;
const HOLD_LIVES = 3;

type Cell = OlympusSymbol | null;

type OrbHit = { r: number; c: number; value: number };

type TumbleStep = {
  grid: Cell[][];
  removed: { r: number; c: number }[];
  win: number;
  multAdded: number[];
  orbs?: OrbHit[];
};

type FreeSpinsState = {
  left: number;
  totalAwarded: number;
  accumMult: number;
  bet: number;
};

type HoldState = {
  lives: number;
  bet: number;
  /** sticky crown values; null = empty respin cell */
  cells: (number | null)[][];
};

export type SpinResult = {
  spinId: string;
  bet: number;
  grid: Cell[][];
  tumbles: TumbleStep[];
  totalWin: number;
  totalMult: number;
  balance: number;
  jackpotPool: number;
  jackpotContrib: number;
  jackpotHit: null | {
    tier: "mini" | "major" | "grand";
    amount: number;
  };
  mode: "base" | "free";
  payMode: PayMode;
  accumMult: number;
  freeSpins: FreeSpinsState | null;
  fsAwarded: number;
  holdTriggered: boolean;
  storage: { postgres: boolean; redis: boolean; minio: string; mode: string };
};

const memBalance = new Map<string, number>();
const START_BAL = 50_000;
const fsByPurse = new Map<string, FreeSpinsState>();
const holdByPurse = new Map<string, HoldState>();

const MECHANICS = [
  {
    id: "scatter_pays",
    status: "full" as const,
    note: "6×5 · ≥8 symbol anywhere",
  },
  {
    id: "tumble",
    status: "full" as const,
    note: "Winning symbols remove · cascade refill",
  },
  {
    id: "multiplier_orbs",
    status: "full" as const,
    note: "bolt ×2…×500 add · apply on winning tumble",
  },
  {
    id: "free_spins",
    status: "full" as const,
    note: "≥4 zeus → 15 FS · accumMult across FS · retrigger +5",
  },
  {
    id: "bonus_buy",
    status: "full" as const,
    note: `POST /buy-bonus · ${BUY_BONUS_MULT}× bet → 15 FS`,
  },
  {
    id: "hold_and_spin",
    status: "full" as const,
    note: `≥${HOLD_TRIGGER_CROWNS} crown hoặc lab · 3 respins · full board jackpot`,
  },
  {
    id: "cluster_pays",
    status: "full" as const,
    note: "payMode=cluster · ≥5 4-way adjacent",
  },
  {
    id: "progressive_jackpot",
    status: "full" as const,
    note: "3% feed · mini/major/grand",
  },
  {
    id: "megaways",
    status: "missing" as const,
    note: "Not in this demo",
  },
  {
    id: "sticky_wild",
    status: "missing" as const,
    note: "Deferred",
  },
  {
    id: "walking_wild",
    status: "missing" as const,
    note: "Deferred",
  },
  {
    id: "expanding_wild",
    status: "missing" as const,
    note: "Deferred",
  },
  {
    id: "wheel_bonus",
    status: "missing" as const,
    note: "Deferred",
  },
  {
    id: "pick_bonus",
    status: "missing" as const,
    note: "Deferred",
  },
];

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

type Purse =
  | {
      kind: "auth";
      id: string;
      userId: string;
      bal: () => number;
      credit: (
        delta: number,
      ) => { ok: true; balance: number } | { ok: false; reason: string };
    }
  | {
      kind: "guest" | "anon";
      id: string;
      bal: () => number;
      credit: (
        delta: number,
      ) => { ok: true; balance: number } | { ok: false; reason: string };
    };

function memPurse(id: string, kind: "guest" | "anon"): Purse {
  return {
    kind,
    id,
    bal: () => {
      if (!memBalance.has(id)) memBalance.set(id, START_BAL);
      return memBalance.get(id)!;
    },
    credit: (delta) => {
      const cur = memBalance.has(id) ? memBalance.get(id)! : START_BAL;
      const next = Math.max(0, Math.round(cur + delta));
      memBalance.set(id, next);
      return { ok: true, balance: next };
    },
  };
}

/** Auth thắng guest. Bearer giả + không guest → null (401). */
function resolvePurse(req: Request): Purse | { error: "bad_token" } {
  const token = bearer(req);
  if (token) {
    const user = authStore.resolveToken(token);
    if (user) {
      const userId = user.id;
      return {
        kind: "auth",
        id: `user:${userId}`,
        userId,
        bal: () => authStore.getById(userId)?.balance ?? 0,
        credit: (delta) => {
          const r = authStore.adjustBalance(userId, delta);
          if (!r.ok) return r;
          return { ok: true, balance: r.user.balance };
        },
      };
    }
    const guest = String(req.headers["x-guest-id"] || "").trim();
    if (!guest) return { error: "bad_token" };
  }
  const guest = String(
    req.headers["x-guest-id"] || req.body?.guestId || "",
  ).trim();
  if (guest) return memPurse(`guest:${guest}`, "guest");
  return memPurse(`anon:${clientIp(req)}`, "anon");
}

function isPurse(p: Purse | { error: string }): p is Purse {
  return !("error" in p);
}

function pickOrbValue(): number {
  let t = ORB_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * t;
  for (let i = 0; i < ORB_VALUES.length; i++) {
    r -= ORB_WEIGHTS[i];
    if (r <= 0) return ORB_VALUES[i];
  }
  return 2;
}

function randSym(opts?: { rareZeus?: boolean }): OlympusSymbol {
  // weights: gems… crown bolt zeus
  const w = opts?.rareZeus
    ? [11, 11, 10, 9, 8, 6, 4, 5, 8]
    : [12, 12, 11, 10, 9, 7, 5, 5, 3];
  let t = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * t;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= w[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return "ruby";
}

function emptyGrid(): Cell[][] {
  return Array.from({ length: OLYMPUS_ROWS }, () =>
    Array.from({ length: OLYMPUS_COLS }, () => null),
  );
}

function fillGrid(
  base?: Cell[][],
  opts?: { rareZeus?: boolean },
): Cell[][] {
  const g = base ? base.map((row) => [...row]) : emptyGrid();
  for (let r = 0; r < OLYMPUS_ROWS; r++) {
    for (let c = 0; c < OLYMPUS_COLS; c++) {
      if (!g[r][c]) g[r][c] = randSym(opts);
    }
  }
  return g;
}

function countSym(grid: Cell[][], sym: OlympusSymbol): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) if (cell === sym) n++;
  }
  return n;
}

function countsPaying(grid: Cell[][]): Map<OlympusSymbol, number> {
  const m = new Map<OlympusSymbol, number>();
  for (const row of grid) {
    for (const cell of row) {
      if (!cell || cell === "bolt" || cell === "zeus") continue;
      m.set(cell, (m.get(cell) || 0) + 1);
    }
  }
  return m;
}

function collectOrbs(grid: Cell[][]): OrbHit[] {
  const out: OrbHit[] = [];
  for (let r = 0; r < OLYMPUS_ROWS; r++) {
    for (let c = 0; c < OLYMPUS_COLS; c++) {
      if (grid[r][c] === "bolt") {
        out.push({ r, c, value: pickOrbValue() });
      }
    }
  }
  return out;
}

/** Scatter pays: ≥8 identical anywhere */
function markWinsScatter(grid: Cell[][]): { r: number; c: number }[] {
  const cnt = countsPaying(grid);
  const winners = new Set<OlympusSymbol>();
  for (const [sym, n] of cnt) {
    if (n >= 8) winners.add(sym);
  }
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < OLYMPUS_ROWS; r++) {
    for (let c = 0; c < OLYMPUS_COLS; c++) {
      const s = grid[r][c];
      if (s && winners.has(s)) cells.push({ r, c });
    }
  }
  return cells;
}

function payScatter(grid: Cell[][], bet: number): number {
  const cnt = countsPaying(grid);
  let win = 0;
  for (const [sym, n] of cnt) {
    if (n < 8) continue;
    const tier = n >= 12 ? 3 : n >= 10 ? 2 : 1;
    win += bet * (PAY[sym] || 0.2) * tier;
  }
  return Math.round(win);
}

/** Cluster: ≥5 orthoginally connected same symbol */
function findClusters(grid: Cell[][]): { r: number; c: number }[] {
  const seen = Array.from({ length: OLYMPUS_ROWS }, () =>
    Array(OLYMPUS_COLS).fill(false),
  );
  const winCells: { r: number; c: number }[] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let r = 0; r < OLYMPUS_ROWS; r++) {
    for (let c = 0; c < OLYMPUS_COLS; c++) {
      const start = grid[r][c];
      if (
        !start ||
        start === "bolt" ||
        start === "zeus" ||
        seen[r][c]
      ) {
        continue;
      }
      const stack: { r: number; c: number }[] = [{ r, c }];
      const group: { r: number; c: number }[] = [];
      seen[r][c] = true;
      while (stack.length) {
        const cur = stack.pop()!;
        group.push(cur);
        for (const [dr, dc] of dirs) {
          const nr = cur.r + dr;
          const nc = cur.c + dc;
          if (
            nr < 0 ||
            nr >= OLYMPUS_ROWS ||
            nc < 0 ||
            nc >= OLYMPUS_COLS ||
            seen[nr][nc]
          ) {
            continue;
          }
          if (grid[nr][nc] === start) {
            seen[nr][nc] = true;
            stack.push({ r: nr, c: nc });
          }
        }
      }
      if (group.length >= 5) winCells.push(...group);
    }
  }
  return winCells;
}

function payCluster(
  grid: Cell[][],
  removed: { r: number; c: number }[],
  bet: number,
): number {
  // group removed by symbol
  const bySym = new Map<string, number>();
  for (const { r, c } of removed) {
    const s = grid[r][c];
    if (!s) continue;
    bySym.set(s, (bySym.get(s) || 0) + 1);
  }
  let win = 0;
  for (const [sym, n] of bySym) {
    const tier = n >= 12 ? 3 : n >= 8 ? 2 : 1;
    win += bet * (PAY[sym] || 0.2) * tier * Math.max(1, n / 5);
  }
  return Math.round(win);
}

function markWins(grid: Cell[][], payMode: PayMode): { r: number; c: number }[] {
  return payMode === "cluster" ? findClusters(grid) : markWinsScatter(grid);
}

function payFor(
  grid: Cell[][],
  bet: number,
  payMode: PayMode,
  removed: { r: number; c: number }[],
): number {
  return payMode === "cluster"
    ? payCluster(grid, removed, bet)
    : payScatter(grid, bet);
}

function tumble(grid: Cell[][], remove: { r: number; c: number }[]): Cell[][] {
  const g = grid.map((row) => [...row]);
  for (const { r, c } of remove) g[r][c] = null;
  if (remove.length) {
    for (let r = 0; r < OLYMPUS_ROWS; r++) {
      for (let c = 0; c < OLYMPUS_COLS; c++) {
        if (g[r][c] === "bolt") g[r][c] = null;
      }
    }
  }
  for (let c = 0; c < OLYMPUS_COLS; c++) {
    const stack: Cell[] = [];
    for (let r = OLYMPUS_ROWS - 1; r >= 0; r--) {
      if (g[r][c]) stack.push(g[r][c]);
    }
    for (let r = OLYMPUS_ROWS - 1; r >= 0; r--) {
      g[r][c] = stack.shift() ?? null;
    }
  }
  return fillGrid(g);
}

function maxZeusOnTumbles(tumbles: TumbleStep[]): number {
  let m = 0;
  for (const t of tumbles) m = Math.max(m, countSym(t.grid, "zeus"));
  return m;
}

type SpinOpts = {
  bet: number;
  payMode: PayMode;
  /** free-spin: use / update session accumMult */
  free?: FreeSpinsState | null;
  seed?: Cell[][];
};

function runSpin(opts: SpinOpts): {
  spinId: string;
  bet: number;
  grid: Cell[][];
  tumbles: TumbleStep[];
  totalWin: number;
  totalMult: number;
  maxCrown: number;
  maxZeus: number;
  accumMult: number;
  mode: "base" | "free";
  payMode: PayMode;
} {
  const { bet, payMode } = opts;
  const inFree = !!(opts.free && opts.free.left > 0);
  let grid = opts.seed
    ? fillGrid(opts.seed.map((row) => [...row]))
    : fillGrid();
  const tumbles: TumbleStep[] = [];
  let totalWin = 0;
  let spinMult = 0; // base: accumulates within this spin only
  let accumMult = inFree ? opts.free!.accumMult : 0;
  let maxCrown = 0;
  let maxZeus = 0;
  let guard = 0;

  while (guard++ < 12) {
    const cnt = countsPaying(grid);
    maxCrown = Math.max(maxCrown, cnt.get("crown") || 0);
    maxZeus = Math.max(maxZeus, countSym(grid, "zeus"));
    const removed = markWins(grid, payMode);
    const orbs = removed.length ? collectOrbs(grid) : [];
    const mults = orbs.map((o) => o.value);
    const stepWin = payFor(grid, bet, payMode, removed);

    if (!removed.length) {
      tumbles.push({
        grid: grid.map((row) => [...row]),
        removed: [],
        win: 0,
        multAdded: [],
        orbs: [],
      });
      break;
    }

    const mSum = mults.reduce((a, b) => a + b, 0);
    let applied: number;
    if (inFree) {
      accumMult += mSum;
      const factor = Math.max(1, accumMult || 1);
      applied = stepWin * factor;
      spinMult = accumMult;
    } else {
      spinMult += mSum;
      const factor = Math.max(1, spinMult || 1);
      applied = stepWin * factor;
    }

    totalWin += applied;
    tumbles.push({
      grid: grid.map((row) => [...row]),
      removed,
      win: applied,
      multAdded: mults,
      orbs,
    });
    grid = tumble(grid, removed);
  }

  maxZeus = Math.max(maxZeus, maxZeusOnTumbles(tumbles));

  return {
    spinId: randomUUID(),
    bet,
    grid: tumbles[tumbles.length - 1]?.grid ?? grid,
    tumbles,
    totalWin: Math.round(totalWin),
    totalMult: spinMult,
    maxCrown,
    maxZeus,
    accumMult: inFree ? accumMult : spinMult,
    mode: inFree ? "free" : "base",
    payMode,
  };
}

function awardOrRetriggerFs(
  purseId: string,
  bet: number,
  zeusCount: number,
  existing: FreeSpinsState | null | undefined,
): { state: FreeSpinsState | null; awarded: number } {
  if (zeusCount < 4) {
    return { state: existing ?? null, awarded: 0 };
  }
  if (existing && existing.left > 0) {
    const add = Math.min(FS_RETRIGGER, FS_CAP - existing.totalAwarded);
    if (add <= 0) return { state: existing, awarded: 0 };
    const next = {
      ...existing,
      left: existing.left + add,
      totalAwarded: existing.totalAwarded + add,
    };
    fsByPurse.set(purseId, next);
    return { state: next, awarded: add };
  }
  const next: FreeSpinsState = {
    left: FS_AWARD,
    totalAwarded: FS_AWARD,
    accumMult: 0,
    bet,
  };
  fsByPurse.set(purseId, next);
  return { state: next, awarded: FS_AWARD };
}

/** Hũ Olympus — góp từ mỗi ván, nổ theo crown/mult */
const OLY_JP_START = 80_000;
const OLY_JP_FLOOR = 8_000;
const OLY_JP_FEED = 0.03;
let jackpotPool = OLY_JP_START;
let jackpotLoaded = false;

async function ensureJackpotLoaded(): Promise<void> {
  if (jackpotLoaded) return;
  jackpotLoaded = true;
  if (kvReady()) {
    const v = await getKv("olympus:jackpot");
    if (v != null && Number.isFinite(Number(v))) {
      jackpotPool = Math.max(OLY_JP_FLOOR, Number(v));
    }
  }
}

async function persistJackpot(): Promise<void> {
  if (kvReady()) {
    await setKv("olympus:jackpot", String(Math.round(jackpotPool)), 0);
  }
}

function feedJackpot(bet: number): number {
  const add = Math.max(1, Math.floor(bet * OLY_JP_FEED));
  jackpotPool += add;
  return add;
}

function tryExplodeHu(input: {
  bet: number;
  totalWin: number;
  totalMult: number;
  maxCrown: number;
}): { tier: "mini" | "major" | "grand"; amount: number } | null {
  const { bet, totalWin, totalMult, maxCrown } = input;
  const bigHit =
    maxCrown >= 12 ||
    totalMult >= 45 ||
    (totalWin >= bet * 30 && Math.random() < 0.12);
  if (!bigHit) {
    if (Math.random() > 0.004) return null;
  }

  let tier: "mini" | "major" | "grand";
  let pct: number;
  if (maxCrown >= 14 || totalMult >= 80 || Math.random() < 0.1) {
    tier = "grand";
    pct = 1;
  } else if (maxCrown >= 12 || totalMult >= 50 || Math.random() < 0.4) {
    tier = "major";
    pct = 0.4;
  } else {
    tier = "mini";
    pct = 0.15;
  }

  const raw = Math.max(bet * 15, Math.floor(jackpotPool * pct));
  const amount = Math.min(raw, jackpotPool);
  if (amount < bet * 5) return null;
  jackpotPool = Math.max(OLY_JP_FLOOR, jackpotPool - amount);
  return { tier, amount };
}

function payHoldJackpot(
  filled: number,
  bet: number,
): { tier: "mini" | "major" | "grand"; amount: number } | null {
  if (filled < BOARD) return null;
  const tier: "mini" | "major" | "grand" =
    Math.random() < 0.15 ? "grand" : Math.random() < 0.45 ? "major" : "mini";
  const pct = tier === "grand" ? 1 : tier === "major" ? 0.4 : 0.15;
  const raw = Math.max(bet * 50, Math.floor(jackpotPool * pct));
  const amount = Math.min(raw, jackpotPool);
  jackpotPool = Math.max(OLY_JP_FLOOR, jackpotPool - amount);
  return { tier, amount };
}

function startHoldFromCrowns(bet: number, crownCount: number): HoldState {
  const cells: (number | null)[][] = emptyGrid().map((row) =>
    row.map(() => null as number | null),
  );
  let placed = 0;
  const target = Math.min(BOARD, Math.max(HOLD_TRIGGER_CROWNS, crownCount));
  while (placed < target) {
    const r = Math.floor(Math.random() * OLYMPUS_ROWS);
    const c = Math.floor(Math.random() * OLYMPUS_COLS);
    if (cells[r][c] != null) continue;
    cells[r][c] = [1, 2, 3, 5, 8, 10][Math.floor(Math.random() * 6)];
    placed++;
  }
  return { lives: HOLD_LIVES, bet, cells };
}

function countHoldFilled(cells: (number | null)[][]): number {
  let n = 0;
  for (const row of cells) for (const v of row) if (v != null) n++;
  return n;
}

function holdCashout(state: HoldState): number {
  let sum = 0;
  for (const row of state.cells) {
    for (const v of row) if (v != null) sum += v;
  }
  return Math.round(sum * state.bet);
}

function syncFsKv(purseId: string, state: FreeSpinsState | null): void {
  if (!kvReady()) return;
  void (async () => {
    if (!state || state.left <= 0) {
      await setKv(`olympus:fs:${purseId}`, "", 1);
    } else {
      await setKv(`olympus:fs:${purseId}`, JSON.stringify(state), 86400);
    }
  })();
}

/** Lab export — bot / scenario harness */
export function olympusLabSpin(bet: number, payMode: PayMode = "scatter") {
  return runSpin({ bet, payMode });
}

export function olympusShapeOk(payload: {
  tumbles?: TumbleStep[];
  grid?: Cell[][];
  totalWin?: number;
  bet?: number;
}): string[] {
  const faults: string[] = [];
  if (!Array.isArray(payload.tumbles) || !payload.tumbles.length) {
    faults.push("tumbles trống");
  }
  const g = payload.grid;
  if (!g || g.length !== OLYMPUS_ROWS) faults.push("grid rows != 5");
  else {
    for (const row of g) {
      if (!row || row.length !== OLYMPUS_COLS) faults.push("grid cols != 6");
      for (const cell of row) {
        if (cell != null && !(SYMBOLS as readonly string[]).includes(cell)) {
          faults.push(`symbol lạ:${cell}`);
        }
      }
    }
  }
  if (typeof payload.totalWin !== "number" || payload.totalWin < 0) {
    faults.push("totalWin âm/invalid");
  }
  if (payload.bet != null && !(BETS as readonly number[]).includes(payload.bet)) {
    faults.push("bet ngoài bảng");
  }
  for (const step of payload.tumbles ?? []) {
    if (step.removed?.length && step.win < 0) faults.push("step win âm");
    for (const p of step.removed ?? []) {
      if (p.r < 0 || p.r >= OLYMPUS_ROWS || p.c < 0 || p.c >= OLYMPUS_COLS) {
        faults.push("removed OOB");
      }
    }
  }
  return faults;
}

async function persistSpin(
  userId: string,
  result: SpinResult,
): Promise<void> {
  if (dbReady()) {
    await query(
      `INSERT INTO olympus_spins (id, user_id, room_id, bet, win, mult, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        result.spinId,
        userId,
        "olympus-main",
        result.bet,
        result.totalWin,
        result.totalMult,
        JSON.stringify({
          tumbles: result.tumbles.length,
          balance: result.balance,
          mode: result.mode,
        }),
      ],
    );
    await appendLedger({
      userId,
      kind: result.totalWin > 0 ? "olympus_win" : "olympus_bet",
      amount: result.totalWin - (result.mode === "free" ? 0 : result.bet),
      balanceAfter: result.balance,
      ref: result.spinId,
      meta: { game: "olympus", mult: result.totalMult, mode: result.mode },
    });
  }
  if (kvReady()) {
    await setKv(
      `olympus:last:${userId}`,
      JSON.stringify({
        spinId: result.spinId,
        win: result.totalWin,
        at: Date.now(),
      }),
      3600,
    );
    await setKv(`olympus:bal:${userId}`, String(result.balance), 86400);
  }
}

function storageMode(purse: Purse): string {
  if (purse.kind === "auth") {
    return dbReady() ? "auth+postgres" : "authStore";
  }
  if (dbReady()) return "postgres+ledger";
  if (kvReady()) return "redis-cache";
  return "memory";
}

function parsePayMode(raw: unknown): PayMode {
  return raw === "cluster" ? "cluster" : "scatter";
}

async function hydrateGuestBal(purse: Purse): Promise<void> {
  if (purse.kind === "auth" || !kvReady()) return;
  const cached = await getKv(`olympus:bal:${purse.id}`);
  if (cached != null) {
    const cur = purse.bal();
    const want = Number(cached) || cur;
    if (want !== cur) purse.credit(want - cur);
  }
}

export function mountOlympusRoutes(app: Express): void {
  app.get("/api/olympus/meta", async (_req, res) => {
    await ensureJackpotLoaded();
    const cfg = loadPlatformConfig();
    res.json({
      ok: true,
      title: "BoltPeak",
      aka: "BoltPeak · tumble slot demo giáo dục SOFIAORE (original)",
      officialNote:
        "Original SOFIAORE educational demo — not affiliated with any third-party slot brand. Virtual xu only.",
      cols: OLYMPUS_COLS,
      rows: OLYMPUS_ROWS,
      symbols: SYMBOLS,
      bets: BETS,
      orbValues: ORB_VALUES,
      freeSpinsAward: FS_AWARD,
      freeSpinsRetrigger: FS_RETRIGGER,
      buyBonusMult: BUY_BONUS_MULT,
      holdTriggerCrowns: HOLD_TRIGGER_CROWNS,
      jackpotPool: Math.round(jackpotPool),
      jackpotFeedRate: OLY_JP_FEED,
      mechanics: MECHANICS,
      cloud: {
        postgres: dbReady(),
        redis: kvReady(),
        minio: cfg.minioEndpoint,
        livekit: cfg.livekitUrl,
      },
    });
  });

  app.get("/api/olympus/jackpot", async (_req, res) => {
    await ensureJackpotLoaded();
    res.json({
      ok: true,
      pool: Math.round(jackpotPool),
      feedRate: OLY_JP_FEED,
      floor: OLY_JP_FLOOR,
    });
  });

  app.get("/api/olympus/session", async (req, res) => {
    await ensureJackpotLoaded();
    const purse = resolvePurse(req);
    if (!isPurse(purse)) {
      res.status(401).json({ ok: false, reason: "Token không hợp lệ" });
      return;
    }
    await hydrateGuestBal(purse);
    const fs = fsByPurse.get(purse.id) ?? null;
    const hold = holdByPurse.get(purse.id) ?? null;
    res.json({
      ok: true,
      userId: purse.id,
      wallet: purse.kind,
      balance: purse.bal(),
      jackpotPool: Math.round(jackpotPool),
      bets: BETS,
      freeSpins: fs && fs.left > 0 ? fs : null,
      hold: hold
        ? {
            lives: hold.lives,
            bet: hold.bet,
            filled: countHoldFilled(hold.cells),
            cells: hold.cells,
          }
        : null,
      storage: {
        postgres: dbReady(),
        redis: kvReady(),
        minio: loadPlatformConfig().minioEndpoint,
        authStore: purse.kind === "auth",
      },
    });
  });

  app.post("/api/olympus/spin", async (req, res) => {
    try {
      await ensureJackpotLoaded();
      const purse = resolvePurse(req);
      if (!isPurse(purse)) {
        res.status(401).json({ ok: false, reason: "Token không hợp lệ" });
        return;
      }
      if (holdByPurse.has(purse.id)) {
        res.status(400).json({
          ok: false,
          reason: "Đang Hold & Spin — dùng /api/olympus/hold/spin",
        });
        return;
      }
      if (!rateLimit(`oly:spin:${purse.id}`, 120, 60_000)) {
        res.status(429).json({
          ok: false,
          reason: "Quá nhiều lần quay — chờ khoảng 1 phút rồi thử lại",
        });
        return;
      }

      const payMode = parsePayMode(req.body?.payMode);
      let fs = fsByPurse.get(purse.id);
      const inFree = !!(fs && fs.left > 0);
      const rawBet = req.body?.bet;
      const bet = inFree
        ? fs!.bet
        : Number(rawBet);

      if (
        !inFree &&
        (!Number.isFinite(bet) || !(BETS as readonly number[]).includes(bet))
      ) {
        res.status(400).json({ ok: false, reason: "Mức cược không hợp lệ" });
        return;
      }

      await hydrateGuestBal(purse);

      let contrib = 0;
      if (!inFree) {
        if (purse.bal() < bet) {
          res.status(400).json({
            ok: false,
            reason:
              purse.kind === "auth" ? "Không đủ xu" : "Không đủ xu demo",
          });
          return;
        }
        const debit = purse.credit(-bet);
        if (!debit.ok) {
          res.status(400).json({ ok: false, reason: debit.reason });
          return;
        }
        contrib = feedJackpot(bet);
      }

      const raw = runSpin({
        bet,
        payMode: inFree ? "scatter" : payMode,
        free: inFree ? fs! : null,
      });
      const shapeFaults = olympusShapeOk(raw);
      if (shapeFaults.length) {
        if (!inFree) {
          purse.credit(bet);
          jackpotPool = Math.max(OLY_JP_FLOOR, jackpotPool - contrib);
        }
        res.status(500).json({
          ok: false,
          reason: `engine shape: ${shapeFaults.join(",")}`,
        });
        return;
      }

      // Free-spin bookkeeping
      let fsAwarded = 0;
      if (inFree && fs) {
        fs = {
          ...fs,
          left: fs.left - 1,
          accumMult: raw.accumMult,
        };
        const trig = awardOrRetriggerFs(purse.id, bet, raw.maxZeus, fs);
        fs = trig.state;
        fsAwarded = trig.awarded;
        if (fs && fs.left <= 0) {
          fsByPurse.delete(purse.id);
          fs = null;
        } else if (fs) {
          fsByPurse.set(purse.id, fs);
        }
        syncFsKv(purse.id, fs);
      } else {
        const trig = awardOrRetriggerFs(purse.id, bet, raw.maxZeus, null);
        fs = trig.state;
        fsAwarded = trig.awarded;
        syncFsKv(purse.id, fs);
      }

      let holdTriggered = false;
      if (
        !inFree &&
        !fsAwarded &&
        raw.maxCrown >= HOLD_TRIGGER_CROWNS &&
        !holdByPurse.has(purse.id)
      ) {
        holdByPurse.set(
          purse.id,
          startHoldFromCrowns(bet, raw.maxCrown),
        );
        holdTriggered = true;
      }

      const hit =
        inFree || holdTriggered
          ? null
          : tryExplodeHu({
              bet,
              totalWin: raw.totalWin,
              totalMult: raw.totalMult,
              maxCrown: raw.maxCrown,
            });
      const jackpotPay = hit?.amount || 0;
      const credit = purse.credit(raw.totalWin + jackpotPay);
      if (!credit.ok) {
        res.status(500).json({ ok: false, reason: credit.reason });
        return;
      }
      await persistJackpot();

      if (purse.kind === "auth" && dbReady()) {
        const u = authStore.getById(purse.userId);
        if (u) {
          await upsertUserMirror({
            id: u.id,
            username: u.username,
            balance: u.balance,
            gem: u.gemBalance,
            banned: !!u.banned,
          });
        }
      }

      const cfg = loadPlatformConfig();
      const {
        maxCrown: _mc,
        maxZeus: _mz,
        ...spinBody
      } = raw;
      const result: SpinResult = {
        ...spinBody,
        balance: credit.balance,
        jackpotPool: Math.round(jackpotPool),
        jackpotContrib: contrib,
        jackpotHit: hit,
        freeSpins: fs && fs.left > 0 ? fs : null,
        fsAwarded,
        holdTriggered,
        storage: {
          postgres: dbReady(),
          redis: kvReady(),
          minio: cfg.minioEndpoint,
          mode: storageMode(purse),
        },
      };
      await persistSpin(purse.id, result);
      if (hit && dbReady()) {
        await appendLedger({
          userId: purse.id,
          kind: `olympus_jackpot_${hit.tier}`,
          amount: hit.amount,
          balanceAfter: credit.balance,
          ref: raw.spinId,
          meta: { game: "olympus", tier: hit.tier, poolAfter: jackpotPool },
        });
      }
      res.json({
        ok: true,
        wallet: purse.kind,
        payout: raw.totalWin + jackpotPay,
        ...result,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });

  /** Bonus Buy — 100× bet → 15 Free Spins */
  app.post("/api/olympus/buy-bonus", async (req, res) => {
    try {
      await ensureJackpotLoaded();
      const purse = resolvePurse(req);
      if (!isPurse(purse)) {
        res.status(401).json({ ok: false, reason: "Token không hợp lệ" });
        return;
      }
      if (holdByPurse.has(purse.id)) {
        res.status(400).json({ ok: false, reason: "Đang Hold & Spin" });
        return;
      }
      const existing = fsByPurse.get(purse.id);
      if (existing && existing.left > 0) {
        res.status(400).json({ ok: false, reason: "Đang trong Free Spins" });
        return;
      }
      if (!rateLimit(`oly:buy:${purse.id}`, 20, 60_000)) {
        res.status(429).json({ ok: false, reason: "Quá nhiều lần mua bonus" });
        return;
      }
      const bet = Number(req.body?.bet);
      if (!Number.isFinite(bet) || !(BETS as readonly number[]).includes(bet)) {
        res.status(400).json({ ok: false, reason: "Mức cược không hợp lệ" });
        return;
      }
      await hydrateGuestBal(purse);
      const cost = bet * BUY_BONUS_MULT;
      if (purse.bal() < cost) {
        res.status(400).json({ ok: false, reason: "Không đủ xu mua Free Spins" });
        return;
      }
      const debit = purse.credit(-cost);
      if (!debit.ok) {
        res.status(400).json({ ok: false, reason: debit.reason });
        return;
      }
      feedJackpot(bet);
      const fs: FreeSpinsState = {
        left: FS_AWARD,
        totalAwarded: FS_AWARD,
        accumMult: 0,
        bet,
      };
      fsByPurse.set(purse.id, fs);
      syncFsKv(purse.id, fs);
      await persistJackpot();
      if (kvReady()) {
        await setKv(`olympus:bal:${purse.id}`, String(debit.balance), 86400);
      }
      res.json({
        ok: true,
        cost,
        balance: debit.balance,
        freeSpins: fs,
        jackpotPool: Math.round(jackpotPool),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });

  /** Hold & Spin — one respin */
  app.post("/api/olympus/hold/spin", async (req, res) => {
    try {
      await ensureJackpotLoaded();
      const purse = resolvePurse(req);
      if (!isPurse(purse)) {
        res.status(401).json({ ok: false, reason: "Token không hợp lệ" });
        return;
      }
      const hold = holdByPurse.get(purse.id);
      if (!hold) {
        res.status(400).json({ ok: false, reason: "Không có phiên Hold & Spin" });
        return;
      }
      if (!rateLimit(`oly:hold:${purse.id}`, 120, 60_000)) {
        res.status(429).json({ ok: false, reason: "Rate limit hold" });
        return;
      }

      let newBonus = 0;
      const next = hold.cells.map((row) => [...row]);
      for (let r = 0; r < OLYMPUS_ROWS; r++) {
        for (let c = 0; c < OLYMPUS_COLS; c++) {
          if (next[r][c] != null) continue;
          // ~22% chance new crown
          if (Math.random() < 0.22) {
            next[r][c] = [1, 2, 3, 5, 8, 10, 15][
              Math.floor(Math.random() * 7)
            ];
            newBonus++;
          }
        }
      }

      let lives = newBonus > 0 ? HOLD_LIVES : hold.lives - 1;
      const filled = countHoldFilled(next);
      let state: HoldState = { ...hold, cells: next, lives };
      let finished = false;
      let payout = 0;
      let jackpotHit: SpinResult["jackpotHit"] = null;

      if (filled >= BOARD) {
        jackpotHit = payHoldJackpot(filled, hold.bet);
        payout = (jackpotHit?.amount || 0) + holdCashout(state);
        finished = true;
      } else if (lives <= 0) {
        payout = holdCashout(state);
        finished = true;
      }

      if (finished) {
        holdByPurse.delete(purse.id);
        const credit = purse.credit(payout);
        await persistJackpot();
        if (kvReady()) {
          await setKv(
            `olympus:bal:${purse.id}`,
            String(credit.balance),
            86400,
          );
        }
        res.json({
          ok: true,
          finished: true,
          newBonus,
          filled,
          lives: 0,
          cells: next,
          payout,
          jackpotHit,
          balance: credit.ok ? credit.balance : purse.bal(),
          jackpotPool: Math.round(jackpotPool),
        });
        return;
      }

      holdByPurse.set(purse.id, state);
      res.json({
        ok: true,
        finished: false,
        newBonus,
        filled,
        lives: state.lives,
        cells: next,
        payout: 0,
        jackpotHit: null,
        balance: purse.bal(),
        jackpotPool: Math.round(jackpotPool),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post("/api/olympus/topup", async (req, res) => {
    const purse = resolvePurse(req);
    if (!isPurse(purse)) {
      res.status(401).json({ ok: false, reason: "Token không hợp lệ" });
      return;
    }
    if (purse.kind === "auth") {
      res.status(403).json({
        ok: false,
        reason: "Tài khoản login dùng nạp xu hệ thống — không topup demo",
      });
      return;
    }
    if (!rateLimit(`oly:topup:${purse.id}`, 30, 60_000)) {
      res.status(429).json({ ok: false, reason: "Quá nhiều lần nạp demo" });
      return;
    }
    const amount = Math.min(
      100_000,
      Math.max(1000, Number(req.body?.amount) || 10_000),
    );
    const r = purse.credit(amount);
    if (!r.ok) {
      res.status(400).json({ ok: false, reason: r.reason });
      return;
    }
    if (kvReady()) await setKv(`olympus:bal:${purse.id}`, String(r.balance), 86400);
    res.json({ ok: true, balance: r.balance, added: amount });
  });

  app.post("/api/olympus/lab/set-balance", async (req, res) => {
    if (process.env.OLYMPUS_LAB !== "1" && process.env.NODE_ENV === "production") {
      res.status(404).json({ ok: false });
      return;
    }
    const purse = resolvePurse(req);
    if (!isPurse(purse)) {
      res.status(401).json({ ok: false, reason: "Token không hợp lệ" });
      return;
    }
    if (purse.kind === "auth") {
      res.status(403).json({ ok: false, reason: "Lab set-balance chỉ guest" });
      return;
    }
    const bal = Math.max(0, Math.round(Number(req.body?.balance) || 0));
    const cur = purse.bal();
    purse.credit(bal - cur);
    if (kvReady()) await setKv(`olympus:bal:${purse.id}`, String(bal), 86400);
    res.json({ ok: true, userId: purse.id, balance: bal });
  });

  app.post("/api/olympus/lab/force-fs", async (req, res) => {
    if (process.env.NODE_ENV === "production" && process.env.OLYMPUS_LAB !== "1") {
      res.status(404).json({ ok: false });
      return;
    }
    const purse = resolvePurse(req);
    if (!isPurse(purse)) {
      res.status(401).json({ ok: false, reason: "Token không hợp lệ" });
      return;
    }
    const bet = Number(req.body?.bet) || 100;
    const left = Math.min(
      FS_CAP,
      Math.max(1, Math.round(Number(req.body?.left) || FS_AWARD)),
    );
    const accumMult = Math.max(
      0,
      Math.round(Number(req.body?.accumMult) || 0),
    );
    const fs: FreeSpinsState = {
      left,
      totalAwarded: left,
      accumMult,
      bet: (BETS as readonly number[]).includes(bet) ? bet : 100,
    };
    fsByPurse.set(purse.id, fs);
    holdByPurse.delete(purse.id);
    syncFsKv(purse.id, fs);
    res.json({ ok: true, freeSpins: fs });
  });

  app.post("/api/olympus/lab/start-hold", async (req, res) => {
    if (process.env.NODE_ENV === "production" && process.env.OLYMPUS_LAB !== "1") {
      res.status(404).json({ ok: false });
      return;
    }
    const purse = resolvePurse(req);
    if (!isPurse(purse)) {
      res.status(401).json({ ok: false, reason: "Token không hợp lệ" });
      return;
    }
    const bet = Number(req.body?.bet) || 100;
    const crowns = Math.max(
      HOLD_TRIGGER_CROWNS,
      Math.round(Number(req.body?.crowns) || HOLD_TRIGGER_CROWNS),
    );
    const hold = startHoldFromCrowns(
      (BETS as readonly number[]).includes(bet) ? bet : 100,
      crowns,
    );
    holdByPurse.set(purse.id, hold);
    fsByPurse.delete(purse.id);
    res.json({
      ok: true,
      hold: {
        lives: hold.lives,
        bet: hold.bet,
        filled: countHoldFilled(hold.cells),
        cells: hold.cells,
      },
    });
  });

  app.post("/api/olympus/lab/clear-limits", (_req, res) => {
    if (process.env.NODE_ENV === "production" && process.env.OLYMPUS_LAB !== "1") {
      res.status(404).json({ ok: false });
      return;
    }
    const n =
      clearRateBuckets("oly:") +
      clearRateBuckets("http-oly:") +
      clearRateBuckets("http:");
    res.json({ ok: true, cleared: n });
  });
}

void (null as unknown as Response);
