/**
 * Online-learning nhẹ cho Inter mode `smartai`.
 * Persist affinity theo lá + hệ số feature → be/data/smart-ai.json.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "smart-ai.json");
const TMP = join(DATA_DIR, "smart-ai.json.tmp");

const CARD_N = 8;
const LR = 0.04;
const DECAY = 0.002;
const AFFINITY_MIN = 0.35;
const AFFINITY_MAX = 2.8;

export type SmartAiCoeffs = {
  cool: number;
  heat: number;
  crowd: number;
  liability: number;
  vault: number;
};

const DEFAULT_COEFFS: SmartAiCoeffs = {
  cool: 0.55,
  heat: 0.35,
  crowd: 0.7,
  liability: 0.55,
  vault: 0.4,
};

interface SmartAiFile {
  version: 1;
  affinity: number[];
  coeffs: SmartAiCoeffs;
  rounds: number;
  updatedAt: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeAffinity(raw: unknown): number[] {
  const out = Array.from({ length: CARD_N }, () => 1);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < CARD_N; i++) {
    const v = Number(raw[i]);
    out[i] = Number.isFinite(v) ? clamp(v, AFFINITY_MIN, AFFINITY_MAX) : 1;
  }
  return out;
}

function normalizeCoeffs(raw: unknown): SmartAiCoeffs {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pick = (k: keyof SmartAiCoeffs, lo: number, hi: number) => {
    const v = Number(src[k]);
    return Number.isFinite(v) ? clamp(v, lo, hi) : DEFAULT_COEFFS[k];
  };
  return {
    cool: pick("cool", 0.05, 1.5),
    heat: pick("heat", 0.05, 1.2),
    crowd: pick("crowd", 0.05, 1.5),
    liability: pick("liability", 0.05, 1.5),
    vault: pick("vault", 0.05, 1.2),
  };
}

class SmartAiStore {
  private affinity: number[] = Array.from({ length: CARD_N }, () => 1);
  private coeffs: SmartAiCoeffs = { ...DEFAULT_COEFFS };
  private rounds = 0;
  private updatedAt = 0;

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as SmartAiFile;
      if (parsed?.version !== 1) return;
      this.affinity = normalizeAffinity(parsed.affinity);
      this.coeffs = normalizeCoeffs(parsed.coeffs);
      this.rounds = Math.max(0, Math.floor(Number(parsed.rounds) || 0));
      this.updatedAt = Number(parsed.updatedAt) || 0;
    } catch (err) {
      console.warn("[smart-ai] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: SmartAiFile = {
      version: 1,
      affinity: this.affinity,
      coeffs: this.coeffs,
      rounds: this.rounds,
      updatedAt: this.updatedAt,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  getAffinity(): number[] {
    return [...this.affinity];
  }

  getCoeffs(): SmartAiCoeffs {
    return { ...this.coeffs };
  }

  getSnapshot() {
    return {
      affinity: this.getAffinity(),
      coeffs: this.getCoeffs(),
      rounds: this.rounds,
      updatedAt: this.updatedAt,
    };
  }

  /** Học sau khi khóa lá thắng. */
  learn(opts: {
    winIdx: number;
    houseProfit: number;
    authStake: number;
  }) {
    const idx = Math.floor(opts.winIdx);
    if (idx < 0 || idx >= CARD_N) return;

    const stake = Math.max(0, opts.authStake);
    const profit = opts.houseProfit;
    const scale =
      stake > 0
        ? clamp(profit / Math.max(stake * 0.35, 500), -1.5, 1.5)
        : clamp(profit / 5_000, -1, 1);

    for (let i = 0; i < CARD_N; i++) {
      this.affinity[i] = this.affinity[i]! + (1 - this.affinity[i]!) * DECAY;
    }

    const delta = LR * scale;
    this.affinity[idx] = clamp(
      this.affinity[idx]! * (1 + delta),
      AFFINITY_MIN,
      AFFINITY_MAX,
    );

    const others = CARD_N - 1;
    const share = others > 0 ? -delta / others : 0;
    for (let i = 0; i < CARD_N; i++) {
      if (i === idx) continue;
      this.affinity[i] = clamp(
        this.affinity[i]! * (1 + share * 0.35),
        AFFINITY_MIN,
        AFFINITY_MAX,
      );
    }

    if (scale > 0.25) {
      this.coeffs.crowd = clamp(this.coeffs.crowd * 1.01, 0.05, 1.5);
      this.coeffs.liability = clamp(this.coeffs.liability * 1.008, 0.05, 1.5);
    } else if (scale < -0.25) {
      this.coeffs.cool = clamp(this.coeffs.cool * 0.99, 0.05, 1.5);
      this.coeffs.heat = clamp(this.coeffs.heat * 1.01, 0.05, 1.2);
    }

    this.rounds += 1;
    this.updatedAt = Date.now();
    if (this.rounds % 3 === 0 || Math.abs(scale) > 0.8) this.save();
  }

  flush() {
    this.save();
  }
}

export const smartAiStore = new SmartAiStore();
