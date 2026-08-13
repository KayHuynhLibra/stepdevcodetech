/**
 * Node test runner: npx tsx --test src/oanQuanEngine.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyRedistribute,
  applySow,
  bothQuanCaptured,
  createInitialPits,
  emptyPit,
  finalizeScores,
  pickBotPit,
  validPitIndexes,
  winnerSeatFromScores,
  type OanPit,
} from "./oanQuanEngine.js";

function pitsFrom(spec: Partial<Record<number, Partial<OanPit>>>): OanPit[] {
  const pits = Array.from({ length: 12 }, () => emptyPit());
  for (const [k, v] of Object.entries(spec)) {
    if (!v) continue;
    const i = Number(k);
    pits[i] = { dan: v.dan ?? 0, quan: v.quan ?? 0 };
  }
  return pits;
}

describe("setup", () => {
  it("initial board has 10×5 dân and 2 quan", () => {
    const pits = createInitialPits();
    assert.equal(pits[0]!.quan, 1);
    assert.equal(pits[6]!.quan, 1);
    for (const i of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) {
      assert.equal(pits[i]!.dan, 5);
    }
    assert.deepEqual(validPitIndexes(pits, 0), [1, 2, 3, 4, 5]);
  });
});

describe("sow + capture", () => {
  it("places CCW and simple capture", () => {
    // Seat 0 sow pit 5 with 1 stone → lands in quan 6 (not empty trigger if quan there)
    // Better: pit 4 has 1, pit 5 empty, pit 6 has 3 dân → sow 4 → land 5 empty → eat 6
    const pits = pitsFrom({
      4: { dan: 1 },
      5: { dan: 0 },
      6: { dan: 3, quan: 0 },
    });
    const r = applySow(pits, [0, 0], 0, 4);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.lastPit, 5);
    assert.equal(r.pits[4]!.dan, 0);
    assert.equal(r.pits[5]!.dan, 1);
    assert.equal(r.pits[6]!.dan, 0);
    assert.equal(r.scores[0], 3);
    assert.equal(r.captured, 3);
  });

  it("chain capture empty-full pattern", () => {
    // land on 5 (empty), eat 6 (has), 7 empty, eat 8 (has)
    const pits = pitsFrom({
      4: { dan: 1 },
      5: { dan: 0 },
      6: { dan: 2 },
      7: { dan: 0 },
      8: { dan: 4 },
    });
    const r = applySow(pits, [0, 0], 0, 4);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.pits[6]!.dan, 0);
    assert.equal(r.pits[8]!.dan, 0);
    assert.equal(r.scores[0], 6);
  });

  it("captures quan worth 10", () => {
    const pits = pitsFrom({
      5: { dan: 1 },
      6: { dan: 0 },
      0: { dan: 0 }, // unused
      7: { dan: 0, quan: 1 }, // wait: land 6 empty → eat 7
    });
    // sow 5 (1) → place on 6; if 6 empty → eat 7 quan
    pits[6] = { dan: 0, quan: 0 };
    pits[7] = { dan: 0, quan: 1 };
    const r = applySow(pits, [0, 0], 0, 5);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.scores[0], 10);
    assert.equal(r.pits[7]!.quan, 0);
    assert.ok(r.steps.some((s) => s.kind === "capture" && s.quan === 1));
  });

  it("no capture when next after land is empty", () => {
    const pits = pitsFrom({
      3: { dan: 1 },
      4: { dan: 0 },
      5: { dan: 0 },
    });
    const r = applySow(pits, [0, 0], 0, 3);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.captured, 0);
    assert.equal(r.pits[4]!.dan, 1);
  });

  it("rejects opponent pit", () => {
    const pits = createInitialPits();
    const r = applySow(pits, [0, 0], 0, 7);
    assert.ok("error" in r);
  });
});

describe("redistribute + finalize", () => {
  it("lends from score into empty side", () => {
    const pits = pitsFrom({
      0: { quan: 1 },
      6: { quan: 1 },
      7: { dan: 3 },
    });
    const r = applyRedistribute(pits, [0, 8], 0);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.lent, 5);
    assert.equal(r.scores[1], 3);
    for (const i of [1, 2, 3, 4, 5]) {
      assert.equal(r.pits[i]!.dan, 1);
    }
  });

  it("insufficient score ends redistribute", () => {
    const pits = pitsFrom({ 0: { quan: 1 }, 6: { quan: 1 } });
    const r = applyRedistribute(pits, [0, 2], 0);
    assert.ok("error" in r);
  });

  it("finalize sweeps side dân", () => {
    const pits = pitsFrom({
      1: { dan: 2 },
      7: { dan: 3 },
      0: { quan: 1 },
    });
    const f = finalizeScores(pits, [5, 1]);
    assert.equal(f.scores[0], 7);
    assert.equal(f.scores[1], 4);
    assert.ok(bothQuanCaptured(f.pits) === false);
  });

  it("winner from scores", () => {
    assert.equal(winnerSeatFromScores([20, 10]), 0);
    assert.equal(winnerSeatFromScores([10, 20]), 1);
    assert.equal(winnerSeatFromScores([15, 15]), null);
  });
});

describe("bot", () => {
  it("picks a valid pit", () => {
    const pits = createInitialPits();
    const pick = pickBotPit(pits, 0);
    assert.ok(pick != null);
    assert.ok([1, 2, 3, 4, 5].includes(pick!));
  });
});
