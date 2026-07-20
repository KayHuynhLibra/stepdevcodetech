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
} from "./arcanaRtp.js";
import { vaultArcana } from "./vaultStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const CONFIG_PATH = join(DATA_DIR, "arcana-wheel.json");
const SPINS_PATH = join(DATA_DIR, "arcana-spins.json");
const SPINS_CAP = 2000;
const RECENT_PUBLIC = 24;
const CONFIG_VERSION = 4 as const;
const PICK_MIN = 1;
const PICK_MAX = 8;
const MAX_STAKE = 100_000;
const DEFAULT_BET_TIERS = [300, 800, 1500, 3000, 10_000, 30_000, 100_000];

export interface ArcanaSlot {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  /** Hệ số trả thưởng (1:N → N) */
  ratio: number;
  /** Weight RNG */
  weight: number;
  image: string;
}

export interface ArcanaWheelConfig {
  version: typeof CONFIG_VERSION;
  enabled: boolean;
  betTiers: number[];
  pickMin: number;
  pickMax: number;
  maxStake: number;
  /** Hệ số thưởng (0.01–2), nhân sau khi chia số ô chọn */
  payoutScale: number;
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
  won: boolean;
  payout: number;
  profit: number;
  seed: string;
  balanceAfter: number;
}

interface SpinsFile {
  version: 1;
  spins: ArcanaSpinEntry[];
}

const DEFAULT_SLOTS: ArcanaSlot[] = [
  {
    id: 1,
    key: "lucent",
    name: "Lucent",
    nameVi: "Pháp Sư Lucent",
    ratio: 8,
    weight: 20,
    image: "/assets/arcana-chars/char-01-lucent.png",
  },
  {
    id: 2,
    key: "veil",
    name: "Veil",
    nameVi: "Nữ Tư Vân",
    ratio: 8,
    weight: 20,
    image: "/assets/arcana-chars/char-02-veil.png",
  },
  {
    id: 3,
    key: "aurelia",
    name: "Aurelia",
    nameVi: "Nữ Đế Aurelia",
    ratio: 12,
    weight: 14,
    image: "/assets/arcana-chars/char-03-aurelia.png",
  },
  {
    id: 4,
    key: "kael",
    name: "Kael",
    nameVi: "Hoàng Đế Kael",
    ratio: 12,
    weight: 14,
    image: "/assets/arcana-chars/char-04-kael.png",
  },
  {
    id: 5,
    key: "twinflame",
    name: "Twinflame",
    nameVi: "Song Hồn",
    ratio: 20,
    weight: 10,
    image: "/assets/arcana-chars/char-05-twinflame.png",
  },
  {
    id: 6,
    key: "vanguard",
    name: "Vanguard",
    nameVi: "Kỵ Sĩ Vanguard",
    ratio: 35,
    weight: 8,
    image: "/assets/arcana-chars/char-06-vanguard.png",
  },
  {
    id: 7,
    key: "astraea",
    name: "Astraea",
    nameVi: "Tinh Nữ Astraea",
    ratio: 60,
    weight: 5,
    image: "/assets/arcana-chars/char-07-astraea.png",
  },
  {
    id: 8,
    key: "solara",
    name: "Solara",
    nameVi: "Nhật Thần Solara",
    ratio: 100,
    weight: 3,
    image: "/assets/arcana-chars/char-08-solara.png",
  },
];

function defaultConfig(): ArcanaWheelConfig {
  return {
    version: CONFIG_VERSION,
    enabled: true,
    betTiers: [...DEFAULT_BET_TIERS],
    pickMin: PICK_MIN,
    pickMax: PICK_MAX,
    maxStake: MAX_STAKE,
    payoutScale: DEFAULT_PAYOUT_SCALE,
    slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
    updatedAt: Date.now(),
  };
}

function needsMigration(parsed: {
  version?: number;
  slots?: ArcanaSlot[];
  betTiers?: number[];
  maxStake?: number;
  payoutScale?: number;
}): boolean {
  if (parsed.version !== CONFIG_VERSION) return true;
  if (!Array.isArray(parsed.slots) || parsed.slots.length !== 8) return true;
  if (parsed.slots.some((s) => typeof s.image === "string" && s.image.includes("/assets/cards/"))) {
    return true;
  }
  if (typeof parsed.maxStake !== "number" || parsed.maxStake < MAX_STAKE) {
    return true;
  }
  const tiers = parsed.betTiers ?? [];
  if (!tiers.includes(MAX_STAKE)) return true;
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
        console.log("[arcana] Config created v4");
        return;
      }
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as {
        version?: number;
        enabled?: boolean;
        betTiers?: number[];
        pickMin?: number;
        pickMax?: number;
        maxStake?: number;
        payoutScale?: number;
        slots?: ArcanaSlot[];
        updatedAt?: number;
        updatedBy?: string;
      };

      if (needsMigration(parsed)) {
        const base = defaultConfig();
        if (typeof parsed.enabled === "boolean") base.enabled = parsed.enabled;
        // Keep character slots if already v2 art; else defaults
        if (
          Array.isArray(parsed.slots) &&
          parsed.slots.length === 8 &&
          !parsed.slots.some(
            (s) =>
              typeof s.image === "string" && s.image.includes("/assets/cards/"),
          )
        ) {
          base.slots = parsed.slots.map((s) => ({ ...s }));
        }
        if (
          typeof parsed.payoutScale === "number" &&
          parsed.payoutScale > 0 &&
          parsed.payoutScale <= 2
        ) {
          base.payoutScale = parsed.payoutScale;
        }
        base.updatedAt = Date.now();
        base.updatedBy = parsed.version === 3 ? "migrate-v4" : "migrate-v4";
        this.config = base;
        this.saveConfig();
        console.log(
          `[arcana] Migrated config → v4 · payoutScale=${base.payoutScale} · tiers=${base.betTiers.join(",")}`,
        );
        return;
      }

      const payoutScale =
        typeof parsed.payoutScale === "number" &&
        parsed.payoutScale > 0 &&
        parsed.payoutScale <= 2
          ? parsed.payoutScale
          : DEFAULT_PAYOUT_SCALE;

      this.config = {
        ...defaultConfig(),
        ...parsed,
        version: CONFIG_VERSION,
        pickMin: PICK_MIN,
        pickMax: PICK_MAX,
        maxStake: Math.max(MAX_STAKE, Math.floor(Number(parsed.maxStake) || MAX_STAKE)),
        payoutScale,
        slots:
          Array.isArray(parsed.slots) && parsed.slots.length === 8
            ? parsed.slots
            : defaultConfig().slots,
        betTiers:
          Array.isArray(parsed.betTiers) && parsed.betTiers.length > 0
            ? parsed.betTiers
                .map((n) => Math.floor(Number(n)))
                .filter((n) => n > 0 && n <= MAX_STAKE)
            : defaultConfig().betTiers,
      };
      console.log(
        `[arcana] Config loaded v4 · enabled=${this.config.enabled} · payoutScale=${this.config.payoutScale}`,
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
      maxStake: this.config.maxStake ?? MAX_STAKE,
      payoutScale: this.config.payoutScale ?? DEFAULT_PAYOUT_SCALE,
      slots: this.config.slots.map((s) => ({ ...s })),
      betTiers: [...this.config.betTiers],
    };
  }

  getPublicState() {
    const cfg = this.getConfig();
    return {
      enabled: cfg.enabled,
      betTiers: cfg.betTiers,
      pickMin: cfg.pickMin,
      pickMax: cfg.pickMax,
      maxStake: cfg.maxStake,
      payoutScale: cfg.payoutScale,
      slots: cfg.slots.map(({ id, key, name, nameVi, ratio, image }) => ({
        id,
        key,
        name,
        nameVi,
        ratio,
        image,
      })),
      recent: this.spins.slice(0, RECENT_PUBLIC).map((s) => ({
        id: s.id,
        at: s.at,
        winId: s.winId,
        pickId: s.pickId,
        pickIds: s.pickIds ?? [s.pickId],
        won: s.won,
      })),
    };
  }

  getRtpPreview(): RtpPickRow[] {
    const cfg = this.getConfig();
    return computeRtpPreview(
      cfg.slots,
      cfg.pickMin ?? PICK_MIN,
      cfg.pickMax ?? PICK_MAX,
      cfg.payoutScale ?? DEFAULT_PAYOUT_SCALE,
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
      betTiers?: number[];
      payoutScale?: number;
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
    if (Array.isArray(patch.betTiers)) {
      const tiers = patch.betTiers
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (tiers.length === 0) {
        return { ok: false, reason: "betTiers không hợp lệ" };
      }
      this.config.betTiers = tiers;
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
  }):
    | {
        ok: true;
        spin: ArcanaSpinEntry;
        balance: number;
        slot: ArcanaSlot;
      }
    | { ok: false; reason: string } {
    if (!this.config.enabled) {
      return { ok: false, reason: "Bàn Bánh xe Arcana đang tạm khóa" };
    }
    const stake = Math.floor(Number(input.stake));
    const maxStake = this.config.maxStake ?? MAX_STAKE;
    if (
      !Number.isFinite(stake) ||
      stake <= 0 ||
      stake > maxStake ||
      !this.config.betTiers.includes(stake)
    ) {
      return { ok: false, reason: "Mức cược không hợp lệ" };
    }

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

    const user = authStore.getById(input.userId);
    if (!user) return { ok: false, reason: "User không tồn tại" };
    if (user.banned) return { ok: false, reason: "Tài khoản bị khóa" };
    if (user.balance < stake) return { ok: false, reason: "Không đủ xu" };

    const debit = authStore.adjustBalance(input.userId, -stake);
    if (!debit.ok) {
      return { ok: false, reason: debit.reason || "Không trừ được xu" };
    }

    vaultArcana.recordStakeIn(stake, debit.user.username, debit.user.id);

    const seed = randomBytes(8).toString("hex");
    const payoutScale = this.config.payoutScale ?? DEFAULT_PAYOUT_SCALE;
    const winSlot = pickWeighted(this.config.slots);
    const won = pickIds.includes(winSlot.id);
    const payout = won
      ? computeArcanaPayout(
          stake,
          winSlot.ratio,
          pickIds.length,
          payoutScale,
        )
      : 0;
    const profit = payout - stake;

    let balanceAfter = debit.user.balance;
    if (payout > 0) {
      const credit = authStore.adjustBalance(input.userId, payout);
      if (credit.ok) {
        balanceAfter = credit.user.balance;
        vaultArcana.recordPayoutOut(
          payout,
          credit.user.username,
          credit.user.id,
        );
      } else {
        const refund = authStore.adjustBalance(input.userId, stake);
        if (refund.ok) {
          balanceAfter = refund.user.balance;
          vaultArcana.recordStakeRefund(
            stake,
            refund.user.username,
            refund.user.id,
          );
        }
        return {
          ok: false,
          reason: "Không trả thưởng được — đã hoàn cược",
        };
      }
    }

    const entry: ArcanaSpinEntry = {
      id: randomBytes(6).toString("hex"),
      at: Date.now(),
      userId: debit.user.id,
      username: debit.user.username,
      stake,
      pickId: pickIds[0]!,
      pickIds,
      winId: winSlot.id,
      ratio: winSlot.ratio,
      won,
      payout,
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
    };
  }
}

export const arcanaWheelStore = new ArcanaWheelStore();
export { PICK_MIN, PICK_MAX, MAX_STAKE, DEFAULT_PAYOUT_SCALE };
export type { RtpPickRow };
