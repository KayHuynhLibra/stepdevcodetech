import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "leaderboard-config.json");
const TMP = join(DATA_DIR, "leaderboard-config.json.tmp");

export interface LeaderboardFlags {
  /** Cao thủ dự đoán (topAces / winToday board) */
  winToday: boolean;
  /** Đại gia (balance board) */
  balance: boolean;
  /** Sao bài Tarot */
  tarotStars: boolean;
}

export interface LeaderboardConfig extends LeaderboardFlags {
  version: 1;
  updatedAt: number;
  updatedBy?: string;
}

const DEFAULT_FLAGS: LeaderboardFlags = {
  winToday: true,
  balance: true,
  tarotStars: true,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === 0 || v === "0" || v === "false") return false;
  if (v === 1 || v === "1" || v === "true") return true;
  return fallback;
}

class LeaderboardConfigStore {
  private winToday = true;
  private balance = true;
  private tarotStars = true;
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as Partial<LeaderboardConfig>;
      if (parsed?.version !== 1) return;
      this.winToday = asBool(parsed.winToday, true);
      this.balance = asBool(parsed.balance, true);
      this.tarotStars = asBool(parsed.tarotStars, true);
      this.updatedAt = Number(parsed.updatedAt) || 0;
      this.updatedBy = String(parsed.updatedBy ?? "");
    } catch (err) {
      console.warn("[leaderboard-config] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: LeaderboardConfig = {
      version: 1,
      winToday: this.winToday,
      balance: this.balance,
      tarotStars: this.tarotStars,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  get(): LeaderboardConfig {
    return {
      version: 1,
      winToday: this.winToday,
      balance: this.balance,
      tarotStars: this.tarotStars,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
    };
  }

  publicFlags(): LeaderboardFlags {
    return {
      winToday: this.winToday,
      balance: this.balance,
      tarotStars: this.tarotStars,
    };
  }

  set(
    patch: { winToday?: unknown; balance?: unknown; tarotStars?: unknown },
    byUsername: string,
  ): { ok: true; config: LeaderboardConfig } {
    if (patch.winToday !== undefined) {
      this.winToday = asBool(patch.winToday, this.winToday);
    }
    if (patch.balance !== undefined) {
      this.balance = asBool(patch.balance, this.balance);
    }
    if (patch.tarotStars !== undefined) {
      this.tarotStars = asBool(patch.tarotStars, this.tarotStars);
    }
    this.updatedAt = Date.now();
    this.updatedBy = String(byUsername ?? "").trim();
    this.save();
    return { ok: true, config: this.get() };
  }
}

export const leaderboardConfigStore = new LeaderboardConfigStore();

/** Defaults when flags missing on client */
export const DEFAULT_LEADERBOARD_FLAGS = DEFAULT_FLAGS;
