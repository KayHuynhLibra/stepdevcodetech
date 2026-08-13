/**
 * Node test runner: npx tsx --test src/ludoEngine.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMove,
  computeDest,
  createTokens,
  tokenId,
  validTokenIds,
} from "./ludoEngine.js";

describe("computeDest", () => {
  it("base needs 6 to exit", () => {
    assert.equal(computeDest("red", -1, 5), null);
    assert.equal(computeDest("red", -1, 6), 0);
    assert.equal(computeDest("green", -1, 6), 13);
  });

  it("red 48 + 4 → home path 101 (spec)", () => {
    assert.equal(computeDest("red", 48, 4), 101);
  });

  it("red at turn 50 + 1 → 100", () => {
    assert.equal(computeDest("red", 50, 1), 100);
  });

  it("home path exact to 105", () => {
    assert.equal(computeDest("red", 100, 5), 105);
    assert.equal(computeDest("red", 103, 2), 105);
  });

  it("home path overshoot illegal", () => {
    assert.equal(computeDest("red", 104, 2), null);
    assert.equal(computeDest("red", 100, 6), null);
  });

  it("track wraps modulo", () => {
    assert.equal(computeDest("yellow", 50, 3), 1);
  });
});

describe("valid + capture", () => {
  it("filters legal tokens", () => {
    const tokens = createTokens();
    const red0 = tokens.find((t) => t.id === tokenId("red", 0))!;
    red0.pos = 48;
    const ids = validTokenIds(tokens, "red", 4);
    assert.ok(ids.includes(tokenId("red", 0)));
  });

  it("captures on non-safe", () => {
    const tokens = createTokens();
    const red0 = tokens.find((t) => t.id === tokenId("red", 0))!;
    const green0 = tokens.find((t) => t.id === tokenId("green", 0))!;
    red0.pos = 5;
    green0.pos = 7;
    const r = applyMove(tokens, tokenId("red", 0), 2);
    assert.ok(r);
    assert.equal(r!.dest, 7);
    assert.equal(r!.captured, true);
    assert.equal(
      r!.tokens.find((t) => t.id === tokenId("green", 0))!.pos,
      -1,
    );
  });

  it("no capture on safe zone", () => {
    const tokens = createTokens();
    const red0 = tokens.find((t) => t.id === tokenId("red", 0))!;
    const green0 = tokens.find((t) => t.id === tokenId("green", 0))!;
    red0.pos = 6;
    green0.pos = 8;
    const r = applyMove(tokens, tokenId("red", 0), 2);
    assert.ok(r);
    assert.equal(r!.captured, false);
    assert.equal(
      r!.tokens.find((t) => t.id === tokenId("green", 0))!.pos,
      8,
    );
  });
});
