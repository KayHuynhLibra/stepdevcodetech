import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "arcana-streaks.json");

export interface StreakBonusConfig {
  streakBonusEnabled: boolean;
  streakBonusMinStreak: number;
  streakBonusPercentPerStep: number;
  streakBonusCapPercent: number;
}

export const DEFAULT_STREAK_BONUS: StreakBonusConfig = {
  streakBonusEnabled: true,
  streakBonusMinStreak: 3,
  streakBonusPercentPerStep: 5,
  streakBonusCapPercent: 15,
};

interface StreaksFile {
  version: 1;
  byUser: Record<string, number>;
}

function atomicWrite(data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, PATH);
}

/** Chuỗi sau lượt: thắng +1 (từ 0), thua -1 (từ 0). */
export function advanceLuckStreak(streak: number, won: boolean): number {
  return won ? Math.max(0, streak) + 1 : Math.min(0, streak) - 1;
}

/** % thưởng thêm khi thắng với chuỗi trước lượt quay = streakBefore. */
export function computeStreakBonusPercent(
  streakBefore: number,
  cfg: StreakBonusConfig,
  won: boolean,
): number {
  if (!won || !cfg.streakBonusEnabled) return 0;
  const min = Math.max(1, Math.floor(cfg.streakBonusMinStreak));
  if (streakBefore < min) return 0;
  const per = Math.max(0, cfg.streakBonusPercentPerStep);
  const cap = Math.max(0, cfg.streakBonusCapPercent);
  const steps = streakBefore - min + 1;
  return Math.min(cap, steps * per);
}

/** % nếu thắng lượt tới (chuỗi hiện tại = streakBefore). */
export function previewNextWinBonusPercent(
  streakBefore: number,
  cfg: StreakBonusConfig,
): number {
  return computeStreakBonusPercent(streakBefore, cfg, true);
}

export function applyStreakBonusToPayout(
  payoutBase: number,
  bonusPct: number,
): number {
  if (payoutBase <= 0 || bonusPct <= 0) return payoutBase;
  return Math.max(0, Math.floor(payoutBase * (1 + bonusPct / 100)));
}

class ArcanaStreakStore {
  private byUser: Record<string, number> = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        return;
      }
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as StreaksFile;
      if (parsed?.version === 1 && parsed.byUser) {
        this.byUser = { ...parsed.byUser };
      }
    } catch (err) {
      console.warn("[arcana-streak] load failed:", err);
    }
  }

  private save() {
    try {
      atomicWrite({ version: 1, byUser: this.byUser } satisfies StreaksFile);
    } catch (err) {
      console.warn("[arcana-streak] save failed:", err);
    }
  }

  get(userId: string): number {
    const v = this.byUser[userId];
    return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0;
  }

  /** Trả streak sau lượt và lưu. */
  recordSpin(userId: string, won: boolean): {
    streakBefore: number;
    streakAfter: number;
  } {
    const streakBefore = this.get(userId);
    const streakAfter = advanceLuckStreak(streakBefore, won);
    this.byUser[userId] = streakAfter;
    this.save();
    return { streakBefore, streakAfter };
  }
}

export const arcanaStreakStore = new ArcanaStreakStore();
