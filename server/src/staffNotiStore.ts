import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

export interface StaffNoti {
  id: string;
  at: number;
  byUserId: string;
  byName: string;
  title: string;
  body: string;
  pinned?: boolean;
}

interface StaffNotiFile {
  version: 1;
  entries: StaffNoti[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "staff-noti.json");
const TMP = join(DATA_DIR, "staff-noti.json.tmp");
const CAP = 100;
const TITLE_MAX = 80;
const BODY_MAX = 2000;

function cleanText(raw: unknown, max: number): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export class StaffNotiStore {
  private entries: StaffNoti[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as StaffNotiFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) return;
      this.entries = parsed.entries.slice(0, CAP);
      console.log(`[staff-noti] Loaded ${this.entries.length}`);
    } catch (err) {
      console.warn("[staff-noti] Failed to load:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: StaffNotiFile = { version: 1, entries: this.entries };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[staff-noti] Failed to save:", err);
    }
  }

  list(limit = 50): StaffNoti[] {
    return this.entries.slice(0, Math.max(1, Math.min(CAP, limit)));
  }

  add(opts: {
    byUserId: string;
    byName: string;
    title: unknown;
    body: unknown;
    pinned?: boolean;
  }): { ok: true; entry: StaffNoti } | { ok: false; reason: string } {
    const title = cleanText(opts.title, TITLE_MAX);
    const body = cleanText(opts.body, BODY_MAX);
    if (!title) return { ok: false, reason: "Thiếu tiêu đề" };
    if (!body) return { ok: false, reason: "Thiếu nội dung" };
    const entry: StaffNoti = {
      id: randomBytes(6).toString("hex"),
      at: Date.now(),
      byUserId: String(opts.byUserId ?? ""),
      byName: cleanText(opts.byName, 48) || "mainadmin",
      title,
      body,
      pinned: !!opts.pinned,
    };
    if (entry.pinned) {
      this.entries = [entry, ...this.entries.filter((e) => !e.pinned)];
    } else {
      const pinned = this.entries.filter((e) => e.pinned);
      const rest = this.entries.filter((e) => !e.pinned);
      this.entries = [...pinned, entry, ...rest];
    }
    if (this.entries.length > CAP) this.entries.length = CAP;
    this.save();
    return { ok: true, entry };
  }

  remove(
    id: string,
  ): { ok: true } | { ok: false; reason: string } {
    const i = this.entries.findIndex((e) => e.id === id);
    if (i < 0) return { ok: false, reason: "Không tìm thấy thông báo" };
    this.entries.splice(i, 1);
    this.save();
    return { ok: true };
  }
}

export const staffNotiStore = new StaffNotiStore();
