import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  CULTIVATION_RANKS,
  isCultivationRank,
  type CultivationRank,
} from "./cultivationRanks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "tutien-bet-limits.json");

/** Trần cược công khai (mọi role) — Tarot / lá & Arcana chip thường. */
export const PUBLIC_MAX_STAKE = 1_000_000;
export const ABSOLUTE_MAX_STAKE = 100_000_000;

export type TutienMaxByRank = Record<CultivationRank, number>;

export const DEFAULT_TUTIEN_MAX_BY_RANK: TutienMaxByRank = {
  luyen_khi: 2_000_000,
  truc_co: 3_000_000,
  kim_dan: 5_000_000,
  nguyen_anh: 8_000_000,
  hoa_than: 12_000_000,
  luyen_hu: 20_000_000,
  hop_the: 30_000_000,
  dai_thua: 40_000_000,
  do_kiep: 50_000_000,
};

export function normalizeTutienMaxByRank(
  raw?: Partial<Record<string, number>> | null,
): TutienMaxByRank {
  const out = { ...DEFAULT_TUTIEN_MAX_BY_RANK };
  if (!raw || typeof raw !== "object") return out;
  for (const rank of CULTIVATION_RANKS) {
    const n = Math.floor(Number(raw[rank]));
    if (
      Number.isFinite(n) &&
      n >= PUBLIC_MAX_STAKE &&
      n <= ABSOLUTE_MAX_STAKE
    ) {
      out[rank] = n;
    }
  }
  return out;
}

function tutienHighTiers(map: TutienMaxByRank): number[] {
  return [
    ...new Set(
      CULTIVATION_RANKS.map((r) => map[r]).filter((n) => n > PUBLIC_MAX_STAKE),
    ),
  ].sort((a, b) => a - b);
}

export function personalTutienMax(
  user: { role: string; cultivationRank?: string } | null | undefined,
  map?: TutienMaxByRank,
): number | null {
  if (!user) return null;
  const m = map ?? tutienBetLimitsStore.getMap();
  const hasRank =
    !!user.cultivationRank && isCultivationRank(user.cultivationRank);
  /** role tutien/mainadmin, hoặc đã có cảnh giới công khai */
  const eligible =
    user.role === "tutien" || user.role === "mainadmin" || hasRank;
  if (!eligible) return null;
  /** Có cảnh giới → trần theo bậc; chưa có → Luyện Khí */
  if (hasRank) return m[user.cultivationRank as CultivationRank] ?? m.luyen_khi;
  return m.luyen_khi;
}

/** Trần đặt / lá (Tarot) hoặc chip max (Arcana) cho user. */
export function maxStakeForUser(
  user: { role: string; cultivationRank?: string } | null | undefined,
): number {
  return personalTutienMax(user) ?? PUBLIC_MAX_STAKE;
}

export function effectiveBetTiersForUser(
  user: { role: string; cultivationRank?: string } | null | undefined,
  publicTiers: number[],
  map?: TutienMaxByRank,
): number[] {
  const limits = map ?? tutienBetLimitsStore.getMap();
  const base = [
    ...new Set(
      publicTiers
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= PUBLIC_MAX_STAKE),
    ),
  ].sort((a, b) => a - b);
  const max = personalTutienMax(user, limits);
  if (max == null) return base;
  const high = tutienHighTiers(limits).filter((n) => n <= max);
  return [...new Set([...base, ...high])].sort((a, b) => a - b);
}

export function isStakeAllowedForUser(
  stake: number,
  user: { role: string; cultivationRank?: string },
  publicTiers: number[],
  map?: TutienMaxByRank,
): boolean {
  return effectiveBetTiersForUser(user, publicTiers, map).includes(stake);
}

/** Quick-add chips for Tarot bet sheet (public + tutien highs ≤ personal max). */
export function quickAddsForUser(
  user: { role: string; cultivationRank?: string } | null | undefined,
): number[] {
  const publicAdds = [10, 100, 1_000, 10_000, 100_000, 1_000_000];
  return effectiveBetTiersForUser(user, publicAdds);
}

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, path);
}

class TutienBetLimitsStore {
  private map: TutienMaxByRank = { ...DEFAULT_TUTIEN_MAX_BY_RANK };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        return;
      }
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as {
        tutienMaxByRank?: Partial<Record<string, number>>;
      };
      this.map = normalizeTutienMaxByRank(parsed.tutienMaxByRank);
    } catch (err) {
      console.warn("[tutien-bet-limits] load failed:", err);
      this.map = { ...DEFAULT_TUTIEN_MAX_BY_RANK };
    }
  }

  private save() {
    try {
      atomicWrite(PATH, {
        version: 1,
        tutienMaxByRank: this.map,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn("[tutien-bet-limits] save failed:", err);
    }
  }

  getMap(): TutienMaxByRank {
    return { ...this.map };
  }

  /** Seed from legacy arcana-wheel.json once if shared file was empty defaults. */
  seedFromLegacy(raw?: Partial<Record<string, number>> | null) {
    if (!raw) return;
    const next = normalizeTutienMaxByRank(raw);
    const same = CULTIVATION_RANKS.every(
      (r) => next[r] === DEFAULT_TUTIEN_MAX_BY_RANK[r],
    );
    if (same) return;
    // Only seed if file still equals defaults (first migration)
    const stillDefault = CULTIVATION_RANKS.every(
      (r) => this.map[r] === DEFAULT_TUTIEN_MAX_BY_RANK[r],
    );
    if (!stillDefault) return;
    this.map = next;
    this.save();
    console.log("[tutien-bet-limits] Seeded from legacy arcana config");
  }

  setMap(
    patch: Partial<Record<string, number>>,
  ): { ok: true; map: TutienMaxByRank } | { ok: false; reason: string } {
    if (!patch || typeof patch !== "object") {
      return { ok: false, reason: "tutienMaxByRank không hợp lệ" };
    }
    for (const [k, v] of Object.entries(patch)) {
      if (!isCultivationRank(k)) continue;
      const n = Math.floor(Number(v));
      if (
        !Number.isFinite(n) ||
        n < PUBLIC_MAX_STAKE ||
        n > ABSOLUTE_MAX_STAKE
      ) {
        return {
          ok: false,
          reason: `Max ${k} phải từ ${PUBLIC_MAX_STAKE} đến ${ABSOLUTE_MAX_STAKE}`,
        };
      }
    }
    this.map = normalizeTutienMaxByRank({ ...this.map, ...patch });
    this.save();
    return { ok: true, map: this.getMap() };
  }

  /** Payload for /api/auth/me and game UI */
  limitsForUser(user: {
    role: string;
    cultivationRank?: string;
  } | null) {
    const maxBetPerCard = maxStakeForUser(user);
    return {
      maxBetPerCard,
      publicMaxStake: PUBLIC_MAX_STAKE,
      quickAdds: quickAddsForUser(user),
      tutienMaxByRank:
        user?.role === "tutien" || user?.role === "mainadmin"
          ? this.getMap()
          : undefined,
    };
  }
}

export const tutienBetLimitsStore = new TutienBetLimitsStore();
