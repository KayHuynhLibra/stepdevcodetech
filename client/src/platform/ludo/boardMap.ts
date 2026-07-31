/** Map Ludo track index → board % on a 15×15 logical grid (isometric CSS). */

export type BoardXY = { x: number; y: number };

function crToXy(c: number, r: number): BoardXY {
  return {
    x: ((c + 0.5) / 15) * 100,
    y: ((r + 0.5) / 15) * 100,
  };
}

/** Build exactly 52 cells (13 per side). */
function buildTrack(): BoardXY[] {
  const cells: [number, number][] = [];
  /* 0–12 toward green */
  for (let r = 13; r >= 8; r--) cells.push([6, r]); // 6
  cells.push([7, 8]); // 7
  for (let c = 8; c <= 13; c++) cells.push([c, 6]); // 6 → total 13
  /* 13–25 toward yellow */
  for (let r = 5; r >= 0; r--) cells.push([13, r]); // 6
  cells.push([12, 0]); // 7
  for (let c = 11; c >= 6; c--) cells.push([c, 1]); // 6 → 13
  /* 26–38 toward blue */
  for (let c = 5; c >= 0; c--) cells.push([c, 1]); // 6 — wait wrong

  /* Reset with cleaner square ring on outer playable lane */
  const ring: [number, number][] = [];
  for (let c = 1; c <= 13; c++) ring.push([c, 13]); // bottom L→R : 13
  for (let r = 12; r >= 1; r--) ring.push([13, r]); // right B→T : 12
  for (let c = 12; c >= 1; c--) ring.push([c, 1]); // top R→L : 12
  for (let r = 2; r <= 12; r++) ring.push([1, r]); // left T→B : 11
  // 13+12+12+11 = 48 — pad 4 corners inward
  while (ring.length < 52) {
    ring.push([7, 7]);
  }
  return ring.slice(0, 52).map(([c, r]) => crToXy(c, r));
}

const TRACK_XY = buildTrack();

const HOME_PATH: Record<string, BoardXY[]> = {
  red: [0, 1, 2, 3, 4].map((i) => crToXy(7, 12 - i)),
  green: [0, 1, 2, 3, 4].map((i) => crToXy(12 - i, 7)),
  yellow: [0, 1, 2, 3, 4].map((i) => crToXy(7, 2 + i)),
  blue: [0, 1, 2, 3, 4].map((i) => crToXy(2 + i, 7)),
};

const HOME_CENTER = crToXy(7, 7);

const BASE: Record<string, BoardXY[]> = {
  red: [crToXy(2, 11), crToXy(3, 11), crToXy(2, 12), crToXy(3, 12)],
  green: [crToXy(11, 2), crToXy(12, 2), crToXy(11, 3), crToXy(12, 3)],
  yellow: [crToXy(11, 11), crToXy(12, 11), crToXy(11, 12), crToXy(12, 12)],
  blue: [crToXy(2, 2), crToXy(3, 2), crToXy(2, 3), crToXy(3, 3)],
};

export function posToXy(
  color: string,
  pos: number,
  tokenIndex: number,
): BoardXY {
  if (pos === -1) return BASE[color]?.[tokenIndex] ?? HOME_CENTER;
  if (pos === 105) return HOME_CENTER;
  if (pos >= 100 && pos <= 104) {
    return HOME_PATH[color]?.[pos - 100] ?? HOME_CENTER;
  }
  if (pos >= 0 && pos < TRACK_XY.length) return TRACK_XY[pos]!;
  return HOME_CENTER;
}

export const SAFE_VISUAL = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
