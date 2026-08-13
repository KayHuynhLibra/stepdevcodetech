/**
 * Config lì xì Room voice — % xu thực phát cho người nhận.
 * Persist `be/data/voice-lixi.json`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "voice-lixi.json");
const TMP = join(DATA_DIR, "voice-lixi.json.tmp");

/** Tối thiểu mỗi lần phát lì xì */
export const VOICE_LIXI_MIN = 10_000_000;
/** Trần một lần (trùng ITEM_XU_MAX thực tế vẫn check balance) */
export const VOICE_LIXI_MAX = 999_999_999_999;

export interface VoiceLixiPublic {
  /** % tổng xu gửi được chia cho người trong room (1–100) */
  payoutPct: number;
  minAmount: number;
  maxAmount: number;
}

interface VoiceLixiFile extends VoiceLixiPublic {
  version: 1;
  updatedAt: number;
  updatedBy?: string;
}

function clampPct(raw: unknown, fallback = 100): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, n));
}

class VoiceLixiStore {
  private payoutPct = 100;
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as Partial<VoiceLixiFile>;
      if (parsed?.version !== 1) return;
      this.payoutPct = clampPct(parsed.payoutPct, 100);
      this.updatedAt = Number(parsed.updatedAt) || 0;
      this.updatedBy = String(parsed.updatedBy ?? "");
    } catch (err) {
      console.warn("[voice-lixi] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: VoiceLixiFile = {
      version: 1,
      payoutPct: this.payoutPct,
      minAmount: VOICE_LIXI_MIN,
      maxAmount: VOICE_LIXI_MAX,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  getPublic(): VoiceLixiPublic {
    return {
      payoutPct: this.payoutPct,
      minAmount: VOICE_LIXI_MIN,
      maxAmount: VOICE_LIXI_MAX,
    };
  }

  getSnapshot() {
    return {
      ...this.getPublic(),
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
    };
  }

  setPayoutPct(
    pct: unknown,
    byUsername: string,
  ): { ok: true; config: ReturnType<VoiceLixiStore["getSnapshot"]> } {
    this.payoutPct = clampPct(pct, this.payoutPct);
    this.updatedAt = Date.now();
    this.updatedBy = String(byUsername ?? "").trim().slice(0, 40);
    this.save();
    return { ok: true, config: this.getSnapshot() };
  }
}

export const voiceLixiStore = new VoiceLixiStore();
