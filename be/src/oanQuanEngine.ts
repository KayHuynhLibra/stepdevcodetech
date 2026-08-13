/**
 * Ô Ăn Quan — pure rules engine (classic folk variant).
 *
 * Board ring (CCW = increasing index):
 *   0     quan trái
 *   1..5  dân player 0 (bottom)
 *   6     quan phải
 *   7..11 dân player 1 (top, right→left along the circle)
 */

export const PIT_COUNT = 12;
export const QUAN_VALUE = 10;
export const DAN_PER_PIT = 5;

export type OanPit = {
  dan: number;
  quan: number;
};

export type OanSeat = 0 | 1;

export type SowStep = {
  from: number;
  to: number;
  kind: "place" | "capture";
  dan: number;
  quan: number;
};

export type SowResult = {
  pits: OanPit[];
  scores: [number, number];
  captured: number;
  steps: SowStep[];
  lastPit: number;
  bothQuanGone: boolean;
};

export function emptyPit(): OanPit {
  return { dan: 0, quan: 0 };
}

export function clonePits(pits: OanPit[]): OanPit[] {
  return pits.map((p) => ({ dan: p.dan, quan: p.quan }));
}

export function pitStones(p: OanPit): number {
  return p.dan + p.quan;
}

export function pitScore(p: OanPit): number {
  return p.dan + p.quan * QUAN_VALUE;
}

export function isQuanPit(index: number): boolean {
  return index === 0 || index === 6;
}

export function seatDanPits(seat: OanSeat): number[] {
  return seat === 0 ? [1, 2, 3, 4, 5] : [7, 8, 9, 10, 11];
}

export function createInitialPits(): OanPit[] {
  const pits: OanPit[] = Array.from({ length: PIT_COUNT }, () => emptyPit());
  for (const i of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) {
    pits[i] = { dan: DAN_PER_PIT, quan: 0 };
  }
  pits[0] = { dan: 0, quan: 1 };
  pits[6] = { dan: 0, quan: 1 };
  return pits;
}

export function quanRemaining(pits: OanPit[]): number {
  return (pits[0]?.quan ?? 0) + (pits[6]?.quan ?? 0);
}

export function bothQuanCaptured(pits: OanPit[]): boolean {
  return quanRemaining(pits) === 0;
}

export function validPitIndexes(pits: OanPit[], seat: OanSeat): number[] {
  return seatDanPits(seat).filter((i) => (pits[i]?.dan ?? 0) > 0);
}

export function sideEmpty(pits: OanPit[], seat: OanSeat): boolean {
  return validPitIndexes(pits, seat).length === 0;
}

/** Next pit clockwise-on-ring = CCW sowing direction (index + 1). */
export function nextPit(index: number): number {
  return (index + 1) % PIT_COUNT;
}

/**
 * Sow from a dân pit belonging to `seat`.
 * Places one dân per pit CCW; no relay.
 * Capture: last stone into a previously-empty pit → eat next if non-empty;
 * chain while after-eaten is empty and following has stones.
 */
export function applySow(
  pitsIn: OanPit[],
  scoresIn: [number, number],
  seat: OanSeat,
  pitIndex: number,
): SowResult | { error: string } {
  const owned = seatDanPits(seat);
  if (!owned.includes(pitIndex)) {
    return { error: "Chỉ được chọn ô dân phía mình" };
  }
  const pits = clonePits(pitsIn);
  const scores: [number, number] = [scoresIn[0], scoresIn[1]];
  const start = pits[pitIndex]!;
  if (start.dan <= 0) {
    return { error: "Ô trống — không rải được" };
  }

  const hand = start.dan;
  start.dan = 0;
  start.quan = 0;

  const steps: SowStep[] = [];
  let cursor = pitIndex;
  for (let i = 0; i < hand; i++) {
    const from = cursor;
    cursor = nextPit(cursor);
    pits[cursor]!.dan += 1;
    steps.push({
      from,
      to: cursor,
      kind: "place",
      dan: 1,
      quan: 0,
    });
  }

  const lastPit = cursor;
  let captured = 0;

  // Was empty before receiving last stone ⇒ now exactly 1 dan and 0 quan
  // (quan pit that already had quan is never "empty" for capture trigger)
  const last = pits[lastPit]!;
  const landedInEmpty = last.dan === 1 && last.quan === 0;

  if (landedInEmpty) {
    let eatAt = nextPit(lastPit);
    while (true) {
      const target = pits[eatAt]!;
      if (pitStones(target) <= 0) break;

      const takeDan = target.dan;
      const takeQuan = target.quan;
      const pts = pitScore(target);
      target.dan = 0;
      target.quan = 0;
      scores[seat] += pts;
      captured += pts;
      steps.push({
        from: lastPit,
        to: eatAt,
        kind: "capture",
        dan: takeDan,
        quan: takeQuan,
      });

      const after = nextPit(eatAt);
      if (pitStones(pits[after]!) > 0) break; // not empty → no chain
      const nextEat = nextPit(after);
      if (pitStones(pits[nextEat]!) <= 0) break;
      eatAt = nextEat;
    }
  }

  return {
    pits,
    scores,
    captured,
    steps,
    lastPit,
    bothQuanGone: bothQuanCaptured(pits),
  };
}

/**
 * When `emptySeat` has no dân left but quan remain on board,
 * opponent (`fromSeat`) lends 1 dân per empty pit from their score.
 * Returns null if cannot lend enough → caller should end game.
 */
export function applyRedistribute(
  pitsIn: OanPit[],
  scoresIn: [number, number],
  emptySeat: OanSeat,
):
  | { pits: OanPit[]; scores: [number, number]; lent: number }
  | { error: "insufficient"; pits: OanPit[]; scores: [number, number] } {
  const pits = clonePits(pitsIn);
  const scores: [number, number] = [scoresIn[0], scoresIn[1]];
  const fromSeat: OanSeat = emptySeat === 0 ? 1 : 0;
  const need = seatDanPits(emptySeat).filter((i) => (pits[i]?.dan ?? 0) === 0);
  const cost = need.length;
  if (cost === 0) {
    return { pits, scores, lent: 0 };
  }
  if (scores[fromSeat] < cost) {
    return { error: "insufficient", pits, scores };
  }
  scores[fromSeat] -= cost;
  for (const i of need) {
    pits[i]!.dan = 1;
  }
  return { pits, scores, lent: cost };
}

/** Sweep each side's dân pits into their score (end of game). */
export function finalizeScores(
  pitsIn: OanPit[],
  scoresIn: [number, number],
): { pits: OanPit[]; scores: [number, number] } {
  const pits = clonePits(pitsIn);
  const scores: [number, number] = [scoresIn[0], scoresIn[1]];
  for (const seat of [0, 1] as OanSeat[]) {
    for (const i of seatDanPits(seat)) {
      const p = pits[i]!;
      scores[seat] += p.dan + p.quan * QUAN_VALUE;
      p.dan = 0;
      p.quan = 0;
    }
  }
  // Leftover quan pits unclaimed per plan
  return { pits, scores };
}

export function winnerSeatFromScores(
  scores: [number, number],
): 0 | 1 | null {
  if (scores[0] > scores[1]) return 0;
  if (scores[1] > scores[0]) return 1;
  return null;
}

/** Bot: pick pit maximizing immediate capture points; else most dân. */
export function pickBotPit(pits: OanPit[], seat: OanSeat): number | null {
  const valid = validPitIndexes(pits, seat);
  if (!valid.length) return null;
  let best = valid[0]!;
  let bestScore = -1;
  let bestDan = -1;
  for (const i of valid) {
    const sim = applySow(pits, [0, 0], seat, i);
    if ("error" in sim) continue;
    const dan = pits[i]!.dan;
    if (
      sim.captured > bestScore ||
      (sim.captured === bestScore && dan > bestDan)
    ) {
      bestScore = sim.captured;
      bestDan = dan;
      best = i;
    }
  }
  return best;
}
