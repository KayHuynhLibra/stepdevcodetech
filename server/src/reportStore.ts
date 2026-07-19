import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

export interface ChatReport {
  id: string;
  at: number;
  reporterId: string;
  reporterName: string;
  targetUserId?: string;
  targetName: string;
  text: string;
  mode?: string;
  status: "open" | "done";
}

interface ReportsFile {
  version: 1;
  reports: ChatReport[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "reports.json");
const TMP = join(DATA_DIR, "reports.json.tmp");
const CAP = 300;

export class ReportStore {
  private reports: ChatReport[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as ReportsFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.reports)) return;
      this.reports = parsed.reports.slice(0, CAP);
      console.log(`[reports] Loaded ${this.reports.length} reports`);
    } catch (err) {
      console.warn("[reports] Failed to load:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: ReportsFile = { version: 1, reports: this.reports };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[reports] Failed to save:", err);
    }
  }

  add(opts: {
    reporterId: string;
    reporterName: string;
    targetUserId?: string;
    targetName: string;
    text: string;
    mode?: string;
  }): ChatReport {
    const entry: ChatReport = {
      id: randomBytes(6).toString("hex"),
      at: Date.now(),
      reporterId: opts.reporterId,
      reporterName: opts.reporterName,
      targetUserId: opts.targetUserId,
      targetName: opts.targetName,
      text: String(opts.text ?? "").slice(0, 120),
      mode: opts.mode,
      status: "open",
    };
    this.reports.unshift(entry);
    if (this.reports.length > CAP) this.reports.length = CAP;
    this.save();
    return entry;
  }

  list(limit = 60): ChatReport[] {
    return this.reports.slice(0, Math.max(1, Math.min(200, limit)));
  }

  setStatus(
    id: string,
    status: "open" | "done",
  ): { ok: true; report: ChatReport } | { ok: false; reason: string } {
    const r = this.reports.find((x) => x.id === id);
    if (!r) return { ok: false, reason: "Không tìm thấy báo cáo" };
    r.status = status;
    this.save();
    return { ok: true, report: r };
  }
}

export const reportStore = new ReportStore();
