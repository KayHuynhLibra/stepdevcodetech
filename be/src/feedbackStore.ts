/**
 * Feedback / Liên hệ hai chiều (user ↔ mainadmin).
 * Persist: be/data/feedback.json
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

export const FEEDBACK_KINDS = ["report", "suggest", "contact"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["open", "replied", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackMessage {
  id: string;
  at: number;
  by: "user" | "staff";
  byUserId: string;
  byName: string;
  body: string;
}

export interface FeedbackTicket {
  id: string;
  at: number;
  updatedAt: number;
  kind: FeedbackKind;
  status: FeedbackStatus;
  userId: string;
  userName: string;
  userCode?: string;
  subject: string;
  messages: FeedbackMessage[];
}

interface FeedbackFile {
  version: 1;
  tickets: FeedbackTicket[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "feedback.json");
const TMP = join(DATA_DIR, "feedback.json.tmp");

const CAP = 200;
const MSG_CAP = 20;
const SUBJECT_MAX = 80;
const BODY_MAX = 2000;

function cleanText(raw: unknown, max: number): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function isFeedbackKind(v: unknown): v is FeedbackKind {
  return (
    typeof v === "string" &&
    (FEEDBACK_KINDS as readonly string[]).includes(v)
  );
}

export function isFeedbackStatus(v: unknown): v is FeedbackStatus {
  return (
    typeof v === "string" &&
    (FEEDBACK_STATUSES as readonly string[]).includes(v)
  );
}

function publicTicket(t: FeedbackTicket): FeedbackTicket {
  return {
    ...t,
    messages: t.messages.map((m) => ({ ...m })),
  };
}

export class FeedbackStore {
  private tickets: FeedbackTicket[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as FeedbackFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.tickets)) return;
      this.tickets = parsed.tickets.slice(0, CAP).map((t) => ({
        ...t,
        messages: Array.isArray(t.messages) ? t.messages.slice(0, MSG_CAP) : [],
      }));
      console.log(`[feedback] Loaded ${this.tickets.length} tickets`);
    } catch (err) {
      console.warn("[feedback] Failed to load:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: FeedbackFile = { version: 1, tickets: this.tickets };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[feedback] Failed to save:", err);
    }
  }

  openCount(): number {
    return this.tickets.filter((t) => t.status === "open").length;
  }

  listAll(opts?: {
    status?: FeedbackStatus | "all";
    kind?: FeedbackKind | "all";
    limit?: number;
  }): FeedbackTicket[] {
    const lim = Math.max(1, Math.min(CAP, opts?.limit ?? 100));
    let rows = this.tickets;
    if (opts?.status && opts.status !== "all") {
      rows = rows.filter((t) => t.status === opts.status);
    }
    if (opts?.kind && opts.kind !== "all") {
      rows = rows.filter((t) => t.kind === opts.kind);
    }
    return rows.slice(0, lim).map(publicTicket);
  }

  listForUser(userId: string, limit = 50): FeedbackTicket[] {
    const lim = Math.max(1, Math.min(CAP, limit));
    return this.tickets
      .filter((t) => t.userId === userId)
      .slice(0, lim)
      .map(publicTicket);
  }

  getById(id: string): FeedbackTicket | undefined {
    const t = this.tickets.find((x) => x.id === id);
    return t ? publicTicket(t) : undefined;
  }

  create(opts: {
    kind: unknown;
    subject: unknown;
    body: unknown;
    userId: string;
    userName: string;
    userCode?: string;
  }): { ok: true; ticket: FeedbackTicket } | { ok: false; reason: string } {
    if (!isFeedbackKind(opts.kind)) {
      return { ok: false, reason: "Loại góp ý không hợp lệ" };
    }
    const subject = cleanText(opts.subject, SUBJECT_MAX);
    const body = cleanText(opts.body, BODY_MAX);
    if (!subject) return { ok: false, reason: "Thiếu tiêu đề" };
    if (!body) return { ok: false, reason: "Thiếu nội dung" };
    const now = Date.now();
    const msg: FeedbackMessage = {
      id: randomBytes(5).toString("hex"),
      at: now,
      by: "user",
      byUserId: opts.userId,
      byName: cleanText(opts.userName, 48) || "user",
      body,
    };
    const ticket: FeedbackTicket = {
      id: randomBytes(6).toString("hex"),
      at: now,
      updatedAt: now,
      kind: opts.kind,
      status: "open",
      userId: opts.userId,
      userName: cleanText(opts.userName, 48) || "user",
      userCode: opts.userCode ? cleanText(opts.userCode, 24) : undefined,
      subject,
      messages: [msg],
    };
    this.tickets.unshift(ticket);
    if (this.tickets.length > CAP) this.tickets.length = CAP;
    this.save();
    return { ok: true, ticket: publicTicket(ticket) };
  }

  addMessage(opts: {
    id: string;
    body: unknown;
    by: "user" | "staff";
    byUserId: string;
    byName: string;
  }):
    | { ok: true; ticket: FeedbackTicket }
    | { ok: false; reason: string } {
    const i = this.tickets.findIndex((t) => t.id === opts.id);
    if (i < 0) return { ok: false, reason: "Không tìm thấy góp ý" };
    const ticket = this.tickets[i]!;
    if (ticket.status === "closed" && opts.by === "user") {
      return {
        ok: false,
        reason: "Ticket đã đóng — tạo góp ý mới nếu cần",
      };
    }
    const body = cleanText(opts.body, BODY_MAX);
    if (!body) return { ok: false, reason: "Thiếu nội dung" };
    if (ticket.messages.length >= MSG_CAP) {
      return { ok: false, reason: "Thread đã đủ tin — tạo ticket mới" };
    }
    const now = Date.now();
    ticket.messages.push({
      id: randomBytes(5).toString("hex"),
      at: now,
      by: opts.by,
      byUserId: opts.byUserId,
      byName: cleanText(opts.byName, 48) || (opts.by === "staff" ? "staff" : "user"),
      body,
    });
    ticket.updatedAt = now;
    if (opts.by === "staff") {
      if (ticket.status !== "closed") ticket.status = "replied";
    } else if (ticket.status === "replied") {
      ticket.status = "open";
    }
    this.tickets.splice(i, 1);
    this.tickets.unshift(ticket);
    this.save();
    return { ok: true, ticket: publicTicket(ticket) };
  }

  setStatus(
    id: string,
    status: FeedbackStatus,
  ):
    | { ok: true; ticket: FeedbackTicket }
    | { ok: false; reason: string } {
    if (!isFeedbackStatus(status)) {
      return { ok: false, reason: "Trạng thái không hợp lệ" };
    }
    const ticket = this.tickets.find((t) => t.id === id);
    if (!ticket) return { ok: false, reason: "Không tìm thấy góp ý" };
    ticket.status = status;
    ticket.updatedAt = Date.now();
    this.save();
    return { ok: true, ticket: publicTicket(ticket) };
  }
}

export const feedbackStore = new FeedbackStore();
