/**
 * Mess — tin nhắn 1–1 user ↔ mainadmin (+ ảnh).
 * Persist: server/data/mess-threads.json
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

export interface MessMessage {
  id: string;
  at: number;
  by: "user" | "staff";
  byUserId: string;
  byName: string;
  body?: string;
  imageUrl?: string;
}

export interface MessThread {
  id: string;
  userId: string;
  userName: string;
  userCode?: string;
  at: number;
  updatedAt: number;
  /** Lần cuối user đọc (tin staff) */
  userReadAt: number;
  /** Lần cuối staff đọc */
  staffReadAt: number;
  messages: MessMessage[];
}

interface MessFile {
  version: 1;
  threads: MessThread[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "mess-threads.json");
const TMP = join(DATA_DIR, "mess-threads.json.tmp");
const UPLOAD_DIR = join(DATA_DIR, "uploads", "mess");

const THREAD_CAP = 300;
const MSG_CAP = 80;
const BODY_MAX = 1500;
const MAX_UPLOAD_BYTES = 900_000;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function cleanText(raw: unknown, max: number): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

function nid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export function saveMessImage(
  ownerKey: string,
  dataUrl: string,
): { ok: true; imageUrl: string } | { ok: false; reason: string } {
  const key = ownerKey.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  if (key.length < 2) return { ok: false, reason: "Mã lưu ảnh không hợp lệ" };

  const m =
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
      dataUrl.trim(),
    );
  if (!m) return { ok: false, reason: "Ảnh phải là JPG, PNG hoặc WebP" };

  const mime = m[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
  const ext = MIME_EXT[mime];
  if (!ext) return { ok: false, reason: "Định dạng ảnh không hỗ trợ" };

  let buf: Buffer;
  try {
    buf = Buffer.from(m[2]!.replace(/\s+/g, ""), "base64");
  } catch {
    return { ok: false, reason: "Không đọc được ảnh" };
  }
  if (!buf.length || buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "Ảnh quá lớn (tối đa ~900KB)" };
  }

  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${key}_${Date.now().toString(36)}.${ext}`;
  writeFileSync(join(UPLOAD_DIR, filename), buf);
  return { ok: true, imageUrl: `/uploads/mess/${filename}` };
}

function publicThread(t: MessThread): MessThread {
  return {
    ...t,
    messages: t.messages.map((m) => ({ ...m })),
  };
}

export class MessStore {
  private threads: MessThread[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as MessFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.threads)) return;
      this.threads = parsed.threads.slice(0, THREAD_CAP).map((t) => ({
        ...t,
        messages: Array.isArray(t.messages) ? t.messages.slice(-MSG_CAP) : [],
        userReadAt: Number(t.userReadAt) || 0,
        staffReadAt: Number(t.staffReadAt) || 0,
      }));
      console.log(`[mess] Loaded ${this.threads.length} threads`);
    } catch (err) {
      console.warn("[mess] Failed to load:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: MessFile = { version: 1, threads: this.threads };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[mess] Failed to save:", err);
    }
  }

  unreadForStaff(): number {
    return this.threads.filter((t) => {
      const lastUser = [...t.messages].reverse().find((m) => m.by === "user");
      return lastUser && lastUser.at > (t.staffReadAt || 0);
    }).length;
  }

  listAll(limit = 80): MessThread[] {
    return [...this.threads]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map(publicThread);
  }

  getByUserId(userId: string): MessThread | null {
    const t = this.threads.find((x) => x.userId === userId);
    return t ? publicThread(t) : null;
  }

  getById(id: string): MessThread | null {
    const t = this.threads.find((x) => x.id === id);
    return t ? publicThread(t) : null;
  }

  ensureThread(opts: {
    userId: string;
    userName: string;
    userCode?: string;
  }): MessThread {
    const existing = this.threads.find((t) => t.userId === opts.userId);
    if (existing) return publicThread(existing);
    const now = Date.now();
    const t: MessThread = {
      id: nid("ms"),
      userId: opts.userId,
      userName: opts.userName.slice(0, 60),
      userCode: opts.userCode,
      at: now,
      updatedAt: now,
      userReadAt: now,
      staffReadAt: 0,
      messages: [],
    };
    this.threads.unshift(t);
    this.threads = this.threads.slice(0, THREAD_CAP);
    this.save();
    return publicThread(t);
  }

  addMessage(opts: {
    threadId?: string;
    userId: string;
    userName: string;
    userCode?: string;
    by: "user" | "staff";
    byUserId: string;
    byName: string;
    body?: string;
    imageUrl?: string;
  }): { ok: true; thread: MessThread } | { ok: false; reason: string } {
    const body = cleanText(opts.body, BODY_MAX);
    const imageUrl = opts.imageUrl
      ? String(opts.imageUrl).trim().slice(0, 200)
      : "";
    if (!body && !imageUrl) {
      return { ok: false, reason: "Cần nội dung hoặc ảnh" };
    }
    if (imageUrl && !/^\/uploads\/mess\/[A-Za-z0-9_.-]+$/i.test(imageUrl)) {
      return { ok: false, reason: "URL ảnh không hợp lệ" };
    }

    let thread =
      (opts.threadId
        ? this.threads.find((t) => t.id === opts.threadId)
        : null) ?? this.threads.find((t) => t.userId === opts.userId);

    if (!thread) {
      if (opts.by !== "user") {
        return { ok: false, reason: "Chưa có hội thoại" };
      }
      this.ensureThread({
        userId: opts.userId,
        userName: opts.userName,
        userCode: opts.userCode,
      });
      thread = this.threads.find((t) => t.userId === opts.userId)!;
    }

    if (opts.by === "user" && thread.userId !== opts.userId) {
      return { ok: false, reason: "Không đúng chủ hội thoại" };
    }

    const now = Date.now();
    const msg: MessMessage = {
      id: nid("mm"),
      at: now,
      by: opts.by,
      byUserId: opts.byUserId,
      byName: opts.byName.slice(0, 60),
      body: body || undefined,
      imageUrl: imageUrl || undefined,
    };
    thread.messages.push(msg);
    if (thread.messages.length > MSG_CAP) {
      thread.messages = thread.messages.slice(-MSG_CAP);
    }
    thread.updatedAt = now;
    if (opts.by === "user") thread.userReadAt = now;
    else thread.staffReadAt = now;
    this.save();
    return { ok: true, thread: publicThread(thread) };
  }

  markRead(
    threadId: string,
    who: "user" | "staff",
  ): MessThread | null {
    const t = this.threads.find((x) => x.id === threadId);
    if (!t) return null;
    const now = Date.now();
    if (who === "user") t.userReadAt = now;
    else t.staffReadAt = now;
    this.save();
    return publicThread(t);
  }
}

export const messStore = new MessStore();
