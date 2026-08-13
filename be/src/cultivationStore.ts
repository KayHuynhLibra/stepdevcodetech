import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  CULTIVATION_LABELS,
  CULTIVATION_RANKS,
  DEFAULT_CULTIVATION_BENEFITS,
  DEFAULT_CULTIVATION_COLORS,
  DEFAULT_CULTIVATION_MAINTENANCE,
  isCultivationRank,
  normalizeHexColor,
  type CultivationBenefit,
  type CultivationBenefitMap,
  type CultivationColor,
  type CultivationColorMap,
  type CultivationMaintenance,
  type CultivationMaintenanceMap,
  type CultivationPeriod,
  type CultivationRank,
} from "./cultivationRanks.js";

export type {
  CultivationBenefit,
  CultivationBenefitMap,
  CultivationColor,
  CultivationColorMap,
  CultivationMaintenance,
  CultivationMaintenanceMap,
  CultivationPeriod,
  CultivationRank,
} from "./cultivationRanks.js";
export {
  CULTIVATION_LABELS,
  CULTIVATION_RANKS,
  DEFAULT_CULTIVATION_BENEFITS,
  DEFAULT_CULTIVATION_COLORS,
  DEFAULT_CULTIVATION_MAINTENANCE,
  demoteRank,
  isCultivationRank,
  periodMs,
  rankIndex,
} from "./cultivationRanks.js";

interface CultivationFile {
  version: 2;
  colors: CultivationColorMap;
  benefits: CultivationBenefitMap;
  maintenance: CultivationMaintenanceMap;
  updatedAt: number;
  updatedBy: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "cultivation.json");
const TMP = join(DATA_DIR, "cultivation.json.tmp");

function cloneColors(): CultivationColorMap {
  return structuredClone(DEFAULT_CULTIVATION_COLORS);
}
function cloneBenefits(): CultivationBenefitMap {
  return structuredClone(DEFAULT_CULTIVATION_BENEFITS);
}
function cloneMaintenance(): CultivationMaintenanceMap {
  return structuredClone(DEFAULT_CULTIVATION_MAINTENANCE);
}

function mergeColors(raw: unknown): CultivationColorMap {
  const next = cloneColors();
  if (!raw || typeof raw !== "object") return next;
  const obj = raw as Record<string, Partial<CultivationColor>>;
  for (const rank of CULTIVATION_RANKS) {
    const row = obj[rank];
    if (!row || typeof row !== "object") continue;
    const def = DEFAULT_CULTIVATION_COLORS[rank];
    next[rank] = {
      bg: normalizeHexColor(row.bg, def.bg),
      text: normalizeHexColor(row.text, def.text),
      border: normalizeHexColor(row.border, def.border),
    };
  }
  return next;
}

function clampPct(n: number) {
  return Math.max(0, Math.min(80, Math.floor(n)));
}
function clampPriority(n: number) {
  return Math.max(0, Math.min(8, Math.floor(n)));
}

function mergeBenefits(raw: unknown): CultivationBenefitMap {
  const next = cloneBenefits();
  if (!raw || typeof raw !== "object") return next;
  const obj = raw as Record<string, Partial<CultivationBenefit>>;
  for (const rank of CULTIVATION_RANKS) {
    const row = obj[rank];
    if (!row || typeof row !== "object") continue;
    const def = DEFAULT_CULTIVATION_BENEFITS[rank];
    next[rank] = {
      chatDiscountPct: clampPct(
        Number(row.chatDiscountPct ?? def.chatDiscountPct),
      ),
      voiceSeatPriority: clampPriority(
        Number(row.voiceSeatPriority ?? def.voiceSeatPriority),
      ),
      voiceHoldBonusMs: Math.max(
        0,
        Math.floor(Number(row.voiceHoldBonusMs ?? def.voiceHoldBonusMs) || 0),
      ),
    };
  }
  return next;
}

function mergeMaintenance(raw: unknown): CultivationMaintenanceMap {
  const next = cloneMaintenance();
  if (!raw || typeof raw !== "object") return next;
  const obj = raw as Record<string, Partial<CultivationMaintenance>>;
  for (const rank of CULTIVATION_RANKS) {
    const row = obj[rank];
    if (!row || typeof row !== "object") continue;
    const def = DEFAULT_CULTIVATION_MAINTENANCE[rank];
    const period: CultivationPeriod =
      row.period === "week" || row.period === "day" ? row.period : def.period;
    next[rank] = {
      period,
      feeXu: Math.max(0, Math.floor(Number(row.feeXu ?? def.feeXu) || 0)),
    };
  }
  return next;
}

class CultivationStore {
  private colors: CultivationColorMap = cloneColors();
  private benefits: CultivationBenefitMap = cloneBenefits();
  private maintenance: CultivationMaintenanceMap = cloneMaintenance();
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        console.log("[cultivation] Created default cultivation.json");
        return;
      }
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as Partial<CultivationFile> & {
        version?: number;
      };
      this.colors = mergeColors(parsed.colors);
      this.benefits = mergeBenefits(parsed.benefits);
      this.maintenance = mergeMaintenance(parsed.maintenance);
      this.updatedAt = Number(parsed.updatedAt) || 0;
      this.updatedBy = String(parsed.updatedBy ?? "");
      if (parsed.version !== 2) this.save();
      console.log("[cultivation] Loaded colors + benefits + maintenance");
    } catch (err) {
      console.warn("[cultivation] Failed to load:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const body: CultivationFile = {
        version: 2,
        colors: this.colors,
        benefits: this.benefits,
        maintenance: this.maintenance,
        updatedAt: this.updatedAt,
        updatedBy: this.updatedBy,
      };
      writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[cultivation] Failed to save:", err);
    }
  }

  private touch(byUsername: string) {
    this.updatedAt = Date.now();
    this.updatedBy = String(byUsername ?? "").slice(0, 40);
    this.save();
  }

  getColors(): CultivationColorMap {
    return structuredClone(this.colors);
  }

  getBenefits(): CultivationBenefitMap {
    return structuredClone(this.benefits);
  }

  getMaintenance(): CultivationMaintenanceMap {
    return structuredClone(this.maintenance);
  }

  getBenefit(rank: CultivationRank | null | undefined): CultivationBenefit {
    if (!rank || !isCultivationRank(rank)) {
      return { chatDiscountPct: 0, voiceSeatPriority: 0, voiceHoldBonusMs: 0 };
    }
    return this.benefits[rank] ?? DEFAULT_CULTIVATION_BENEFITS[rank];
  }

  getMaintenanceFor(rank: CultivationRank): CultivationMaintenance {
    return this.maintenance[rank] ?? DEFAULT_CULTIVATION_MAINTENANCE[rank];
  }

  chatCostAfterDiscount(baseCost: number, rank?: CultivationRank | null): number {
    const pct = this.getBenefit(rank).chatDiscountPct;
    const cost = Math.floor(baseCost * (1 - pct / 100));
    return Math.max(0, cost);
  }

  getPublic() {
    return {
      colors: this.getColors(),
      benefits: this.getBenefits(),
      maintenance: this.getMaintenance(),
      labels: { ...CULTIVATION_LABELS },
      ranks: [...CULTIVATION_RANKS],
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }

  setColors(
    partial: unknown,
    byUsername: string,
  ):
    | { ok: true; colors: CultivationColorMap }
    | { ok: false; reason: string } {
    if (!partial || typeof partial !== "object") {
      return { ok: false, reason: "colors không hợp lệ" };
    }
    this.colors = mergeColors({ ...this.colors, ...(partial as object) });
    this.touch(byUsername);
    return { ok: true, colors: this.getColors() };
  }

  setBenefitsAndMaintenance(
    opts: { benefits?: unknown; maintenance?: unknown },
    byUsername: string,
  ): { ok: true } | { ok: false; reason: string } {
    if (opts.benefits != null) {
      this.benefits = mergeBenefits(opts.benefits);
    }
    if (opts.maintenance != null) {
      this.maintenance = mergeMaintenance(opts.maintenance);
    }
    this.touch(byUsername);
    return { ok: true };
  }

  resetToDefault(byUsername: string) {
    this.colors = cloneColors();
    this.benefits = cloneBenefits();
    this.maintenance = cloneMaintenance();
    this.touch(byUsername);
    return { ok: true as const, ...this.getPublic() };
  }
}

export const cultivationStore = new CultivationStore();
