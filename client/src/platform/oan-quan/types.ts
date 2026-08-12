export type OanPit = {
  dan: number;
  quan: number;
};

export type SowStep = {
  from: number;
  to: number;
  kind: "place" | "capture";
  dan: number;
  quan: number;
};

export type OanPlayer = {
  seat: 0 | 1;
  userId: string | null;
  guestId: string | null;
  displayName: string;
  isBot: boolean;
  strikes: number;
  connected: boolean;
  avatar?: string | null;
};

export type OanRoom = {
  roomId: string;
  status: "lobby" | "playing" | "finished";
  seats: OanPlayer[];
  pits: OanPit[];
  scores: [number, number];
  turnSeat: 0 | 1;
  validPitIndexes: number[];
  lastEvent: string | null;
  lastSteps: SowStep[];
  moveSeq: number;
  stake: number;
  pot: number;
  settled: boolean;
  winnerSeat: number | null;
  turnDeadline: number;
  vsBot: boolean;
  hostUserId?: string | null;
  hostGuestId?: string | null;
};
