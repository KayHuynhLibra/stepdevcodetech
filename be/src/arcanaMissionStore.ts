import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "arcana-missions.json");
const TMP = join(DATA_DIR, "arcana-missions.json.tmp");

export const MISSION_STAKE_MIN = 10_000;
export const MISSION_TARGET = 3;
export const MISSION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MISSION_BONUS_STAKE = 300;

type UserMission = {
  qualifyingAt: number[];
  bonusSpins: number;
};

interface MissionFile {
  version: 1;
  users: Record<string, UserMission>;
}

function defaultUser(): UserMission {
  return { qualifyingAt: [], bonusSpins: 0 };
}

class ArcanaMissionStore {
  private users = new Map<string, UserMission>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as MissionFile;
      if (parsed?.version !== 1 || !parsed.users) return;
      for (const [id, row] of Object.entries(parsed.users)) {
        if (!row || typeof row !== "object") continue;
        this.users.set(id, {
          qualifyingAt: Array.isArray(row.qualifyingAt)
            ? row.qualifyingAt.filter((t) => Number.isFinite(t))
            : [],
          bonusSpins: Math.max(0, Math.floor(Number(row.bonusSpins) || 0)),
        });
      }
    } catch (err) {
      console.warn("[arcana-mission] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const users: Record<string, UserMission> = {};
    for (const [id, row] of this.users) users[id] = row;
    writeFileSync(
      TMP,
      JSON.stringify({ version: 1, users } satisfies MissionFile, null, 2),
      "utf8",
    );
    renameSync(TMP, PATH);
  }

  private prune(row: UserMission, now: number) {
    const cut = now - MISSION_WINDOW_MS;
    row.qualifyingAt = row.qualifyingAt.filter((t) => t >= cut);
  }

  getProgress(userId: string) {
    const now = Date.now();
    const row = this.users.get(userId) ?? defaultUser();
    this.prune(row, now);
    this.users.set(userId, row);
    return {
      count: row.qualifyingAt.length,
      target: MISSION_TARGET,
      bonusSpins: row.bonusSpins,
      stakeMin: MISSION_STAKE_MIN,
      bonusStake: MISSION_BONUS_STAKE,
      windowHours: 24,
    };
  }

  recordPaidSpin(userId: string, stake: number): boolean {
    if (stake < MISSION_STAKE_MIN) return false;
    const now = Date.now();
    let row = this.users.get(userId);
    if (!row) {
      row = defaultUser();
      this.users.set(userId, row);
    }
    this.prune(row, now);
    row.qualifyingAt.push(now);
    let completed = false;
    if (row.qualifyingAt.length >= MISSION_TARGET) {
      row.bonusSpins += 1;
      row.qualifyingAt = [];
      completed = true;
    }
    this.save();
    return completed;
  }

  consumeBonusSpin(userId: string): boolean {
    const row = this.users.get(userId);
    if (!row || row.bonusSpins <= 0) return false;
    row.bonusSpins -= 1;
    this.save();
    return true;
  }
}

export const arcanaMissionStore = new ArcanaMissionStore();
