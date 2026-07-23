/**
 * Thưởng theo cấp chơi bài (playLevel 1–99).
 * Persist `server/data/play-level-rewards.json`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PLAY_LEVEL_MAX, PLAY_LEVEL_MIN } from "./playLevel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "play-level-rewards.json");
const TMP = join(DATA_DIR, "play-level-rewards.json.tmp");

export interface LevelRewardRow {
  level: number;
  xu: number;
  gem?: number;
}

export interface PlayLevelRewardsPublic {
  enabled: boolean;
  rewards: LevelRewardRow[];
}

export interface PlayLevelRewardsConfig extends PlayLevelRewardsPublic {
  version: 1;
  updatedAt: number;
  updatedBy?: string;
}

const DEFAULT_REWARDS: LevelRewardRow[] = [
  { level: 5, xu: 5_000 },
  { level: 10, xu: 15_000 },
  { level: 15, xu: 30_000 },
  { level: 20, xu: 50_000 },
  { level: 30, xu: 100_000 },
  { level: 45, xu: 250_000 },
  { level: 50, xu: 400_000 },
  { level: 70, xu: 1_000_000 },
  { level: 90, xu: 3_000_000 },
  { level: 99, xu: 10_000_000 },
];

function clampLevel(raw: unknown): number | null {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return null;
  if (n < PLAY_LEVEL_MIN || n > PLAY_LEVEL_MAX) return null;
  return n;
}

function clampXu(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 99_999_999_999);
}

function clampGem(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 99_999_999);
}

function normalizeRewards(raw: unknown): LevelRewardRow[] {
  if (!Array.isArray(raw)) return DEFAULT_REWARDS.map((r) => ({ ...r }));
  const byLevel = new Map<number, LevelRewardRow>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<LevelRewardRow>;
    const level = clampLevel(row.level);
    if (level == null) continue;
    const xu = clampXu(row.xu);
    const gem = clampGem(row.gem);
    if (xu <= 0 && gem <= 0) continue;
    byLevel.set(level, {
      level,
      xu,
      ...(gem > 0 ? { gem } : {}),
    });
  }
  return [...byLevel.values()].sort((a, b) => a.level - b.level);
}

class PlayLevelRewardsStore {
  private enabled = true;
  private rewards: LevelRewardRow[] = DEFAULT_REWARDS.map((r) => ({ ...r }));
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(
        readFileSync(PATH, "utf8"),
      ) as Partial<PlayLevelRewardsConfig>;
      if (parsed?.version !== 1) return;
      this.enabled = parsed.enabled !== false;
      this.rewards = normalizeRewards(parsed.rewards);
      this.updatedAt = Number(parsed.updatedAt) || 0;
      this.updatedBy = String(parsed.updatedBy ?? "");
    } catch (err) {
      console.warn("[play-level-rewards] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: PlayLevelRewardsConfig = {
      version: 1,
      enabled: this.enabled,
      rewards: this.rewards,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  getPublic(): PlayLevelRewardsPublic {
    return {
      enabled: this.enabled,
      rewards: this.rewards.map((r) => ({ ...r })),
    };
  }

  get(): PlayLevelRewardsConfig {
    return {
      version: 1,
      enabled: this.enabled,
      rewards: this.rewards.map((r) => ({ ...r })),
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
    };
  }

  set(
    patch: { enabled?: unknown; rewards?: unknown },
    byUsername: string,
  ): { ok: true; config: PlayLevelRewardsConfig } {
    if (patch.enabled !== undefined) {
      this.enabled = !!patch.enabled;
    }
    if (patch.rewards !== undefined) {
      this.rewards = normalizeRewards(patch.rewards);
    }
    this.updatedAt = Date.now();
    this.updatedBy = String(byUsername ?? "").trim();
    this.save();
    return { ok: true, config: this.get() };
  }

  /** Các mốc thưởng chưa claim với cấp hiện tại. */
  pendingForLevel(levelRaw: unknown, claimedRaw: unknown): LevelRewardRow[] {
    if (!this.enabled) return [];
    const level = clampLevel(levelRaw) ?? PLAY_LEVEL_MIN;
    const claimed = new Set(
      Array.isArray(claimedRaw)
        ? claimedRaw
            .map((x) => clampLevel(x))
            .filter((x): x is number => x != null)
        : [],
    );
    return this.rewards.filter((r) => r.level <= level && !claimed.has(r.level));
  }
}

export const playLevelRewardsStore = new PlayLevelRewardsStore();
