/**
 * Ludo pure engine — index coords per product spec.
 * Track 0..51, home path 100..104, home 105, base -1.
 */

export type LudoColor = "red" | "green" | "yellow" | "blue";

export const LUDO_COLORS: LudoColor[] = ["red", "green", "yellow", "blue"];

export const START: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

export const TURN: Record<LudoColor, number> = {
  red: 50,
  green: 11,
  yellow: 24,
  blue: 37,
};

export const SAFE_ZONES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const BASE = -1;
export const HOME = 105;
export const HOME_PATH_START = 100;
export const HOME_PATH_END = 104;

export type LudoToken = {
  id: string;
  color: LudoColor;
  index: number; // 0..3 within color
  pos: number;
};

export type LudoPlayer = {
  seat: number;
  color: LudoColor;
  userId: string | null;
  guestId: string | null;
  displayName: string;
  isBot: boolean;
  strikes: number;
  connected: boolean;
  avatar?: string | null;
  avatarFrame?: string | null;
  pawnDecorId?: string | null;
};

export type TurnPhase =
  | "wait_roll"
  | "wait_pick"
  | "animating"
  | "finished";

export type LudoThemeId =
  | "classic"
  | "soccer"
  | "arena"
  | "garden"
  | "neon"
  | "frost";

export const LUDO_THEME_IDS: LudoThemeId[] = [
  "classic",
  "soccer",
  "arena",
  "garden",
  "neon",
  "frost",
];

/** Free at room create (no shop unlock). */
export const LUDO_FREE_THEME_IDS: LudoThemeId[] = [
  "classic",
  "soccer",
  "arena",
];

export function isLudoThemeId(raw: unknown): raw is LudoThemeId {
  return LUDO_THEME_IDS.includes(String(raw ?? "").trim().toLowerCase() as LudoThemeId);
}

export function normalizeLudoThemeId(raw: unknown): LudoThemeId {
  const s = String(raw ?? "").trim().toLowerCase();
  if (isLudoThemeId(s)) return s;
  return "classic";
}

export function isFreeLudoTheme(id: LudoThemeId): boolean {
  return LUDO_FREE_THEME_IDS.includes(id);
}

/** Shop item id for a board theme. */
export function boardDecorIdForTheme(id: LudoThemeId): string {
  return `board-${id}`;
}

export type LudoDiceMode = 1 | 2;

export function normalizeLudoDiceMode(raw: unknown): LudoDiceMode {
  const n = Math.floor(Number(raw));
  return n === 2 ? 2 : 1;
}

export type LudoPublicState = {
  roomId: string;
  status: "lobby" | "playing" | "finished";
  players: LudoPlayer[];
  tokens: LudoToken[];
  turnSeat: number;
  phase: TurnPhase;
  /** Active face for the current pick (1–6). */
  dice: number | null;
  /** Last single face — FX / panel when dice cleared. */
  lastDice: number | null;
  /** Faces from the last roll (1 or 2). */
  diceFaces: number[];
  lastDiceFaces: number[];
  /** Remaining faces still to play this roll (dual mode). */
  pendingDice: number[];
  /**
   * Per-face legal tokens while wait_pick (especially dual-dice:
   * client selects a die, then only that face’s tokens).
   */
  pendingMoves: { dieIndex: number; face: number; tokenIds: string[] }[];
  /** 1 = classic · 2 = roll two dice, play each face. */
  diceMode: LudoDiceMode;
  /** Monotonic roll counter — bumps every roll for FX. */
  rollSeq: number;
  /** Seat that performed the last roll (for throw origin). */
  lastRollSeat: number | null;
  validTokenIds: string[];
  consecutiveSixes: number;
  turnDeadline: number;
  winnerSeat: number | null;
  lastEvent: string | null;
  stake: number;
  pot: number;
  settled: boolean;
  themeId: LudoThemeId;
  hostUserId?: string | null;
};

export function tokenId(color: LudoColor, index: number): string {
  return `${color}_${index}`;
}

export function createTokens(): LudoToken[] {
  const out: LudoToken[] = [];
  for (const color of LUDO_COLORS) {
    for (let i = 0; i < 4; i++) {
      out.push({ id: tokenId(color, i), color, index: i, pos: BASE });
    }
  }
  return out;
}

/** Walk `steps` from `pos` for `color`. null = illegal. */
export function computeDest(
  color: LudoColor,
  pos: number,
  steps: number,
): number | null {
  if (!Number.isInteger(steps) || steps < 1 || steps > 6) return null;
  if (pos === HOME) return null;

  if (pos === BASE) {
    return steps === 6 ? START[color] : null;
  }

  let p = pos;
  for (let s = 0; s < steps; s++) {
    if (p === HOME) return null;

    if (p >= HOME_PATH_START && p <= HOME_PATH_END) {
      if (p === HOME_PATH_END) {
        p = HOME;
      } else {
        p = p + 1;
      }
      continue;
    }

    /* on main track */
    if (p === TURN[color]) {
      p = HOME_PATH_START;
      continue;
    }
    p = (p + 1) % 52;
  }

  return p;
}

export function tokensForColor(
  tokens: LudoToken[],
  color: LudoColor,
): LudoToken[] {
  return tokens.filter((t) => t.color === color);
}

export function validTokenIds(
  tokens: LudoToken[],
  color: LudoColor,
  dice: number,
): string[] {
  return tokensForColor(tokens, color)
    .filter((t) => t.pos !== HOME && computeDest(color, t.pos, dice) != null)
    .map((t) => t.id);
}

export type MoveResult = {
  tokens: LudoToken[];
  captured: boolean;
  enteredHome: boolean;
  dest: number;
};

export function applyMove(
  tokens: LudoToken[],
  tokenIdMove: string,
  dice: number,
): MoveResult | null {
  const tok = tokens.find((t) => t.id === tokenIdMove);
  if (!tok) return null;
  const dest = computeDest(tok.color, tok.pos, dice);
  if (dest == null) return null;

  const next = tokens.map((t) =>
    t.id === tokenIdMove ? { ...t, pos: dest } : { ...t },
  );

  let captured = false;
  if (dest >= 0 && dest <= 51 && !SAFE_ZONES.has(dest)) {
    for (const t of next) {
      if (t.id === tokenIdMove) continue;
      if (t.color === tok.color) continue;
      if (t.pos === dest) {
        t.pos = BASE;
        captured = true;
      }
    }
  }

  return {
    tokens: next,
    captured,
    enteredHome: dest === HOME,
    dest,
  };
}

export function colorFinished(tokens: LudoToken[], color: LudoColor): boolean {
  return tokensForColor(tokens, color).every((t) => t.pos === HOME);
}

/**
 * After a successful move with this dice value:
 * - 3rd consecutive 6 → forfeit (caller handles before move)
 * - else extra turn if dice===6 || captured || enteredHome
 */
export function earnsExtraTurn(
  dice: number,
  captured: boolean,
  enteredHome: boolean,
): boolean {
  return dice === 6 || captured || enteredHome;
}

export function pickAutoToken(validIds: string[]): string | null {
  if (validIds.length === 0) return null;
  if (validIds.length === 1) return validIds[0]!;
  return validIds[Math.floor(Math.random() * validIds.length)]!;
}
