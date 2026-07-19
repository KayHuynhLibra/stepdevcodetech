import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

export interface AuditEntry {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  action: string;
  targetId?: string;
  targetName?: string;
  detail?: string;
}

interface AuditFile {
  version: 1;
  entries: AuditEntry[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "audit.json");
const TMP = join(DATA_DIR, "audit.json.tmp");
const CAP = 500;

export class AuditStore {
  private entries: AuditEntry[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as AuditFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) return;
      this.entries = parsed.entries.slice(0, CAP);
      console.log(`[audit] Loaded ${this.entries.length} entries`);
    } catch (err) {
      console.warn("[audit] Failed to load:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: AuditFile = { version: 1, entries: this.entries };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[audit] Failed to save:", err);
    }
  }

  log(opts: {
    actorId: string;
    actorName: string;
    action: string;
    targetId?: string;
    targetName?: string;
    detail?: string;
  }): AuditEntry {
    const entry: AuditEntry = {
      id: randomBytes(6).toString("hex"),
      at: Date.now(),
      actorId: opts.actorId,
      actorName: opts.actorName,
      action: opts.action,
      targetId: opts.targetId,
      targetName: opts.targetName,
      detail: opts.detail,
    };
    this.entries.unshift(entry);
    if (this.entries.length > CAP) this.entries.length = CAP;
    this.save();
    return entry;
  }

  list(limit = 80): AuditEntry[] {
    return this.entries.slice(0, Math.max(1, Math.min(200, limit)));
  }
}

export const auditStore = new AuditStore();
