export type UnoColor = "red" | "yellow" | "green" | "blue" | "wild";

export type UnoValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export type UnoCard = {
  id: string;
  color: UnoColor;
  value: UnoValue;
};

export type UnoPlayer = {
  seat: number;
  userId: string | null;
  guestId: string | null;
  displayName: string;
  isBot: boolean;
  strikes: number;
  connected: boolean;
  avatar?: string | null;
  saidUno: boolean;
};

export type UnoRoom = {
  roomId: string;
  status: "lobby" | "playing" | "finished";
  phase: "lobby" | "play" | "choose_color" | "finished";
  seats: UnoPlayer[];
  playerCount: number;
  topCard: UnoCard | null;
  activeColor: UnoColor;
  direction: 1 | -1;
  turnSeat: number;
  handCounts: number[];
  myHand: UnoCard[];
  playableCardIds: string[];
  drawPileCount: number;
  pendingDraw: number;
  lastEvent: string | null;
  lastDrawn: UnoCard[];
  moveSeq: number;
  stake: number;
  pot: number;
  settled: boolean;
  winnerSeat: number | null;
  turnDeadline: number;
  fillBots: boolean;
  needsColorChoice: boolean;
  deckCount: number;
  unoRiskSeat: number | null;
  unoRiskUntil: number;
  cardBackClass: string;
  feltClass: string;
  catchableSeat: number | null;
};

export const COLOR_LABEL: Record<Exclude<UnoColor, "wild">, string> = {
  red: "Đỏ",
  yellow: "Vàng",
  green: "Lá",
  blue: "Lam",
};

export const VALUE_LABEL: Partial<Record<UnoValue, string>> = {
  skip: "Bỏ lượt",
  reverse: "Đảo",
  draw2: "+2",
  wild: "Wild",
  wild4: "+4",
};
