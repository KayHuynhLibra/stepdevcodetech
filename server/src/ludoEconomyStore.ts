/**
 * Editable Ludo economy — stake presets, bot win mult, shop prices.
 * Persists server/data/ludo-economy.json (Railway volume).
 * Stake presets prefer unified xuLevelsStore when set.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { xuLevelsStore } from "./xuLevelsStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "ludo-economy.json");
const TMP = join(DATA_DIR, "ludo-economy.json.tmp");

export type LudoEconomySnap = {
  version: 1;
  stakePresets: number[];
  botWinMult: number;
  /** itemId → priceXu override (missing = catalog default) */
  catalogPrices: Record<string, number>;
  updatedAt: number;
};

const DEFAULT_STAKES = [0, 500, 1000, 5000];
const DEFAULT_BOT_MULT = 2;

function atomicWrite(data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, PATH);
}

function clampStake(n: unknown): number | null {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.min(v, 1_000_000);
}

class LudoEconomyStore {
  private snap: LudoEconomySnap = {
    version: 1,
    stakePresets: [...DEFAULT_STAKES],
    botWinMult: DEFAULT_BOT_MULT,
    catalogPrices: {},
    updatedAt: 0,
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as Partial<LudoEconomySnap>;
      this.snap = this.normalize(raw);
    } catch {
      /* ignore */
    }
  }

  private save() {
    try {
      this.snap.updatedAt = Date.now();
      atomicWrite(this.snap);
    } catch {
      /* ignore */
    }
  }

  private normalize(raw: Partial<LudoEconomySnap> | null | undefined): LudoEconomySnap {
    const stakesRaw = Array.isArray(raw?.stakePresets) ? raw!.stakePresets : DEFAULT_STAKES;
    const stakes = [
      ...new Set(
        stakesRaw
          .map(clampStake)
          .filter((n): n is number => n != null),
      ),
    ].sort((a, b) => a - b);
    if (!stakes.includes(0)) stakes.unshift(0);
    const mult = Math.min(
      10,
      Math.max(1, Math.round(Number(raw?.botWinMult) || DEFAULT_BOT_MULT)),
    );
    const prices: Record<string, number> = {};
    if (raw?.catalogPrices && typeof raw.catalogPrices === "object") {
      for (const [k, v] of Object.entries(raw.catalogPrices)) {
        const p = clampStake(v);
        if (p != null && k.trim()) prices[k.trim()] = p;
      }
    }
    return {
      version: 1,
      stakePresets: stakes.length ? stakes : [...DEFAULT_STAKES],
      botWinMult: mult,
      catalogPrices: prices,
      updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : 0,
    };
  }

  get(): LudoEconomySnap {
    return {
      ...this.snap,
      stakePresets: [...this.snap.stakePresets],
      catalogPrices: { ...this.snap.catalogPrices },
    };
  }

  stakePresets(): number[] {
    const list = xuLevelsStore.forGame("ludo");
    if (list.length) return list;
    return [...this.snap.stakePresets];
  }

  botWinMult(): number {
    return this.snap.botWinMult;
  }

  priceFor(itemId: string, catalogDefault: number): number {
    if (Object.prototype.hasOwnProperty.call(this.snap.catalogPrices, itemId)) {
      return this.snap.catalogPrices[itemId]!;
    }
    return catalogDefault;
  }

  patch(body: {
    stakePresets?: unknown;
    botWinMult?: unknown;
    catalogPrices?: unknown;
  }): LudoEconomySnap {
    const next: Partial<LudoEconomySnap> = { ...this.snap };
    if (body.stakePresets !== undefined) {
      next.stakePresets = Array.isArray(body.stakePresets)
        ? (body.stakePresets as number[])
        : this.snap.stakePresets;
    }
    if (body.botWinMult !== undefined) {
      next.botWinMult = Number(body.botWinMult);
    }
    if (body.catalogPrices !== undefined && typeof body.catalogPrices === "object") {
      next.catalogPrices = {
        ...this.snap.catalogPrices,
        ...(body.catalogPrices as Record<string, number>),
      };
    }
    this.snap = this.normalize(next);
    this.save();
    if (body.stakePresets !== undefined) {
      xuLevelsStore.patch({
        byGame: { ludo: this.snap.stakePresets },
      });
    }
    return this.get();
  }
}

export const ludoEconomyStore = new LudoEconomyStore();
