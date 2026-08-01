/**
 * Ludo 15×15 grid → % (legacy) and world X/Z for R3F.
 * Track 0..51, home 100..104, finish 105, base -1.
 * Starts: red 0, green 13, yellow 26, blue 39 (engine).
 */

export type BoardXY = { x: number; y: number };
export type WorldPos = [number, number, number];

export const GRID = 15;
export const CELL = 1;
export const BOARD_HALF = ((GRID - 1) / 2) * CELL; // 7
/** Outer wood slab size used by R3F mesh (grid + rim). */
export const BOARD_WORLD_SIZE = GRID * CELL + 0.6;
export const PAWN_Y = 0.55;

export type LudoColor = "red" | "green" | "yellow" | "blue";

/**
 * Classic 52-cell ring (Bijanrai): from red start go up/left then around.
 * Matches engine START 0/13/26/39 and TURN 50/11/24/37.
 * Red BL → Green left/TL → Yellow top/TR → Blue right/BR.
 */
const TRACK_CR: [number, number][] = [
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  [0, 7],
  [0, 6],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [7, 0],
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  [14, 7],
  [14, 8],
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  [7, 14],
  [6, 14],
];

/** Home stretch into center (engine 100..104) — mouth next to TURN cells. */
const HOME_CR: Record<LudoColor, [number, number][]> = {
  red: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  green: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  yellow: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  blue: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
};

const HOME_CENTER_CR: [number, number] = [7, 7];

/** Yard pads — Red BL, Green TL, Yellow TR, Blue BR (near starts). */
export const BASE_CR: Record<LudoColor, [number, number][]> = {
  red: [
    [1.5, 10.5],
    [3.5, 10.5],
    [1.5, 12.5],
    [3.5, 12.5],
  ],
  green: [
    [1.5, 1.5],
    [3.5, 1.5],
    [1.5, 3.5],
    [3.5, 3.5],
  ],
  yellow: [
    [10.5, 1.5],
    [12.5, 1.5],
    [10.5, 3.5],
    [12.5, 3.5],
  ],
  blue: [
    [10.5, 10.5],
    [12.5, 10.5],
    [10.5, 12.5],
    [12.5, 12.5],
  ],
};

export const BASE_PLATFORMS: Record<
  LudoColor,
  { col0: number; row0: number }
> = {
  red: { col0: 0, row0: 9 },
  green: { col0: 0, row0: 0 },
  yellow: { col0: 9, row0: 0 },
  blue: { col0: 9, row0: 9 },
};

export const PLAYER_COLORS: Record<LudoColor, string> = {
  red: "#e53935",
  green: "#43a047",
  yellow: "#fdd835",
  blue: "#1e88e5",
};

export const SAFE_VISUAL = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const SUIT_MARKS: {
  col: number;
  row: number;
  symbol: string;
  color: string;
}[] = [
  { col: 6, row: 13, symbol: "♥", color: "#ffffff" }, // red start
  { col: 1, row: 6, symbol: "♣", color: "#ffffff" }, // green start
  { col: 8, row: 1, symbol: "♦", color: "#333333" }, // yellow start
  { col: 13, row: 8, symbol: "♠", color: "#ffffff" }, // blue start
  { col: 2, row: 8, symbol: "♥", color: "#c62828" },
  { col: 6, row: 2, symbol: "♣", color: "#1b5e20" },
  { col: 12, row: 6, symbol: "♦", color: "#f9a825" },
  { col: 8, row: 12, symbol: "♠", color: "#0d47a1" },
];

function crToXy(c: number, r: number): BoardXY {
  return {
    x: ((c + 0.5) / GRID) * 100,
    y: ((r + 0.5) / GRID) * 100,
  };
}

export function gridToWorld(
  col: number,
  row: number,
  y = 0,
): WorldPos {
  return [(col - BOARD_HALF) * CELL, y, (row - BOARD_HALF) * CELL];
}

export function worldToGrid(
  x: number,
  z: number,
): { col: number; row: number } {
  return {
    col: Math.round(x / CELL + BOARD_HALF),
    row: Math.round(z / CELL + BOARD_HALF),
  };
}

export function trackCell(index: number): [number, number] | null {
  if (index < 0 || index >= TRACK_CR.length) return null;
  return TRACK_CR[index]!;
}

export function isInBase(col: number, row: number): LudoColor | null {
  for (const color of Object.keys(BASE_PLATFORMS) as LudoColor[]) {
    const b = BASE_PLATFORMS[color];
    if (
      col >= b.col0 &&
      col < b.col0 + 6 &&
      row >= b.row0 &&
      row < b.row0 + 6
    ) {
      return color;
    }
  }
  return null;
}

export function isCenter(col: number, row: number): boolean {
  return col >= 6 && col <= 8 && row >= 6 && row <= 8;
}

export function isOnCross(col: number, row: number): boolean {
  return (col >= 6 && col <= 8) || (row >= 6 && row <= 8);
}

export function homeColumnColor(
  col: number,
  row: number,
): LudoColor | null {
  if (col === 7 && row >= 9 && row <= 13) return "red"; // bottom
  if (row === 7 && col >= 1 && col <= 5) return "green"; // left
  if (col === 7 && row >= 1 && row <= 5) return "yellow"; // top
  if (row === 7 && col >= 9 && col <= 13) return "blue"; // right
  return null;
}

export function startTileColor(
  col: number,
  row: number,
): LudoColor | null {
  const starts: [LudoColor, number][] = [
    ["red", 0],
    ["green", 13],
    ["yellow", 26],
    ["blue", 39],
  ];
  for (const [color, idx] of starts) {
    const cr = TRACK_CR[idx];
    if (cr && cr[0] === col && cr[1] === row) return color;
  }
  return null;
}

/** Raised track / home-column tiles (not base fill, not center). */
export function isBoardTile(col: number, row: number): boolean {
  if (isInBase(col, row)) return false;
  if (isCenter(col, row)) return false;
  if (homeColumnColor(col, row)) return true;
  if (!isOnCross(col, row)) {
    // Outer ring cells used by TRACK_CR (edges 0 / 14)
    for (const [c, r] of TRACK_CR) {
      if (c === col && r === row) return true;
    }
    return false;
  }
  return true;
}

function posToCr(
  color: string,
  pos: number,
  tokenIndex: number,
): [number, number] {
  const c = color as LudoColor;
  if (pos === -1) {
    return BASE_CR[c]?.[tokenIndex] ?? HOME_CENTER_CR;
  }
  if (pos === 105) return HOME_CENTER_CR;
  if (pos >= 100 && pos <= 104) {
    return HOME_CR[c]?.[pos - 100] ?? HOME_CENTER_CR;
  }
  if (pos >= 0 && pos < TRACK_CR.length) return TRACK_CR[pos]!;
  return HOME_CENTER_CR;
}

export function posToXy(
  color: string,
  pos: number,
  tokenIndex: number,
): BoardXY {
  const [c, r] = posToCr(color, pos, tokenIndex);
  return crToXy(c, r);
}

export function posToWorld(
  color: string,
  pos: number,
  tokenIndex: number,
  y = PAWN_Y,
): WorldPos {
  const [c, r] = posToCr(color, pos, tokenIndex);
  return gridToWorld(c, r, y);
}
