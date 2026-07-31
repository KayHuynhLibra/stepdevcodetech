export interface ShoutDef {
  id: string;
  text: string;
}

export type ChatMode = "no" | "vip" | "saint";

/** Chat thường / VIP bay / Saint toàn màn */
export const CHAT_COST = 10;
export const VIP_CHAT_COST = 50;
export const SAINT_CHAT_COST = 10_000;
export const CHAT_MAX_LEN = 72;
export const CHAT_COOLDOWN_MS = 1_500;
export const CHAT_HISTORY_LIMIT = 24;
/** Saint hiện toàn màn (ms) */
export const SAINT_DISPLAY_MS = 4_500;
/** Cooldown riêng giữa 2 tin Saint (ms) */
export const SAINT_COOLDOWN_MS = 45_000;

/** Slang nhanh — text cố định. */
export const SHOUTS: ShoutDef[] = [
  { id: "gg", text: "GG" },
  { id: "clap", text: "Vỗ tay" },
  { id: "fire", text: "Quá đỉnh" },
  { id: "cry", text: "Khóc rồi" },
  { id: "rich", text: "Đập hộp" },
  { id: "salt", text: "Muối" },
];

const byId = new Map(SHOUTS.map((s) => [s.id, s]));

export function getShout(id: string): ShoutDef | undefined {
  return byId.get(id);
}

export function isChatMode(v: unknown): v is ChatMode {
  return v === "no" || v === "vip" || v === "saint";
}

export function chatCost(mode: ChatMode): number {
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
  /** Cấp chơi (1–99) — hiện cạnh tên chat */
  playLevel?: number;
  roundsPlayed?: number;
  /** Cảnh giới tu tiên */
  cultivationRank?: string;
  isVip?: boolean;
}

/** Làm sạch text chat tự do. */
export function sanitizeChatText(raw: string): string | null {
  const t = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_MAX_LEN);
  if (!t) return null;
  return t;
}

const BLOCKED_WORDS = [
  "địt",
  "dit",
  "đụ",
  "lồn",
  "lon",
  "cặc",
  "cac",
  "đéo",
  "fuck",
  "shit",
  "bitch",
];

/** Bộ lọc từ thô cơ bản (server). */
export function containsBlockedWords(text: string): boolean {
  const lower = String(text ?? "").toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}
