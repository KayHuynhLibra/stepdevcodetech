import { describe, expect, it } from "vitest";
import {
  cardMatches,
  createDeck,
  createMultiDeck,
  dealGame,
  applyPlay,
  playableCards,
  scoreHand,
  deckCountForPlayers,
  applyUnoForgotPenalty,
} from "./unoEngine.js";

describe("unoEngine", () => {
  it("creates 112-card 2026 Deluxe deck", () => {
    expect(createDeck()).toHaveLength(112);
  });

  it("scales deck count for 5+ players", () => {
    expect(deckCountForPlayers(4)).toBe(1);
    expect(deckCountForPlayers(5)).toBe(2);
    expect(deckCountForPlayers(10)).toBe(3);
    expect(createMultiDeck(6)).toHaveLength(224);
  });

  it("deals 7 cards per player", () => {
    const deal = dealGame(4, undefined, () => 0.5);
    expect("error" in deal).toBe(false);
    if ("error" in deal) return;
    expect(deal.hands).toHaveLength(4);
    for (const h of deal.hands) {
      expect(h).toHaveLength(7);
    }
    expect(deal.discardPile).toHaveLength(1);
    expect(deal.discardPile[0]?.value).not.toBe("wild4");
  });

  it("matches color and value", () => {
    const top = { id: "1", color: "red" as const, value: "5" as const };
    const sameColor = { id: "2", color: "red" as const, value: "8" as const };
    const sameValue = {
      id: "3",
      color: "blue" as const,
      value: "5" as const,
    };
    const wild = { id: "4", color: "wild" as const, value: "wild" as const };
    expect(cardMatches(sameColor, top, "red")).toBe(true);
    expect(cardMatches(sameValue, top, "blue")).toBe(true);
    expect(cardMatches(wild, top, "red")).toBe(true);
  });

  it("stacks +2 when pending draw", () => {
    const top = { id: "t", color: "red" as const, value: "draw2" as const };
    const hand = [
      { id: "d", color: "blue" as const, value: "draw2" as const },
    ];
    const playable = playableCards(hand, top, "red", 2);
    expect(playable).toHaveLength(1);
    const deal = dealGame(2, undefined, () => 0.3);
    if ("error" in deal) throw new Error(deal.error);
    deal.hands[0] = hand;
    deal.discardPile = [top];
    const result = applyPlay(
      {
        hands: deal.hands,
        drawPile: deal.drawPile,
        discardPile: deal.discardPile,
        activeColor: "red",
        direction: 1,
        turnSeat: 0,
        playerCount: 2,
        pendingDraw: 2,
      },
      "d",
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.pendingDraw).toBe(4);
    expect(result.stackedDraw).toBe(true);
  });

  it("applies UNO forgot penalty", () => {
    const hands = [[{ id: "a", color: "red" as const, value: "5" as const }], []];
    const pen = applyUnoForgotPenalty(
      { hands, drawPile: createDeck().slice(0, 10), discardPile: [] },
      0,
    );
    expect(pen.drawn).toBe(2);
    expect(pen.hands[0]!.length).toBe(3);
  });

  it("scores hand correctly", () => {
    const hand = [
      { id: "a", color: "red" as const, value: "5" as const },
      { id: "b", color: "wild" as const, value: "wild4" as const },
      { id: "c", color: "blue" as const, value: "skip" as const },
    ];
    expect(scoreHand(hand)).toBe(5 + 50 + 20);
  });
});
