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
const PATH = join(DATA_DIR, "tutien-stake-limits.json");
const LEGACY_PATH = join(DATA_DIR, "tutien-bet-limits.json");

/** Trần xu đặt công khai (mọi role) — Tarot / lá & Arcana chip thường. */
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

/** Extra chip amounts (between PUBLIC_MAX and personal max). */
export const DEFAULT_EXTRA_STAKE_TIERS: number[] = [
  2_000_000,
  3_000_000,
  5_000_000,
  8_000_000,
  10_000_000,
  12_000_000,
  20_000_000,
  30_000_000,
  50_000_000,
];

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

export function normalizeExtraStakeTiers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_EXTRA_STAKE_TIERS];
  const out = new Set<number>();
  for (const x of raw) {
    const n = Math.floor(Number(x));
    if (
      Number.isFinite(n) &&
      n > PUBLIC_MAX_STAKE &&
      n <= ABSOLUTE_MAX_STAKE
    ) {
      out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
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
  const m = map ?? tutienStakeLimitsStore.getMap();
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

export function effectiveStakeTiersForUser(
  user: { role: string; cultivationRank?: string } | null | undefined,
  publicTiers: number[],
  map?: TutienMaxByRank,
): number[] {
  const limits = map ?? tutienStakeLimitsStore.getMap();
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
  const extras = tutienStakeLimitsStore
    .getExtraStakeTiers()
    .filter((n) => n > PUBLIC_MAX_STAKE && n <= max);
  return [...new Set([...base, ...high, ...extras])].sort((a, b) => a - b);
}

export function isStakeAllowedForUser(
  stake: number,
  user: { role: string; cultivationRank?: string },
  publicTiers: number[],
  map?: TutienMaxByRank,
): boolean {
  return effectiveStakeTiersForUser(user, publicTiers, map).includes(stake);
}

/** Quick-add chips for Tarot stake sheet (public + tutien highs ≤ personal max). */
export function quickAddsForUser(
  user: { role: string; cultivationRank?: string } | null | undefined,
): number[] {
  const publicAdds = [10, 100, 1_000, 10_000, 100_000, 1_000_000];
  return effectiveStakeTiersForUser(user, publicAdds);
}

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, path);
}

class TutienStakeLimitsStore {
  private map: TutienMaxByRank = { ...DEFAULT_TUTIEN_MAX_BY_RANK };
  private extraStakeTiers: number[] = [...DEFAULT_EXTRA_STAKE_TIERS];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const src = existsSync(PATH)
        ? PATH
        : existsSync(LEGACY_PATH)
          ? LEGACY_PATH
          : null;
      if (!src) {
        this.save();
        return;
      }
      const parsed = JSON.parse(readFileSync(src, "utf8")) as {
        tutienMaxByRank?: Partial<Record<string, number>>;
        extraStakeTiers?: unknown;
      };
      this.map = normalizeTutienMaxByRank(parsed.tutienMaxByRank);
      this.extraStakeTiers =
        parsed.extraStakeTiers !== undefined
          ? normalizeExtraStakeTiers(parsed.extraStakeTiers)
          : [...DEFAULT_EXTRA_STAKE_TIERS];
      if (src !== PATH) this.save();
    } catch (err) {
      console.warn("[tutien-stake-limits] load failed:", err);
      this.map = { ...DEFAULT_TUTIEN_MAX_BY_RANK };
      this.extraStakeTiers = [...DEFAULT_EXTRA_STAKE_TIERS];
    }
  }

  private save() {
    try {
      atomicWrite(PATH, {
        version: 1,
        tutienMaxByRank: this.map,
        extraStakeTiers: this.extraStakeTiers,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn("[tutien-stake-limits] save failed:", err);
    }
  }

  getMap(): TutienMaxByRank {
    return { ...this.map };
  }

  getExtraStakeTiers(): number[] {
    return [...this.extraStakeTiers];
  }

  setExtraStakeTiers(
    raw: unknown,
  ): { ok: true; extraStakeTiers: number[] } | { ok: false; reason: string } {
    if (!Array.isArray(raw)) {
      return { ok: false, reason: "extraStakeTiers phải là mảng số" };
    }
    this.extraStakeTiers = normalizeExtraStakeTiers(raw);
    this.save();
    return { ok: true, extraStakeTiers: this.getExtraStakeTiers() };
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
    console.log("[tutien-stake-limits] Seeded from legacy arcana config");
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
    const maxStakePerCard = maxStakeForUser(user);
    return {
      maxStakePerCard,
      publicMaxStake: PUBLIC_MAX_STAKE,
      quickAdds: quickAddsForUser(user),
      extraStakeTiers: this.getExtraStakeTiers().filter(
        (n) => n <= maxStakePerCard,
      ),
      tutienMaxByRank:
        user?.role === "tutien" || user?.role === "mainadmin"
          ? this.getMap()
          : undefined,
    };
  }
}

export const tutienStakeLimitsStore = new TutienStakeLimitsStore();
