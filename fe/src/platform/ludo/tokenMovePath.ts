/** Reconstruct cell-by-cell path when server jumps token from→to in one update. */

export type LudoColor = "red" | "green" | "yellow" | "blue";

const START: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const TURN: Record<LudoColor, number> = {
  red: 50,
  green: 11,
  yellow: 24,
  blue: 37,
};

const BASE = -1;
const HOME = 105;
const HOME_PATH_START = 100;
const HOME_PATH_END = 104;

/** One legal step forward (or null if stuck). */
export function stepOnce(color: LudoColor, pos: number): number | null {
  if (pos === HOME) return null;
  if (pos === BASE) return START[color] ?? null;

  if (pos >= HOME_PATH_START && pos <= HOME_PATH_END) {
    return pos === HOME_PATH_END ? HOME : pos + 1;
  }

  if (pos === TURN[color]) return HOME_PATH_START;
  if (pos >= 0 && pos <= 51) return (pos + 1) % 52;
  return null;
}

/**
 * Path of positions including `from`, ending at `to`.
 * Capture / reset → base is a single hop.
 */
export function buildMovePath(
  color: string,
  from: number,
  to: number,
): number[] {
  const c = color as LudoColor;
  if (from === to) return [to];

  /* Sent home (capture) or leave board */
  if (to === BASE) return [from, BASE];

  /* Exit yard — usually BASE → START */
  if (from === BASE) return [BASE, to];

  const path: number[] = [from];
  let p = from;
  for (let i = 0; i < 60; i++) {
    const next = stepOnce(c, p);
    if (next == null) break;
    path.push(next);
    p = next;
    if (p === to) return path;
  }

  /* Fallback: teleport if path could not be reconstructed */
  return [from, to];
}

/** Skip long teleports (rejoin / sync) — still hop once. */
export function shouldAnimatePath(path: number[]): boolean {
  const steps = Math.max(0, path.length - 1);
  return steps >= 1 && steps <= 8;
}

export const TOKEN_STEP_MS = 260;
export const TOKEN_HOP_MS = 280;
