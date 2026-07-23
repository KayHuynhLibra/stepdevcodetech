/**
 * Cờ AI/UX công khai vs player.
 * Admin luôn xem được tip/suggest trên bàn; player chỉ khi bật.
 * Persist server/data/ai-features.json.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "ai-features.json");
const TMP = join(DATA_DIR, "ai-features.json.tmp");

export interface AiFeaturesConfig {
  /** Tip bàn chơi hiện với player thường */
  playTipsForPlayers: boolean;
  /** Chat quick-suggest hiện với player thường */
  chatSuggestsForPlayers: boolean;
  /** Bot dùng persona follower/contrarian/... */
  botPersonasEnabled: boolean;
  /** Soft-gate coupon khi risk cao */
  riskSoftGateEnabled: boolean;
  /** Ngưỡng score (0–100) để soft-gate */
  riskSoftGateMinScore: number;
}

const DEFAULTS: AiFeaturesConfig = {
  playTipsForPlayers: false,
  chatSuggestsForPlayers: false,
  botPersonasEnabled: true,
  riskSoftGateEnabled: true,
  riskSoftGateMinScore: 70,
};

interface AiFeaturesFile {
  version: 1;
  config: AiFeaturesConfig;
  updatedAt: number;
  updatedBy: string;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return DEFAULTS.riskSoftGateMinScore;
  return Math.max(40, Math.min(95, Math.floor(n)));
}

function normalizeConfig(raw: unknown): AiFeaturesConfig {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    playTipsForPlayers: src.playTipsForPlayers === true,
    chatSuggestsForPlayers: src.chatSuggestsForPlayers === true,
    botPersonasEnabled: src.botPersonasEnabled !== false,
    riskSoftGateEnabled: src.riskSoftGateEnabled !== false,
    riskSoftGateMinScore: clampScore(Number(src.riskSoftGateMinScore)),
  };
}

class AiFeaturesStore {
  private config: AiFeaturesConfig = { ...DEFAULTS };
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as AiFeaturesFile;
      if (parsed?.version !== 1) return;
      this.config = normalizeConfig(parsed.config);
      this.updatedAt = Number(parsed.updatedAt) || 0;
      this.updatedBy = String(parsed.updatedBy ?? "");
    } catch (err) {
      console.warn("[ai-features] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: AiFeaturesFile = {
      version: 1,
      config: this.config,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  get(): AiFeaturesConfig {
    return { ...this.config };
  }

  getSnapshot() {
    return {
      ...this.get(),
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }

  /** Flags gửi kèm public state (không lộ soft-gate internals). */
  getPublicFlags() {
    return {
      playTipsForPlayers: this.config.playTipsForPlayers,
      chatSuggestsForPlayers: this.config.chatSuggestsForPlayers,
    };
  }

  update(
    patch: Partial<AiFeaturesConfig>,
    byUsername: string,
  ): { ok: true; config: AiFeaturesConfig } {
    const next = { ...this.config };
    if (patch.playTipsForPlayers !== undefined) {
      next.playTipsForPlayers = !!patch.playTipsForPlayers;
    }
    if (patch.chatSuggestsForPlayers !== undefined) {
      next.chatSuggestsForPlayers = !!patch.chatSuggestsForPlayers;
    }
    if (patch.botPersonasEnabled !== undefined) {
      next.botPersonasEnabled = !!patch.botPersonasEnabled;
    }
    if (patch.riskSoftGateEnabled !== undefined) {
      next.riskSoftGateEnabled = !!patch.riskSoftGateEnabled;
    }
    if (patch.riskSoftGateMinScore !== undefined) {
      next.riskSoftGateMinScore = clampScore(Number(patch.riskSoftGateMinScore));
    }
    this.config = next;
    this.updatedAt = Date.now();
    this.updatedBy = String(byUsername || "").slice(0, 40);
    this.save();
    return { ok: true, config: this.get() };
  }
}

export const aiFeaturesStore = new AiFeaturesStore();
