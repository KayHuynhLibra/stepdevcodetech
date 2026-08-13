/**
 * HueRush — rules engine (original SOFIA color-card house rules).
 * 112 lá/bộ · 2–10 người · chồng +2/+4 · phạt quên Rush.
 */

export const UNO_COLORS = ["red", "yellow", "green", "blue"] as const;
export type UnoColor = (typeof UNO_COLORS)[number];
export type UnoWildColor = UnoColor | "wild";

export const UNO_VALUES = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "skip", "reverse", "draw2", "wild", "wild4",
] as const;
export type UnoValue = (typeof UNO_VALUES)[number];

export type UnoCard = {
  id: string;
  color: UnoWildColor;
  value: UnoValue;
};

export const MAX_SEATS = 10;
export const MIN_PLAYERS = 2;
export const HAND_SIZE = 7;
export const UNO_PENALTY = 2;
export const DRAW2_COUNT = 2;
export const WILD4_COUNT = 4;
export const UNO_CATCH_MS = 4_000;

let cardSeq = 0;
function cid(color: UnoWildColor, value: UnoValue, deckIdx: number): string {
  cardSeq += 1;
  return `d${deckIdx}-${color}-${value}-${cardSeq}`;
}

export function resetCardSeq() {
  cardSeq = 0;
}

/** Deck count: 1 deck (112) for ≤4 players, 2 for 5–8, 3 for 9–10. */
export function deckCountForPlayers(playerCount: number): number {
  const n = Math.floor(playerCount);
  if (n <= 4) return 1;
  if (n <= 8) return 2;
  return 3;
}

/** Cards per single 2026 Deluxe deck. */
export const DECK_SIZE_2026 = 112;

export function createDeck(deckIndex = 0): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    deck.push({ id: cid(color, "0", deckIndex), color, value: "0" });
    for (const v of ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const) {
      deck.push({ id: cid(color, v, deckIndex), color, value: v });
      deck.push({ id: cid(color, v, deckIndex), color, value: v });
    }
    for (const v of ["skip", "reverse", "draw2"] as const) {
      deck.push({ id: cid(color, v, deckIndex), color, value: v });
      deck.push({ id: cid(color, v, deckIndex), color, value: v });
    }
  }
  // Standard 4 wild + 4 wild4, plus 2026 Deluxe: +2 wild + +2 wild4
  for (let i = 0; i < 6; i++) {
    deck.push({ id: cid("wild", "wild", deckIndex), color: "wild", value: "wild" });
  }
  for (let i = 0; i < 6; i++) {
    deck.push({ id: cid("wild", "wild4", deckIndex), color: "wild", value: "wild4" });
  }
  return deck;
}

export function createMultiDeck(playerCount: number): UnoCard[] {
  resetCardSeq();
  const count = deckCountForPlayers(playerCount);
  const decks: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    decks.push(...createDeck(i));
  }
  return decks;
}

export function shuffleDeck(deck: UnoCard[], rng = Math.random): UnoCard[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

export function isStackCard(value: UnoValue): boolean {
  return value === "draw2" || value === "wild4";
}

export function cardMatches(
  card: UnoCard,
  top: UnoCard,
  activeColor: UnoColor,
  pendingDraw = 0,
): boolean {
  if (pendingDraw > 0) return isStackCard(card.value);
  if (card.color === "wild") return true;
  if (card.color === activeColor) return true;
  if (top.color !== "wild" && card.color === top.color) return true;
  if (card.value === top.value) return true;
  return false;
}

export function playableCards(
  hand: UnoCard[],
  top: UnoCard,
  activeColor: UnoColor,
  pendingDraw = 0,
): UnoCard[] {
  return hand.filter((c) => cardMatches(c, top, activeColor, pendingDraw));
}

export function isActionCard(value: UnoValue): boolean {
  return (
    value === "skip" ||
    value === "reverse" ||
    value === "draw2" ||
    value === "wild" ||
    value === "wild4"
  );
}

export type DealResult = {
  hands: UnoCard[][];
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  activeColor: UnoColor;
  direction: 1 | -1;
  deckCount: number;
};

export function dealGame(
  playerCount: number,
  deckIn?: UnoCard[],
  rng = Math.random,
): DealResult | { error: string } {
  const n = Math.floor(playerCount);
  if (n < MIN_PLAYERS || n > MAX_SEATS) {
    return { error: `Cần ${MIN_PLAYERS}–${MAX_SEATS} người chơi` };
  }
  let pile = shuffleDeck(deckIn ?? createMultiDeck(n), rng);
  const hands: UnoCard[][] = Array.from({ length: n }, () => []);
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let s = 0; s < n; s++) {
      const c = pile.pop();
      if (!c) return { error: "Hết bài khi chia" };
      hands[s]!.push(c);
    }
  }
  const discardPile: UnoCard[] = [];
  let top = pile.pop();
  if (!top) return { error: "Không rút được lá úp" };
  while (top.value === "wild4") {
    pile = shuffleDeck([...pile, top], rng);
    top = pile.pop();
    if (!top) return { error: "Không rút được lá úp" };
  }
  discardPile.push(top);
  const activeColor: UnoColor =
    top.color === "wild" ? UNO_COLORS[Math.floor(rng() * 4)]! : top.color;
  return {
    hands,
    drawPile: pile,
    discardPile,
    activeColor,
    direction: 1,
    deckCount: deckCountForPlayers(n),
  };
}

export type PlayResult = {
  hands: UnoCard[][];
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  activeColor: UnoColor;
  direction: 1 | -1;
  nextSeat: number;
  drawn: UnoCard[];
  pendingDraw: number;
  stackedDraw: boolean;
  skippedSeat: number | null;
  event: string;
  winnerSeat: number | null;
  playedToOne: boolean;
};

export function drawCards(
  pile: UnoCard[],
  count: number,
): { pile: UnoCard[]; drawn: UnoCard[] } {
  const drawn: UnoCard[] = [];
  let p = [...pile];
  for (let i = 0; i < count; i++) {
    if (!p.length) break;
    const c = p.pop();
    if (c) drawn.push(c);
  }
  return { pile: p, drawn };
}

export function reshuffleDiscard(
  drawPile: UnoCard[],
  discardPile: UnoCard[],
  rng = Math.random,
): { drawPile: UnoCard[]; discardPile: UnoCard[] } {
  if (drawPile.length > 0 || discardPile.length <= 1) {
    return { drawPile, discardPile };
  }
  const top = discardPile[discardPile.length - 1]!;
  const rest = discardPile.slice(0, -1);
  return { drawPile: shuffleDeck(rest, rng), discardPile: [top] };
}

export function ensureDrawPile(
  drawPile: UnoCard[],
  discardPile: UnoCard[],
  rng = Math.random,
): { drawPile: UnoCard[]; discardPile: UnoCard[] } {
  if (drawPile.length > 0) return { drawPile, discardPile };
  return reshuffleDiscard(drawPile, discardPile, rng);
}

export function nextSeat(
  current: number,
  direction: 1 | -1,
  playerCount: number,
): number {
  return (current + direction + playerCount) % playerCount;
}

export function applyPlay(
  state: {
    hands: UnoCard[][];
    drawPile: UnoCard[];
    discardPile: UnoCard[];
    activeColor: UnoColor;
    direction: 1 | -1;
    turnSeat: number;
    playerCount: number;
    pendingDraw: number;
  },
  cardId: string,
  chosenColor?: UnoColor,
): PlayResult | { error: string } {
  const seat = state.turnSeat;
  const hand = state.hands[seat];
  if (!hand) return { error: "Ghế không hợp lệ" };
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return { error: "Không có lá này trên tay" };

  const top = state.discardPile[state.discardPile.length - 1];
  if (!top) return { error: "Chưa có lá úp" };

  const card = hand[idx]!;
  if (state.pendingDraw > 0 && !isStackCard(card.value)) {
    return { error: "Phải chơi +2/+4 để chồng hoặc rút bài phạt" };
  }
  if (!cardMatches(card, top, state.activeColor, state.pendingDraw)) {
    return { error: "Lá không khớp màu/số" };
  }

  const hands = state.hands.map((h, i) =>
    i === seat ? h.filter((c) => c.id !== cardId) : [...h],
  );
  const discardPile = [...state.discardPile, card];
  let activeColor = state.activeColor;
  let direction = state.direction;
  let pendingDraw = 0;
  let stackedDraw = false;
  let skippedSeat: number | null = null;
  let event = `Ghế ${seat + 1} chơi ${card.color} ${card.value}`;

  if (card.color === "wild") {
    if (!chosenColor || !UNO_COLORS.includes(chosenColor)) {
      return { error: "Chọn màu cho lá Wild" };
    }
    activeColor = chosenColor;
    if (card.value === "wild4") {
      pendingDraw =
        state.pendingDraw > 0
          ? state.pendingDraw + WILD4_COUNT
          : WILD4_COUNT;
      stackedDraw = state.pendingDraw > 0;
      event = stackedDraw
        ? `Ghế ${seat + 1} chồng +4 → tổng +${pendingDraw}`
        : `Ghế ${seat + 1} +4 → ${chosenColor}`;
    } else {
      event = `Ghế ${seat + 1} Wild → ${chosenColor}`;
    }
  } else {
    activeColor = card.color;
    if (card.value === "skip") {
      skippedSeat = nextSeat(seat, direction, state.playerCount);
      event = `Ghế ${seat + 1} Skip`;
    } else if (card.value === "reverse") {
      if (state.playerCount === 2) {
        skippedSeat = nextSeat(seat, direction, state.playerCount);
        event = `Ghế ${seat + 1} Reverse (2 người = Skip)`;
      } else {
        direction = (direction === 1 ? -1 : 1) as 1 | -1;
        event = `Ghế ${seat + 1} Reverse`;
      }
    } else if (card.value === "draw2") {
      pendingDraw =
        state.pendingDraw > 0
          ? state.pendingDraw + DRAW2_COUNT
          : DRAW2_COUNT;
      stackedDraw = state.pendingDraw > 0;
      event = stackedDraw
        ? `Ghế ${seat + 1} chồng +2 → tổng +${pendingDraw}`
        : `Ghế ${seat + 1} +2`;
    }
  }

  const remaining = hands[seat]!.length;
  const winnerSeat = remaining === 0 ? seat : null;
  let next = seat;
  if (winnerSeat == null) {
    next = nextSeat(seat, direction, state.playerCount);
    if (skippedSeat != null) {
      next = nextSeat(skippedSeat, direction, state.playerCount);
    }
    if (pendingDraw > 0) {
      next = skippedSeat ?? nextSeat(seat, direction, state.playerCount);
    }
  }

  return {
    hands,
    drawPile: state.drawPile,
    discardPile,
    activeColor,
    direction,
    nextSeat: winnerSeat != null ? seat : next,
    drawn: [],
    pendingDraw,
    stackedDraw,
    skippedSeat,
    event,
    winnerSeat,
    playedToOne: remaining === 1,
  };
}

export function applyDraw(
  state: {
    hands: UnoCard[][];
    drawPile: UnoCard[];
    discardPile: UnoCard[];
    activeColor: UnoColor;
    turnSeat: number;
    playerCount: number;
    direction: 1 | -1;
    pendingDraw: number;
  },
  count = 1,
): PlayResult | { error: string } {
  const seat = state.turnSeat;
  const hand = state.hands[seat];
  if (!hand) return { error: "Ghế không hợp lệ" };

  const toDraw = state.pendingDraw > 0 ? state.pendingDraw : count;
  let drawPile = state.drawPile;
  let discardPile = state.discardPile;
  const ensured = ensureDrawPile(drawPile, discardPile);
  drawPile = ensured.drawPile;
  discardPile = ensured.discardPile;

  const { pile, drawn } = drawCards(drawPile, toDraw);
  drawPile = pile;
  const hands = state.hands.map((h, i) =>
    i === seat ? [...h, ...drawn] : [...h],
  );

  const next = nextSeat(seat, state.direction, state.playerCount);
  return {
    hands,
    drawPile,
    discardPile,
    activeColor: state.activeColor,
    direction: state.direction,
    nextSeat: next,
    drawn,
    pendingDraw: 0,
    stackedDraw: false,
    skippedSeat: null,
    event:
      state.pendingDraw > 0
        ? `Ghế ${seat + 1} rút ${drawn.length} (phạt +${state.pendingDraw})`
        : `Ghế ${seat + 1} rút ${drawn.length}`,
    winnerSeat: null,
    playedToOne: false,
  };
}

/** Phạt quên Rush — rút thêm UNO_PENALTY lá. */
export function applyUnoForgotPenalty(
  state: {
    hands: UnoCard[][];
    drawPile: UnoCard[];
    discardPile: UnoCard[];
  },
  seat: number,
): { hands: UnoCard[][]; drawPile: UnoCard[]; discardPile: UnoCard[]; drawn: number } {
  let drawPile = state.drawPile;
  let discardPile = state.discardPile;
  const ensured = ensureDrawPile(drawPile, discardPile);
  drawPile = ensured.drawPile;
  discardPile = ensured.discardPile;
  const { pile, drawn } = drawCards(drawPile, UNO_PENALTY);
  const hands = state.hands.map((h, i) =>
    i === seat ? [...h, ...drawn] : [...h],
  );
  return { hands, drawPile: pile, discardPile, drawn: drawn.length };
}

export function pickBotCard(
  hand: UnoCard[],
  top: UnoCard,
  activeColor: UnoColor,
  pendingDraw = 0,
): { card: UnoCard; chosenColor?: UnoColor } | null {
  const playable = playableCards(hand, top, activeColor, pendingDraw);
  if (!playable.length) return null;

  if (pendingDraw > 0) {
    const wild4 = playable.find((c) => c.value === "wild4");
    const draw2 = playable.find((c) => c.value === "draw2");
    const stack = wild4 ?? draw2 ?? playable[0]!;
    if (stack.color === "wild") {
      return { card: stack, chosenColor: pickBestColor(hand) };
    }
    return { card: stack };
  }

  const action = playable.filter((c) => isActionCard(c.value));
  const pool = action.length ? action : playable;
  const card = pool[Math.floor(Math.random() * pool.length)]!;
  if (card.color === "wild") {
    return { card, chosenColor: pickBestColor(hand) };
  }
  return { card };
}

function pickBestColor(hand: UnoCard[]): UnoColor {
  const counts: Record<UnoColor, number> = {
    red: 0,
    yellow: 0,
    green: 0,
    blue: 0,
  };
  for (const c of hand) {
    if (c.color !== "wild") counts[c.color] += 1;
  }
  let best: UnoColor = "red";
  let max = -1;
  for (const col of UNO_COLORS) {
    if (counts[col] > max) {
      max = counts[col];
      best = col;
    }
  }
  return best;
}

export function scoreHand(hand: UnoCard[]): number {
  let s = 0;
  for (const c of hand) {
    if (c.value === "wild" || c.value === "wild4") s += 50;
    else if (c.value === "skip" || c.value === "reverse" || c.value === "draw2")
      s += 20;
    else s += parseInt(c.value, 10) || 0;
  }
  return s;
}
