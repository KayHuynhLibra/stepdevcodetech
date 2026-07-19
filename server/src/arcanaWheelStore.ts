import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes, randomInt } from "crypto";
import { authStore } from "./auth.js";
import { vaultArcana } from "./vaultStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const CONFIG_PATH = join(DATA_DIR, "arcana-wheel.json");
const SPINS_PATH = join(DATA_DIR, "arcana-spins.json");
const SPINS_CAP = 2000;
const RECENT_PUBLIC = 24;
const CONFIG_VERSION = 2 as const;
const PICK_COUNT = 3;

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
    betTiers: [300, 800, 1500, 3000],
    slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
    updatedAt: Date.now(),
  };
}

function needsMigration(parsed: {
  version?: number;
  slots?: ArcanaSlot[];
}): boolean {
  if (parsed.version !== CONFIG_VERSION) return true;
  if (!Array.isArray(parsed.slots) || parsed.slots.length !== 8) return true;
  return parsed.slots.some(
    (s) =>
      typeof s.image === "string" && s.image.includes("/assets/cards/"),
  );
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

function normalizePickIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n > 0);
  const unique = [...new Set(ids)];
  if (unique.length !== PICK_COUNT) return null;
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
        console.log("[arcana] Config created v2");
        return;
      }
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as {
        version?: number;
        enabled?: boolean;
        betTiers?: number[];
        slots?: ArcanaSlot[];
        updatedAt?: number;
        updatedBy?: string;
      };

      if (needsMigration(parsed)) {
        const base = defaultConfig();
        if (typeof parsed.enabled === "boolean") base.enabled = parsed.enabled;
        if (Array.isArray(parsed.betTiers) && parsed.betTiers.length > 0) {
          const tiers = parsed.betTiers
            .map((n) => Math.floor(Number(n)))
            .filter((n) => Number.isFinite(n) && n > 0);
          if (tiers.length) base.betTiers = tiers;
        }
        base.updatedAt = Date.now();
        base.updatedBy = "migrate-v2";
        this.config = base;
        this.saveConfig();
        console.log("[arcana] Migrated config → v2 (new chars + ratios)");
        return;
      }

      this.config = {
        ...defaultConfig(),
        ...parsed,
        version: CONFIG_VERSION,
        slots:
          Array.isArray(parsed.slots) && parsed.slots.length === 8
            ? parsed.slots
            : defaultConfig().slots,
        betTiers:
          Array.isArray(parsed.betTiers) && parsed.betTiers.length > 0
            ? parsed.betTiers
                .map((n) => Math.floor(Number(n)))
                .filter((n) => n > 0)
            : defaultConfig().betTiers,
      };
      console.log(
        `[arcana] Config loaded v2 · enabled=${this.config.enabled} · tiers=${this.config.betTiers.join(",")}`,
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
      slots: this.config.slots.map((s) => ({ ...s })),
      betTiers: [...this.config.betTiers],
    };
  }

  getPublicState() {
    const cfg = this.getConfig();
    return {
      enabled: cfg.enabled,
      betTiers: cfg.betTiers,
      pickCount: PICK_COUNT,
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
      slots?: Array<Partial<ArcanaSlot> & { id: number }>;
    },
    byUsername: string,
  ): { ok: true; config: ArcanaWheelConfig } | { ok: false; reason: string } {
    if (typeof patch.enabled === "boolean") {
      this.config.enabled = patch.enabled;
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
    if (!this.config.betTiers.includes(stake)) {
      return { ok: false, reason: "Mức cược không hợp lệ" };
    }

    let pickIds = normalizePickIds(input.pickIds);
    if (!pickIds && input.pickId != null) {
      // Không chấp nhận 1 pick nữa — bắt buộc 3
      return { ok: false, reason: "Phải chọn đúng 3 nhân vật" };
    }
    if (!pickIds) {
      return { ok: false, reason: "Phải chọn đúng 3 nhân vật khác nhau" };
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
    const winSlot = pickWeighted(this.config.slots);
    const won = pickIds.includes(winSlot.id);
    const payout = won ? stake * winSlot.ratio : 0;
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
export { PICK_COUNT };
