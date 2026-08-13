/**
 * Editable Olympus paytable (% of bet) + bet steps for mainadmin ZEUS%.
 * Persists be/data/olympus-economy.json (Railway volume).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { xuLevelsStore } from "./xuLevelsStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "olympus-economy.json");
const TMP = join(DATA_DIR, "olympus-economy.json.tmp");

/** Paying gems — bolt/zeus không trả theo bảng này */
export const OLY_PAY_SYMBOLS = [
  "ruby",
  "sapphire",
  "emerald",
  "amethyst",
  "topaz",
  "pearl",
  "crown",
] as const;

export type OlyPaySymbol = (typeof OLY_PAY_SYMBOLS)[number];

export type OlympusEconomySnap = {
  version: 1;
  /** Multiplier of bet at scatter tier 1 (≥8); ≥10 ×tier10, ≥12 ×tier12 */
  pay: Record<OlyPaySymbol, number>;
  bets: number[];
  buyBonusMult: number;
  /** Cascade combo count that triggers lightning */
  comboLightningAt: number;
  /** Rage meter threshold for lightning */
  rageLightningAt: number;
  /** Default pay mode when client omits */
  payModeDefault: "scatter" | "cluster";
  /** Scatter tier multipliers */
  tier10Mult: number;
  tier12Mult: number;
  /** Jackpot: fraction of bet fed each paid spin */
  jackpotFeedRate: number;
  jackpotFloor: number;
  fsAward: number;
  fsRetrigger: number;
  holdTriggerCrowns: number;
  updatedAt: number;
};

export const DEFAULT_OLY_PAY: Record<OlyPaySymbol, number> = {
  ruby: 0.25,
  sapphire: 0.3,
  emerald: 0.35,
  amethyst: 0.4,
  topaz: 0.5,
  pearl: 0.8,
  crown: 1.2,
};

export const DEFAULT_OLY_BETS = [20, 50, 100, 200, 500, 1_000, 2_000, 5_000];
const DEFAULT_BUY_BONUS = 100;
const DEFAULT_COMBO_LIGHTNING = 5;
const DEFAULT_RAGE_LIGHTNING = 70;
const DEFAULT_TIER10 = 2;
const DEFAULT_TIER12 = 3;
const DEFAULT_JP_FEED = 0.03;
const DEFAULT_JP_FLOOR = 8_000;
const DEFAULT_FS_AWARD = 15;
const DEFAULT_FS_RETRIGGER = 5;
const DEFAULT_HOLD_CROWNS = 6;

function atomicWrite(data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, PATH);
}

function clampBet(n: unknown): number | null {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return null;
  return Math.min(v, 10_000_000);
}

function clampPay(n: unknown): number | null {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.min(50, Math.round(v * 10_000) / 10_000);
}

class OlympusEconomyStore {
  private snap: OlympusEconomySnap = {
    version: 1,
    pay: { ...DEFAULT_OLY_PAY },
    bets: [...DEFAULT_OLY_BETS],
    buyBonusMult: DEFAULT_BUY_BONUS,
    comboLightningAt: DEFAULT_COMBO_LIGHTNING,
    rageLightningAt: DEFAULT_RAGE_LIGHTNING,
    payModeDefault: "scatter",
    tier10Mult: DEFAULT_TIER10,
    tier12Mult: DEFAULT_TIER12,
    jackpotFeedRate: DEFAULT_JP_FEED,
    jackpotFloor: DEFAULT_JP_FLOOR,
    fsAward: DEFAULT_FS_AWARD,
    fsRetrigger: DEFAULT_FS_RETRIGGER,
    holdTriggerCrowns: DEFAULT_HOLD_CROWNS,
    updatedAt: 0,
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as Partial<OlympusEconomySnap>;
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

  private normalize(
    raw: Partial<OlympusEconomySnap> | null | undefined,
  ): OlympusEconomySnap {
    const pay: Record<OlyPaySymbol, number> = { ...DEFAULT_OLY_PAY };
    if (raw?.pay && typeof raw.pay === "object") {
      for (const sym of OLY_PAY_SYMBOLS) {
        const p = clampPay((raw.pay as Record<string, unknown>)[sym]);
        if (p != null) pay[sym] = p;
      }
    }
    const betsRaw = Array.isArray(raw?.bets) ? raw!.bets : DEFAULT_OLY_BETS;
    const bets = [
      ...new Set(
        betsRaw.map(clampBet).filter((n): n is number => n != null),
      ),
    ].sort((a, b) => a - b);
    const buy = Math.min(
      500,
      Math.max(10, Math.round(Number(raw?.buyBonusMult) || DEFAULT_BUY_BONUS)),
    );
    const comboAt = Math.min(
      20,
      Math.max(2, Math.round(Number(raw?.comboLightningAt) || DEFAULT_COMBO_LIGHTNING)),
    );
    const rageAt = Math.min(
      100,
      Math.max(20, Math.round(Number(raw?.rageLightningAt) || DEFAULT_RAGE_LIGHTNING)),
    );
    const payModeDefault =
      raw?.payModeDefault === "cluster" ? "cluster" : "scatter";
    const tier10 = Math.min(
      10,
      Math.max(1, Number(raw?.tier10Mult) || DEFAULT_TIER10),
    );
    const tier12 = Math.min(
      15,
      Math.max(1, Number(raw?.tier12Mult) || DEFAULT_TIER12),
    );
    const jpFeed = Math.min(
      0.2,
      Math.max(0.001, Number(raw?.jackpotFeedRate) || DEFAULT_JP_FEED),
    );
    const jpFloor = Math.min(
      10_000_000,
      Math.max(0, Math.round(Number(raw?.jackpotFloor) || DEFAULT_JP_FLOOR)),
    );
    const fsAward = Math.min(
      50,
      Math.max(5, Math.round(Number(raw?.fsAward) || DEFAULT_FS_AWARD)),
    );
    const fsRetrigger = Math.min(
      20,
      Math.max(1, Math.round(Number(raw?.fsRetrigger) || DEFAULT_FS_RETRIGGER)),
    );
    const holdCrowns = Math.min(
      20,
      Math.max(3, Math.round(Number(raw?.holdTriggerCrowns) || DEFAULT_HOLD_CROWNS)),
    );
    return {
      version: 1,
      pay,
      bets: bets.length ? bets : [...DEFAULT_OLY_BETS],
      buyBonusMult: buy,
      comboLightningAt: comboAt,
      rageLightningAt: rageAt,
      payModeDefault,
      tier10Mult: Math.round(tier10 * 100) / 100,
      tier12Mult: Math.round(tier12 * 100) / 100,
      jackpotFeedRate: Math.round(jpFeed * 10000) / 10000,
      jackpotFloor: jpFloor,
      fsAward,
      fsRetrigger,
      holdTriggerCrowns: holdCrowns,
      updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : 0,
    };
  }

  get(): OlympusEconomySnap {
    return {
      ...this.snap,
      pay: { ...this.snap.pay },
      bets: [...this.snap.bets],
    };
  }

  /** Public view for meta/session + admin */
  publicView() {
    const s = this.get();
    const payPct: Record<string, number> = {};
    for (const sym of OLY_PAY_SYMBOLS) {
      payPct[sym] = Math.round(s.pay[sym] * 10000) / 100;
    }
    return {
      ...s,
      /** % of bet at tier 1 (8–9 symbols) — UI friendly */
      payPct,
      noteVi:
        "pay = hệ số × cược ở tier ≥8. Tier ≥10 / ≥12 dùng hệ số admin. Combo cascade & rage kích lightning. Cluster nhân thêm theo kích thước nhóm.",
    };
  }

  payFor(sym: string): number {
    if ((OLY_PAY_SYMBOLS as readonly string[]).includes(sym)) {
      return this.snap.pay[sym as OlyPaySymbol];
    }
    return 0.2;
  }

  bets(): number[] {
    const list = xuLevelsStore.forGame("olympus");
    if (list.length) return list;
    return [...this.snap.bets];
  }

  isAllowedBet(n: number): boolean {
    return this.bets().includes(n);
  }

  buyBonusMult(): number {
    return this.snap.buyBonusMult;
  }

  comboLightningAt(): number {
    return this.snap.comboLightningAt;
  }

  rageLightningAt(): number {
    return this.snap.rageLightningAt;
  }

  payModeDefault(): "scatter" | "cluster" {
    return this.snap.payModeDefault;
  }

  scatterTier(n: number): number {
    if (n >= 12) return this.snap.tier12Mult;
    if (n >= 10) return this.snap.tier10Mult;
    return 1;
  }

  clusterTier(n: number): number {
    if (n >= 12) return this.snap.tier12Mult;
    if (n >= 8) return this.snap.tier10Mult;
    return 1;
  }

  jackpotFeedRate(): number {
    return this.snap.jackpotFeedRate;
  }

  jackpotFloor(): number {
    return this.snap.jackpotFloor;
  }

  fsAward(): number {
    return this.snap.fsAward;
  }

  fsRetrigger(): number {
    return this.snap.fsRetrigger;
  }

  holdTriggerCrowns(): number {
    return this.snap.holdTriggerCrowns;
  }

  patch(opts: {
    pay?: Partial<Record<string, number>>;
    /** If set, pay values are % (25 → 0.25) */
    payPct?: Partial<Record<string, number>>;
    bets?: number[];
    buyBonusMult?: number;
    comboLightningAt?: number;
    rageLightningAt?: number;
    payModeDefault?: string;
    tier10Mult?: number;
    tier12Mult?: number;
    jackpotFeedRate?: number;
    jackpotFloor?: number;
    fsAward?: number;
    fsRetrigger?: number;
    holdTriggerCrowns?: number;
  }): OlympusEconomySnap | { error: string } {
    const nextPay = { ...this.snap.pay };
    if (opts.payPct && typeof opts.payPct === "object") {
      for (const sym of OLY_PAY_SYMBOLS) {
        if (opts.payPct[sym] === undefined) continue;
        const pct = Number(opts.payPct[sym]);
        if (!Number.isFinite(pct)) {
          return { error: `payPct.${sym} không hợp lệ` };
        }
        const p = clampPay(pct / 100);
        if (p == null) return { error: `payPct.${sym} ngoài khoảng` };
        nextPay[sym] = p;
      }
    }
    if (opts.pay && typeof opts.pay === "object") {
      for (const sym of OLY_PAY_SYMBOLS) {
        if (opts.pay[sym] === undefined) continue;
        const p = clampPay(opts.pay[sym]);
        if (p == null) return { error: `pay.${sym} không hợp lệ` };
        nextPay[sym] = p;
      }
    }

    let nextBets = this.snap.bets;
    if (opts.bets !== undefined) {
      if (!Array.isArray(opts.bets) || !opts.bets.length) {
        return { error: "Cần ít nhất 1 mức cược" };
      }
      const cleaned = [
        ...new Set(
          opts.bets.map(clampBet).filter((n): n is number => n != null),
        ),
      ].sort((a, b) => a - b);
      if (!cleaned.length) return { error: "Danh sách cược trống/sai" };
      if (cleaned.length > 24) return { error: "Tối đa 24 mức cược" };
      nextBets = cleaned;
    }

    let buy = this.snap.buyBonusMult;
    if (opts.buyBonusMult !== undefined) {
      const b = Math.round(Number(opts.buyBonusMult));
      if (!Number.isFinite(b) || b < 10 || b > 500) {
        return { error: "buyBonusMult phải 10–500" };
      }
      buy = b;
    }

    let comboLightningAt = this.snap.comboLightningAt;
    if (opts.comboLightningAt !== undefined) {
      const v = Math.round(Number(opts.comboLightningAt));
      if (!Number.isFinite(v) || v < 2 || v > 20) {
        return { error: "comboLightningAt phải 2–20" };
      }
      comboLightningAt = v;
    }

    let rageLightningAt = this.snap.rageLightningAt;
    if (opts.rageLightningAt !== undefined) {
      const v = Math.round(Number(opts.rageLightningAt));
      if (!Number.isFinite(v) || v < 20 || v > 100) {
        return { error: "rageLightningAt phải 20–100" };
      }
      rageLightningAt = v;
    }

    let payModeDefault = this.snap.payModeDefault;
    if (opts.payModeDefault !== undefined) {
      payModeDefault =
        opts.payModeDefault === "cluster" ? "cluster" : "scatter";
    }

    let tier10Mult = this.snap.tier10Mult;
    if (opts.tier10Mult !== undefined) {
      const v = Number(opts.tier10Mult);
      if (!Number.isFinite(v) || v < 1 || v > 10) {
        return { error: "tier10Mult phải 1–10" };
      }
      tier10Mult = Math.round(v * 100) / 100;
    }

    let tier12Mult = this.snap.tier12Mult;
    if (opts.tier12Mult !== undefined) {
      const v = Number(opts.tier12Mult);
      if (!Number.isFinite(v) || v < 1 || v > 15) {
        return { error: "tier12Mult phải 1–15" };
      }
      tier12Mult = Math.round(v * 100) / 100;
    }

    let jackpotFeedRate = this.snap.jackpotFeedRate;
    if (opts.jackpotFeedRate !== undefined) {
      const v = Number(opts.jackpotFeedRate);
      if (!Number.isFinite(v) || v < 0.001 || v > 0.2) {
        return { error: "jackpotFeedRate phải 0.001–0.2 (vd 0.03 = 3%)" };
      }
      jackpotFeedRate = Math.round(v * 10000) / 10000;
    }

    let jackpotFloor = this.snap.jackpotFloor;
    if (opts.jackpotFloor !== undefined) {
      const v = Math.round(Number(opts.jackpotFloor));
      if (!Number.isFinite(v) || v < 0 || v > 10_000_000) {
        return { error: "jackpotFloor 0–10_000_000" };
      }
      jackpotFloor = v;
    }

    let fsAward = this.snap.fsAward;
    if (opts.fsAward !== undefined) {
      const v = Math.round(Number(opts.fsAward));
      if (!Number.isFinite(v) || v < 5 || v > 50) {
        return { error: "fsAward 5–50" };
      }
      fsAward = v;
    }

    let fsRetrigger = this.snap.fsRetrigger;
    if (opts.fsRetrigger !== undefined) {
      const v = Math.round(Number(opts.fsRetrigger));
      if (!Number.isFinite(v) || v < 1 || v > 20) {
        return { error: "fsRetrigger 1–20" };
      }
      fsRetrigger = v;
    }

    let holdTriggerCrowns = this.snap.holdTriggerCrowns;
    if (opts.holdTriggerCrowns !== undefined) {
      const v = Math.round(Number(opts.holdTriggerCrowns));
      if (!Number.isFinite(v) || v < 3 || v > 20) {
        return { error: "holdTriggerCrowns 3–20" };
      }
      holdTriggerCrowns = v;
    }

    this.snap = {
      version: 1,
      pay: nextPay,
      bets: nextBets,
      buyBonusMult: buy,
      comboLightningAt,
      rageLightningAt,
      payModeDefault,
      tier10Mult,
      tier12Mult,
      jackpotFeedRate,
      jackpotFloor,
      fsAward,
      fsRetrigger,
      holdTriggerCrowns,
      updatedAt: Date.now(),
    };
    this.save();
    if (opts.bets !== undefined) {
      xuLevelsStore.patch({ byGame: { olympus: this.snap.bets } });
    }
    return this.get();
  }

  resetDefaults(): OlympusEconomySnap {
    this.snap = {
      version: 1,
      pay: { ...DEFAULT_OLY_PAY },
      bets: [...DEFAULT_OLY_BETS],
      buyBonusMult: DEFAULT_BUY_BONUS,
      comboLightningAt: DEFAULT_COMBO_LIGHTNING,
      rageLightningAt: DEFAULT_RAGE_LIGHTNING,
      payModeDefault: "scatter",
      tier10Mult: DEFAULT_TIER10,
      tier12Mult: DEFAULT_TIER12,
      jackpotFeedRate: DEFAULT_JP_FEED,
      jackpotFloor: DEFAULT_JP_FLOOR,
      fsAward: DEFAULT_FS_AWARD,
      fsRetrigger: DEFAULT_FS_RETRIGGER,
      holdTriggerCrowns: DEFAULT_HOLD_CROWNS,
      updatedAt: Date.now(),
    };
    this.save();
    return this.get();
  }
}

export const olympusEconomyStore = new OlympusEconomyStore();
