import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes, randomInt } from "crypto";
import { authStore } from "./auth.js";
import {
  computeArcanaPayout,
  computeRtpPreview,
  DEFAULT_PAYOUT_SCALE,
  type RtpPickRow,
  type StreakRtpOptions,
} from "./arcanaRtp.js";
import {
  applyStreakBonusToPayout,
  arcanaStreakStore,
  computeStreakBonusPercent,
  DEFAULT_STREAK_BONUS,
  previewNextWinBonusPercent,
  type StreakBonusConfig,
} from "./arcanaStreakStore.js";
import { vaultArcana } from "./vaultStore.js";
import { CARDS } from "./cards.js";
import {
  checkEvenMoney,
  parseOuterPick,
  rollEuropeanNumber,
  type OuterEvenMoneyPick,
} from "./europeanRoulette.js";
import {
  arcanaMissionStore,
  MISSION_BONUS_STAKE,
} from "./arcanaMissionStore.js";
import {
  effectiveStakeTiersForUser,
  isStakeAllowedForUser,
  personalTutienMax,
  PUBLIC_MAX_STAKE,
  tutienStakeLimitsStore,
  type TutienMaxByRank,
} from "./tutienStakeLimitsStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const CONFIG_PATH = join(DATA_DIR, "arcana-wheel.json");
const SPINS_PATH = join(DATA_DIR, "arcana-spins.json");
const SPINS_CAP = 2000;
const RECENT_PUBLIC = 24;
const CONFIG_VERSION = 8 as const;

/** Wheel portraits (character art), not Tarot card faces. */
const ARCANA_PORTRAIT_BY_ID: Record<number, string> = {
  1: "/assets/arcana-chars/char-01-lucent.webp?v=1",
  2: "/assets/arcana-chars/char-02-veil.webp?v=1",
  3: "/assets/arcana-chars/char-03-aurelia.webp?v=1",
  4: "/assets/arcana-chars/char-04-kael.webp?v=1",
  5: "/assets/arcana-chars/char-05-twinflame.webp?v=1",
  6: "/assets/arcana-chars/char-06-vanguard.webp?v=1",
  7: "/assets/arcana-chars/char-07-astraea.webp?v=1",
  8: "/assets/arcana-chars/char-08-solara.webp?v=1",
};

function portraitImageForId(id: number, fallback?: string): string {
  return ARCANA_PORTRAIT_BY_ID[id] ?? fallback ?? ARCANA_PORTRAIT_BY_ID[1]!;
}
const PICK_MIN = 1;
const PICK_MAX = 8;
const DEFAULT_STAKE_TIERS = [
  300, 800, 1500, 3000, 10_000, 30_000, 100_000, 1_000_000,
];

export type { TutienMaxByRank };

export interface ArcanaSlot {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  /** Hệ số trả xu (1:N → N) */
  ratio: number;
  /** Weight RNG */
  weight: number;
  image: string;
}

export interface ArcanaWheelConfig {
  version: typeof CONFIG_VERSION;
  enabled: boolean;
  stakeTiers: number[];
  pickMin: number;
  pickMax: number;
  /** Trần công khai (= PUBLIC_MAX_STAKE) */
  maxStake: number;
  /** Virtual — nguồn shared tutienStakeLimitsStore (Tarot + Arcana) */
  tutienMaxByRank?: TutienMaxByRank;
  /** Hệ số thưởng (0.01–2), nhân sau khi chia số ô chọn */
  payoutScale: number;
  streakBonusEnabled: boolean;
  streakBonusMinStreak: number;
  streakBonusPercentPerStep: number;
  streakBonusCapPercent: number;
  slots: ArcanaSlot[];
  updatedAt: number;
  updatedBy?: string;
}

export interface ArcanaSpinEntry {
  id: string;
  at: number;
  userId: string;
  username: string;
  stake: number;
  /** Compat: phần tử đầu của pickIds */
  pickId: number;
  pickIds: number[];
  winId: number;
  ratio: number;
  /** Arcana layer won (pick hit) */
  won: boolean;
  payout: number;
  /** Thưởng gốc Arcana trước % chuỗi vận */
  payoutBase?: number;
  streakBonusPercent?: number;
  streakBefore?: number;
  streakAfter?: number;
  nearMiss?: boolean;
  wheelDisplayWinId?: number;
  missionCompleted?: boolean;
  usedBonusSpin?: boolean;
  /** European outer result 0–36 */
  outerNumber?: number;
  outerPick?: OuterEvenMoneyPick;
  outerWon?: boolean;
  outerPayout?: number;
  /** Arcana payout after streak (before combining with outer) */
  arcanaPayout?: number;
  /** Stake allocated to Arcana layer */
  arcanaStake?: number;
  /** Stake allocated to outer even-money */
  outerStake?: number;
  profit: number;
  seed: string;
  balanceAfter: number;
}

interface SpinsFile {
  version: 1;
  spins: ArcanaSpinEntry[];
}

/** Default ratio/weight per slot position (index = id-1). */
const DEFAULT_SLOT_RATIOS: { ratio: number; weight: number }[] = [
  { ratio: 8, weight: 20 },
  { ratio: 8, weight: 20 },
  { ratio: 12, weight: 14 },
  { ratio: 12, weight: 14 },
  { ratio: 20, weight: 10 },
  { ratio: 35, weight: 8 },
  { ratio: 60, weight: 5 },
  { ratio: 100, weight: 3 },
];

/** Build slots from Tarot CARDS, keeping ratio/weight; always use Arcana portraits. */
function syncSlotsWithTarotCards(existing?: ArcanaSlot[]): ArcanaSlot[] {
  return CARDS.map((c, i) => {
    const prev = existing?.find((s) => s.id === c.id);
    const def = DEFAULT_SLOT_RATIOS[i] ?? { ratio: 8, weight: 10 };
    return {
      id: c.id,
      key: c.key,
      name: c.name,
      nameVi: c.nameVi,
      ratio: prev?.ratio ?? def.ratio,
      weight: prev?.weight ?? def.weight,
      image: portraitImageForId(c.id),
    };
  });
}

function slotsNeedPortraitMigrate(slots?: ArcanaSlot[]): boolean {
  if (!Array.isArray(slots) || slots.length === 0) return true;
  return slots.some(
    (s) => typeof s.image !== "string" || !s.image.includes("/assets/arcana-chars/"),
  );
}

const DEFAULT_SLOTS: ArcanaSlot[] = syncSlotsWithTarotCards();

function defaultConfig(): ArcanaWheelConfig {
  return {
    version: CONFIG_VERSION,
    enabled: true,
    stakeTiers: [...DEFAULT_STAKE_TIERS],
    pickMin: PICK_MIN,
    pickMax: PICK_MAX,
    maxStake: PUBLIC_MAX_STAKE,
    payoutScale: DEFAULT_PAYOUT_SCALE,
    ...DEFAULT_STREAK_BONUS,
    slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
    updatedAt: Date.now(),
  };
}

function needsMigration(parsed: {
  version?: number;
  slots?: ArcanaSlot[];
  stakeTiers?: number[];
  maxStake?: number;
  payoutScale?: number;
  streakBonusEnabled?: boolean;
  tutienMaxByRank?: Partial<Record<string, number>>;
}): boolean {
  if (parsed.version !== CONFIG_VERSION) return true;
  if (!Array.isArray(parsed.slots) || parsed.slots.length !== CARDS.length) return true;
  if (slotsNeedPortraitMigrate(parsed.slots)) return true;
  if (typeof parsed.maxStake !== "number" || parsed.maxStake < PUBLIC_MAX_STAKE) {
    return true;
  }
  const tiers = parsed.stakeTiers ?? [];
  if (!tiers.includes(PUBLIC_MAX_STAKE)) return true;
  return false;
}

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, path);
}

function pickWeighted(slots: ArcanaSlot[]): ArcanaSlot {
  const total = slots.reduce((s, x) => s + Math.max(0, x.weight), 0);
  if (total <= 0) return slots[0]!;
  let r = randomInt(total);
  for (const slot of slots) {
    const w = Math.max(0, slot.weight);
    if (r < w) return slot;
    r -= w;
  }
  return slots[slots.length - 1]!;
}

function normalizePickIds(
  raw: unknown,
  pickMin: number,
  pickMax: number,
): number[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n > 0);
  const unique = [...new Set(ids)];
  if (unique.length < pickMin || unique.length > pickMax) return null;
  return unique;
}

class ArcanaWheelStore {
  private config: ArcanaWheelConfig = defaultConfig();
  private spins: ArcanaSpinEntry[] = [];

  constructor() {
    this.loadConfig();
    this.loadSpins();
  }

  private loadConfig() {
    try {
      if (!existsSync(CONFIG_PATH)) {
        this.config = defaultConfig();
        this.saveConfig();
        console.log("[arcana] Config created v8");
        return;
      }
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as {
        version?: number;
        enabled?: boolean;
        stakeTiers?: number[];
        pickMin?: number;
        pickMax?: number;
        maxStake?: number;
        tutienMaxByRank?: Partial<Record<string, number>>;
        payoutScale?: number;
        streakBonusEnabled?: boolean;
        streakBonusMinStreak?: number;
        streakBonusPercentPerStep?: number;
        streakBonusCapPercent?: number;
        slots?: ArcanaSlot[];
        updatedAt?: number;
        updatedBy?: string;
      };

      if (needsMigration(parsed)) {
        const base = defaultConfig();
        if (typeof parsed.enabled === "boolean") base.enabled = parsed.enabled;
        // Sync slots: keep existing ratio/weight, refresh metadata from Tarot CARDS
        base.slots = syncSlotsWithTarotCards(
          Array.isArray(parsed.slots) ? parsed.slots : undefined,
        );
        if (parsed.tutienMaxByRank) {
          tutienStakeLimitsStore.seedFromLegacy(parsed.tutienMaxByRank);
        }
        if (
          typeof parsed.payoutScale === "number" &&
          parsed.payoutScale > 0 &&
          parsed.payoutScale <= 2
        ) {
          base.payoutScale = parsed.payoutScale;
        }
        if (typeof parsed.streakBonusEnabled === "boolean") {
          base.streakBonusEnabled = parsed.streakBonusEnabled;
        }
        if (typeof parsed.streakBonusMinStreak === "number") {
          base.streakBonusMinStreak = Math.max(
            1,
            Math.floor(parsed.streakBonusMinStreak),
          );
        }
        if (typeof parsed.streakBonusPercentPerStep === "number") {
          base.streakBonusPercentPerStep = Math.max(
            0,
            parsed.streakBonusPercentPerStep,
          );
        }
        if (typeof parsed.streakBonusCapPercent === "number") {
          base.streakBonusCapPercent = Math.max(
            0,
            parsed.streakBonusCapPercent,
          );
        }
        // Merge stakeTiers: public only (≤1M), ensure 1M present — không đẩy tier Tu Tiên vào đây
        if (Array.isArray(parsed.stakeTiers) && parsed.stakeTiers.length > 0) {
          const merged = new Set(
            parsed.stakeTiers
              .map((n) => Math.floor(Number(n)))
              .filter((n) => n > 0 && n <= PUBLIC_MAX_STAKE),
          );
          merged.add(PUBLIC_MAX_STAKE);
          base.stakeTiers = [...merged].sort((a, b) => a - b);
        }
        base.maxStake = PUBLIC_MAX_STAKE;
        base.updatedAt = Date.now();
        base.updatedBy = `migrate-v${CONFIG_VERSION}`;
        this.config = base;
        this.saveConfig();
        console.log(
          `[arcana] Migrated config → v${CONFIG_VERSION} · maxStake=${base.maxStake} · payoutScale=${base.payoutScale} · streakBonus=${base.streakBonusEnabled}`,
        );
        return;
      }

      const payoutScale =
        typeof parsed.payoutScale === "number" &&
        parsed.payoutScale > 0 &&
        parsed.payoutScale <= 2
          ? parsed.payoutScale
          : DEFAULT_PAYOUT_SCALE;

      const {
        tutienMaxByRank: legacyTutienMax,
        ...parsedRest
      } = parsed;
      this.config = {
        ...defaultConfig(),
        ...parsedRest,
        version: CONFIG_VERSION,
        pickMin: PICK_MIN,
        pickMax: PICK_MAX,
        maxStake: PUBLIC_MAX_STAKE,
        payoutScale,
        streakBonusEnabled:
          typeof parsed.streakBonusEnabled === "boolean"
            ? parsed.streakBonusEnabled
            : DEFAULT_STREAK_BONUS.streakBonusEnabled,
        streakBonusMinStreak:
          typeof parsed.streakBonusMinStreak === "number"
            ? Math.max(1, Math.floor(parsed.streakBonusMinStreak))
            : DEFAULT_STREAK_BONUS.streakBonusMinStreak,
        streakBonusPercentPerStep:
          typeof parsed.streakBonusPercentPerStep === "number"
            ? Math.max(0, parsed.streakBonusPercentPerStep)
            : DEFAULT_STREAK_BONUS.streakBonusPercentPerStep,
        streakBonusCapPercent:
          typeof parsed.streakBonusCapPercent === "number"
            ? Math.max(0, parsed.streakBonusCapPercent)
            : DEFAULT_STREAK_BONUS.streakBonusCapPercent,
        slots: syncSlotsWithTarotCards(
          Array.isArray(parsed.slots) && parsed.slots.length === CARDS.length
            ? parsed.slots
            : undefined,
        ),
        stakeTiers:
          Array.isArray(parsed.stakeTiers) && parsed.stakeTiers.length > 0
            ? parsed.stakeTiers
                .map((n) => Math.floor(Number(n)))
                .filter((n) => n > 0 && n <= PUBLIC_MAX_STAKE)
            : defaultConfig().stakeTiers,
      };
      if (legacyTutienMax) {
        tutienStakeLimitsStore.seedFromLegacy(legacyTutienMax);
      }
      console.log(
        `[arcana] Config loaded v${CONFIG_VERSION} · enabled=${this.config.enabled} · maxStake=${this.config.maxStake} · payoutScale=${this.config.payoutScale}`,
      );
    } catch (err) {
      console.warn("[arcana] Failed to load config:", err);
      this.config = defaultConfig();
    }
  }

  private saveConfig() {
    try {
      atomicWrite(CONFIG_PATH, this.config);
    } catch (err) {
      console.warn("[arcana] Failed to save config:", err);
    }
  }

  private loadSpins() {
    try {
      if (!existsSync(SPINS_PATH)) {
        this.saveSpins();
        return;
      }
      const parsed = JSON.parse(readFileSync(SPINS_PATH, "utf8")) as SpinsFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.spins)) return;
      this.spins = parsed.spins.slice(0, SPINS_CAP).map((s) => ({
        ...s,
        pickIds:
          Array.isArray(s.pickIds) && s.pickIds.length
            ? s.pickIds
            : typeof s.pickId === "number"
              ? [s.pickId]
              : [],
      }));
      console.log(`[arcana] Loaded ${this.spins.length} spins`);
    } catch (err) {
      console.warn("[arcana] Failed to load spins:", err);
    }
  }

  private saveSpins() {
    try {
      atomicWrite(SPINS_PATH, {
        version: 1,
        spins: this.spins.slice(0, SPINS_CAP),
      } satisfies SpinsFile);
    } catch (err) {
      console.warn("[arcana] Failed to save spins:", err);
    }
  }

  getConfig(): ArcanaWheelConfig {
    return {
      ...this.config,
      pickMin: this.config.pickMin ?? PICK_MIN,
      pickMax: this.config.pickMax ?? PICK_MAX,
      maxStake: PUBLIC_MAX_STAKE,
      tutienMaxByRank: tutienStakeLimitsStore.getMap(),
      payoutScale: this.config.payoutScale ?? DEFAULT_PAYOUT_SCALE,
      streakBonusEnabled:
        this.config.streakBonusEnabled ?? DEFAULT_STREAK_BONUS.streakBonusEnabled,
      streakBonusMinStreak:
        this.config.streakBonusMinStreak ??
        DEFAULT_STREAK_BONUS.streakBonusMinStreak,
      streakBonusPercentPerStep:
        this.config.streakBonusPercentPerStep ??
        DEFAULT_STREAK_BONUS.streakBonusPercentPerStep,
      streakBonusCapPercent:
        this.config.streakBonusCapPercent ??
        DEFAULT_STREAK_BONUS.streakBonusCapPercent,
      slots: this.config.slots.map((s) => ({ ...s })),
      stakeTiers: [...this.config.stakeTiers],
    };
  }

  private streakBonusConfig(): StreakBonusConfig {
    const c = this.getConfig();
    return {
      streakBonusEnabled: c.streakBonusEnabled,
      streakBonusMinStreak: c.streakBonusMinStreak,
      streakBonusPercentPerStep: c.streakBonusPercentPerStep,
      streakBonusCapPercent: c.streakBonusCapPercent,
    };
  }

  private streakRtpOptions(): StreakRtpOptions {
    const c = this.streakBonusConfig();
    return {
      enabled: c.streakBonusEnabled,
      minStreak: c.streakBonusMinStreak,
      percentPerStep: c.streakBonusPercentPerStep,
      capPercent: c.streakBonusCapPercent,
    };
  }

  private slotWeightShares(slots: ArcanaSlot[]): Map<number, number> {
    const W = slots.reduce((s, x) => s + Math.max(0, x.weight), 0);
    const m = new Map<number, number>();
    for (const s of slots) {
      const w = Math.max(0, s.weight);
      m.set(s.id, W > 0 ? Math.round((w / W) * 1000) / 10 : 0);
    }
    return m;
  }

  getPublicState(userId?: string) {
    const cfg = this.getConfig();
    const shares = this.slotWeightShares(cfg.slots);
    const streakCfg = this.streakBonusConfig();
    const luckStreak = userId ? arcanaStreakStore.get(userId) : 0;
    const nextWinBonusPercent = previewNextWinBonusPercent(
      luckStreak,
      streakCfg,
    );
    const user = userId ? authStore.getById(userId) : null;
    const tutienMap = tutienStakeLimitsStore.getMap();
    const effectiveTiers = effectiveStakeTiersForUser(
      user ?? undefined,
      cfg.stakeTiers,
      tutienMap,
    );
    const tutienCap = user ? personalTutienMax(user, tutienMap) : null;
    return {
      enabled: cfg.enabled,
      stakeTiers: effectiveTiers,
      publicStakeTiers: cfg.stakeTiers.filter((t) => t <= PUBLIC_MAX_STAKE),
      pickMin: cfg.pickMin,
      pickMax: cfg.pickMax,
      maxStake: tutienCap ?? cfg.maxStake,
      tutienMaxStake: tutienCap ?? undefined,
      payoutScale: cfg.payoutScale,
      luckStreak,
      streakBonus: {
        enabled: streakCfg.streakBonusEnabled,
        minStreak: streakCfg.streakBonusMinStreak,
        percentPerStep: streakCfg.streakBonusPercentPerStep,
        capPercent: streakCfg.streakBonusCapPercent,
        nextWinBonusPercent,
      },
      slots: cfg.slots.map(({ id, key, name, nameVi, ratio, image }) => ({
        id,
        key,
        name,
        nameVi,
        ratio,
        image,
        weightShare: shares.get(id) ?? 0,
      })),
      recent: this.spins.slice(0, RECENT_PUBLIC).map((s) => ({
        id: s.id,
        at: s.at,
        winId: s.winId,
        pickId: s.pickId,
        pickIds: s.pickIds ?? [s.pickId],
        won: s.won,
        stake: s.stake,
        payout: s.payout,
        profit: s.profit,
        outerNumber: s.outerNumber,
        outerPick: s.outerPick,
        outerWon: s.outerWon,
      })),
      mission: userId ? arcanaMissionStore.getProgress(userId) : undefined,
    };
  }

  getRtpPreview(): RtpPickRow[] {
    const cfg = this.getConfig();
    return computeRtpPreview(
      cfg.slots,
      cfg.pickMin ?? PICK_MIN,
      cfg.pickMax ?? PICK_MAX,
      cfg.payoutScale ?? DEFAULT_PAYOUT_SCALE,
      this.streakRtpOptions(),
    );
  }

  getStats() {
    const vault = vaultArcana.getSnapshot();
    const wins = this.spins.filter((s) => s.won).length;
    return {
      spinCount: this.spins.length,
      winCount: wins,
      loseCount: this.spins.length - wins,
      winRate: this.spins.length
        ? Math.round((wins / this.spins.length) * 1000) / 10
        : 0,
      vaultBalance: vault.balance,
      vaultStakeIn: vault.totalStakeIn,
      vaultPayoutOut: vault.totalPayoutOut,
      vaultNetHouse: vault.netHouse,
      houseEdgeXu: vault.totalStakeIn - vault.totalPayoutOut,
      enabled: this.config.enabled,
    };
  }

  listSpins(limit = 100, userId?: string): ArcanaSpinEntry[] {
    const n = Math.min(500, Math.max(1, Math.floor(limit)));
    const list = userId
      ? this.spins.filter((s) => s.userId === userId)
      : this.spins;
    return list.slice(0, n);
  }

  updateConfig(
    patch: {
      enabled?: boolean;
      stakeTiers?: number[];
      tutienMaxByRank?: Partial<Record<string, number>>;
      payoutScale?: number;
      streakBonusEnabled?: boolean;
      streakBonusMinStreak?: number;
      streakBonusPercentPerStep?: number;
      streakBonusCapPercent?: number;
      slots?: Array<Partial<ArcanaSlot> & { id: number }>;
    },
    byUsername: string,
  ): { ok: true; config: ArcanaWheelConfig } | { ok: false; reason: string } {
    if (typeof patch.enabled === "boolean") {
      this.config.enabled = patch.enabled;
    }
    if (typeof patch.payoutScale === "number") {
      const s = patch.payoutScale;
      if (!Number.isFinite(s) || s < 0.01 || s > 2) {
        return { ok: false, reason: "payoutScale phải từ 0.01 đến 2" };
      }
      this.config.payoutScale = Math.round(s * 1000) / 1000;
    }
    if (typeof patch.streakBonusEnabled === "boolean") {
      this.config.streakBonusEnabled = patch.streakBonusEnabled;
    }
    if (typeof patch.streakBonusMinStreak === "number") {
      const n = Math.floor(patch.streakBonusMinStreak);
      if (!Number.isFinite(n) || n < 1) {
        return { ok: false, reason: "streakBonusMinStreak phải >= 1" };
      }
      this.config.streakBonusMinStreak = n;
    }
    if (typeof patch.streakBonusPercentPerStep === "number") {
      const n = patch.streakBonusPercentPerStep;
      if (!Number.isFinite(n) || n < 0 || n > 50) {
        return { ok: false, reason: "streakBonusPercentPerStep 0–50" };
      }
      this.config.streakBonusPercentPerStep = n;
    }
    if (typeof patch.streakBonusCapPercent === "number") {
      const n = patch.streakBonusCapPercent;
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { ok: false, reason: "streakBonusCapPercent 0–100" };
      }
      this.config.streakBonusCapPercent = n;
    }
    if (Array.isArray(patch.stakeTiers)) {
      const tiers = patch.stakeTiers
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= PUBLIC_MAX_STAKE);
      if (tiers.length === 0) {
        return {
          ok: false,
          reason: "stakeTiers công khai không hợp lệ (mỗi mức ≤ 1M)",
        };
      }
      if (!tiers.includes(PUBLIC_MAX_STAKE)) tiers.push(PUBLIC_MAX_STAKE);
      this.config.stakeTiers = [...new Set(tiers)].sort((a, b) => a - b);
    }
    if (patch.tutienMaxByRank && typeof patch.tutienMaxByRank === "object") {
      const r = tutienStakeLimitsStore.setMap(patch.tutienMaxByRank);
      if (!r.ok) return r;
    }
    if (Array.isArray(patch.slots)) {
      const next = this.config.slots.map((s) => ({ ...s }));
      for (const p of patch.slots) {
        const idx = next.findIndex((s) => s.id === p.id);
        if (idx < 0) continue;
        const cur = next[idx]!;
        if (typeof p.ratio === "number" && p.ratio >= 1) {
          cur.ratio = Math.floor(p.ratio);
        }
        if (typeof p.weight === "number" && p.weight >= 0) {
          cur.weight = Math.floor(p.weight);
        }
        if (typeof p.nameVi === "string" && p.nameVi.trim()) {
          cur.nameVi = p.nameVi.trim();
        }
        next[idx] = cur;
      }
      this.config.slots = next;
    }
    this.config.maxStake = PUBLIC_MAX_STAKE;
    this.config.version = CONFIG_VERSION;
    this.config.updatedAt = Date.now();
    this.config.updatedBy = byUsername;
    this.saveConfig();
    return { ok: true, config: this.getConfig() };
  }

  spin(input: {
    userId: string;
    stake: number;
    pickIds?: unknown;
    /** @deprecated dùng pickIds */
    pickId?: unknown;
    useBonusSpin?: boolean;
    outerPick?: unknown;
  }):
    | {
        ok: true;
        spin: ArcanaSpinEntry;
        balance: number;
        slot: ArcanaSlot;
        luckStreak: number;
        streakBonus: ReturnType<ArcanaWheelStore["getPublicState"]>["streakBonus"];
      }
    | { ok: false; reason: string } {
    if (!this.config.enabled) {
      return { ok: false, reason: "Bàn Bánh xe Arcana đang tạm khóa" };
    }
    const stake = Math.floor(Number(input.stake));
    const useBonus = !!input.useBonusSpin;
    const outerPick = parseOuterPick(input.outerPick);
    if (useBonus) {
      if (!arcanaMissionStore.consumeBonusSpin(input.userId)) {
        return { ok: false, reason: "Không còn lượt quay thưởng nhiệm vụ" };
      }
    }

    const userEarly = authStore.getById(input.userId);
    if (!userEarly) return { ok: false, reason: "User không tồn tại" };
    if (userEarly.banned) return { ok: false, reason: "Tài khoản bị khóa" };

    const tutienMap = tutienStakeLimitsStore.getMap();
    if (
      !useBonus &&
      (!Number.isFinite(stake) ||
        stake <= 0 ||
        !isStakeAllowedForUser(
          stake,
          userEarly,
          this.config.stakeTiers,
          tutienMap,
        ))
    ) {
      return {
        ok: false,
        reason:
          stake > PUBLIC_MAX_STAKE
            ? "Mức >1M chỉ dành cho role Tu Tiên đủ cảnh giới"
            : "Mức xu không hợp lệ",
      };
    }
    const effectiveStake = useBonus ? MISSION_BONUS_STAKE : stake;

    const pickMin = this.config.pickMin ?? PICK_MIN;
    const pickMax = this.config.pickMax ?? PICK_MAX;
    let pickIds = normalizePickIds(input.pickIds, pickMin, pickMax);
    if (!pickIds && input.pickId != null) {
      pickIds = normalizePickIds([input.pickId], pickMin, pickMax);
    }
    if (!pickIds) {
      return {
        ok: false,
        reason: `Chọn từ ${pickMin} đến ${pickMax} nhân vật khác nhau`,
      };
    }
    for (const id of pickIds) {
      if (!this.config.slots.some((s) => s.id === id)) {
        return { ok: false, reason: "Nhân vật chọn không hợp lệ" };
      }
    }

    const user = userEarly;

    if (!useBonus && user.balance < effectiveStake) {
      return { ok: false, reason: "Không đủ xu" };
    }

    let balanceAfter = user.balance;
    if (!useBonus) {
      const debit = authStore.adjustBalance(input.userId, -effectiveStake);
      if (!debit.ok) {
        return { ok: false, reason: debit.reason || "Không trừ được xu" };
      }
      balanceAfter = debit.user.balance;
      vaultArcana.recordStakeIn(
        effectiveStake,
        debit.user.username,
        debit.user.id,
      );
    }

    const streakBefore = arcanaStreakStore.get(input.userId);
    const streakCfg = this.streakBonusConfig();

    const seed = randomBytes(8).toString("hex");
    const payoutScale = this.config.payoutScale ?? DEFAULT_PAYOUT_SCALE;

    /** 50/50 when outer even-money selected; else 100% Arcana */
    let outerStake = 0;
    let arcanaStake = effectiveStake;
    if (outerPick && !useBonus) {
      outerStake = Math.floor(effectiveStake / 2);
      arcanaStake = effectiveStake - outerStake;
    } else if (outerPick && useBonus) {
      /** Bonus spin: no outer stake (even-money ignored for payout) */
      outerStake = 0;
      arcanaStake = effectiveStake;
    }

    const outerNumber = rollEuropeanNumber((max) => randomInt(max));
    const outerWon =
      !!outerPick && outerStake > 0 && checkEvenMoney(outerPick, outerNumber);
    const outerPayout = outerWon ? outerStake * 2 : 0;

    const winSlot = pickWeighted(this.config.slots);
    const won = pickIds.includes(winSlot.id);

    let wheelDisplayWinId = winSlot.id;
    let nearMiss = false;
    if (!won && Math.random() < 0.38) {
      const candidates = this.config.slots.filter(
        (s) => s.ratio >= 20 && !pickIds.includes(s.id),
      );
      if (candidates.length > 0) {
        wheelDisplayWinId = pickWeighted(candidates).id;
        nearMiss = wheelDisplayWinId !== winSlot.id;
      }
    }

    const payoutBase = won
      ? computeArcanaPayout(
          arcanaStake,
          winSlot.ratio,
          pickIds.length,
          payoutScale,
        )
      : 0;
    const streakBonusPercent = won
      ? computeStreakBonusPercent(streakBefore, streakCfg, true)
      : 0;
    const arcanaPayout =
      won && streakBonusPercent > 0
        ? applyStreakBonusToPayout(payoutBase, streakBonusPercent)
        : payoutBase;
    const payout = outerPayout + arcanaPayout;
    const profit = payout - (useBonus ? 0 : effectiveStake);

    if (payout > 0) {
      const credit = authStore.adjustBalance(input.userId, payout);
      if (credit.ok) {
        balanceAfter = credit.user.balance;
        vaultArcana.recordPayoutOut(
          payout,
          credit.user.username,
          credit.user.id,
        );
      } else if (!useBonus) {
        const refund = authStore.adjustBalance(input.userId, effectiveStake);
        if (refund.ok) {
          balanceAfter = refund.user.balance;
          vaultArcana.recordStakeRefund(
            effectiveStake,
            refund.user.username,
            refund.user.id,
          );
        }
        return {
          ok: false,
          reason: "Không trả xu được — đã hoàn xu",
        };
      } else {
        return { ok: false, reason: "Không trả xu được" };
      }
    }

    const { streakAfter } = arcanaStreakStore.recordSpin(input.userId, won);
    let missionCompleted = false;
    if (!useBonus) {
      missionCompleted = arcanaMissionStore.recordPaidSpin(
        input.userId,
        effectiveStake,
      );
    }

    const entry: ArcanaSpinEntry = {
      id: randomBytes(6).toString("hex"),
      at: Date.now(),
      userId: user.id,
      username: user.username,
      stake: effectiveStake,
      pickId: pickIds[0]!,
      pickIds,
      winId: winSlot.id,
      ratio: winSlot.ratio,
      won,
      payout,
      payoutBase: won ? payoutBase : undefined,
      streakBonusPercent: won ? streakBonusPercent : undefined,
      streakBefore,
      streakAfter,
      nearMiss: nearMiss || undefined,
      wheelDisplayWinId:
        wheelDisplayWinId !== winSlot.id ? wheelDisplayWinId : undefined,
      missionCompleted: missionCompleted || undefined,
      usedBonusSpin: useBonus || undefined,
      outerNumber,
      outerPick: outerPick ?? undefined,
      outerWon: outerPick ? outerWon : undefined,
      outerPayout: outerPick ? outerPayout : undefined,
      arcanaPayout,
      arcanaStake,
      outerStake: outerPick ? outerStake : undefined,
      profit,
      seed,
      balanceAfter,
    };
    this.spins.unshift(entry);
    if (this.spins.length > SPINS_CAP) this.spins.length = SPINS_CAP;
    this.saveSpins();

    return {
      ok: true,
      spin: entry,
      balance: balanceAfter,
      slot: { ...winSlot },
      luckStreak: streakAfter,
      streakBonus: {
        ...this.getPublicState(input.userId).streakBonus,
      },
    };
  }
}

export const arcanaWheelStore = new ArcanaWheelStore();
export {
  PICK_MIN,
  PICK_MAX,
  PUBLIC_MAX_STAKE as MAX_STAKE,
  PUBLIC_MAX_STAKE,
  DEFAULT_PAYOUT_SCALE,
};
export type { RtpPickRow };
