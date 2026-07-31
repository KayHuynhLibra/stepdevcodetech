export interface ShoutDef {
  id: string;
  text: string;
}

export type ChatMode = "no" | "vip" | "saint";

/** Đồng bộ server/src/shouts.ts */
export const CHAT_COST = 10;
export const VIP_CHAT_COST = 50;
export const SAINT_CHAT_COST = 10_000;
export const CHAT_MAX_LEN = 72;
export const SAINT_DISPLAY_MS = 4_500;
export const SAINT_COOLDOWN_MS = 45_000;

export const SHOUTS: ShoutDef[] = [
  { id: "gg", text: "GG" },
  { id: "clap", text: "Vỗ tay" },
  { id: "fire", text: "Quá đỉnh" },
  { id: "cry", text: "Khóc rồi" },
  { id: "rich", text: "Đập hộp" },
  { id: "salt", text: "Muối" },
];

export function chatCost(
  mode: ChatMode,
  costs?: { no: number; vip: number; saint: number },
): number {
  if (costs) {
    if (mode === "saint") return costs.saint;
    if (mode === "vip") return costs.vip;
    return costs.no;
  }
  if (mode === "saint") return SAINT_CHAT_COST;
  if (mode === "vip") return VIP_CHAT_COST;
  return CHAT_COST;
}

export interface ShoutReplyRef {
  name: string;
  text: string;
}

export interface ShoutEvent {
  name: string;
  avatar: string;
  text: string;
  cost: number;
  at: number;
  mode?: ChatMode;
  /** Bay marquee — mode vip */
  fly?: boolean;
  /** Toàn màn hình vài giây — mode saint */
  saint?: boolean;
  userId?: string;
  replyTo?: ShoutReplyRef;
  mentions?: string[];
  playLevel?: number;
  roundsPlayed?: number;
  cultivationRank?: string;
  isVip?: boolean;
}
