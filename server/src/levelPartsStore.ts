/**
 * Tab Level — nhiều "part" level độc lập (play / couple / …).
 * Mỗi part: metric + công thức (coef, power, max) chỉnh qua admin popup.
 * Persist: server/data/level-parts.json
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_COUPLE_FORMULA,
  DEFAULT_PLAY_FORMULA,
  buildLevelTable,
  levelFromMetric,
  levelProgress,
  normalizeFormula,
  type LevelFormula,
} from "./levelFormula.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "level-parts.json");
const TMP = join(DATA_DIR, "level-parts.json.tmp");

export type LevelMetric = "rounds" | "xu";

export interface LevelPartConfig {
  id: string;
  label: string;
  /** Mô tả ngắn cho admin */
  blurb: string;
  enabled: boolean;
  metric: LevelMetric;
  formula: LevelFormula;
  /** Sort UI */
  sort: number;
}

interface LevelPartsFile {
  version: 1;
  parts: LevelPartConfig[];
  updatedAt: number;
  updatedBy?: string;
}

const CORE_IDS = ["play", "couple"] as const;

function defaultParts(): LevelPartConfig[] {
  return [
    {
      id: "play",
      label: "Cấp chơi bài",
      blurb: "Theo số ván lifetime (roundsPlayed)",
      enabled: true,
      metric: "rounds",
      formula: { ...DEFAULT_PLAY_FORMULA },
      sort: 10,
    },
    {
      id: "couple",
      label: "Cấp cặp / nhẫn",
      blurb: "Theo xu mua nhẫn lúc cầu hôn (lv–xu)",
      enabled: true,
      metric: "xu",
      formula: { ...DEFAULT_COUPLE_FORMULA },
      sort: 20,
    },
  ];
}

function normalizePart(raw: unknown): LevelPartConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<LevelPartConfig>;
  const id = String(r.id ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 32);
  if (!id) return null;
  const fallback =
    id === "couple" ? DEFAULT_COUPLE_FORMULA : DEFAULT_PLAY_FORMULA;
  const metric: LevelMetric = r.metric === "xu" ? "xu" : "rounds";
  return {
    id,
    label: String(r.label ?? id).trim().slice(0, 40) || id,
    blurb: String(r.blurb ?? "").trim().slice(0, 120),
    enabled: r.enabled !== false,
    metric: id === "couple" ? "xu" : id === "play" ? "rounds" : metric,
    formula: normalizeFormula(r.formula, fallback),
    sort: Math.max(0, Math.floor(Number(r.sort) || 50)),
  };
}

class LevelPartsStore {
  private parts: LevelPartConfig[] = defaultParts();
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        console.log("[level-parts] Created level-parts.json");
        return;
      }
      const parsed = JSON.parse(
        readFileSync(PATH, "utf8"),
      ) as Partial<LevelPartsFile>;
      const list = Array.isArray(parsed.parts)
        ? parsed.parts.map(normalizePart).filter((x): x is LevelPartConfig => !!x)
        : [];
      const byId = new Map(list.map((p) => [p.id, p]));
      // Đảm bảo core parts luôn có
      for (const d of defaultParts()) {
        if (!byId.has(d.id)) byId.set(d.id, d);
      }
      this.parts = [...byId.values()].sort(
        (a, b) => a.sort - b.sort || a.id.localeCompare(b.id),
      );
      this.updatedAt = Math.floor(Number(parsed.updatedAt) || 0);
      this.updatedBy = String(parsed.updatedBy ?? "");
      console.log(`[level-parts] Loaded ${this.parts.length} parts`);
    } catch (err) {
      console.warn("[level-parts] load failed:", err);
      this.parts = defaultParts();
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const body: LevelPartsFile = {
        version: 1,
        parts: this.parts.map((p) => ({
          ...p,
          formula: { ...p.formula },
        })),
        updatedAt: this.updatedAt,
        updatedBy: this.updatedBy || undefined,
      };
      writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[level-parts] save failed:", err);
    }
  }

  getPart(id: string): LevelPartConfig | undefined {
    return this.parts.find((p) => p.id === id);
  }

  playFormula(): LevelFormula {
    return (
      this.getPart("play")?.formula ?? { ...DEFAULT_PLAY_FORMULA }
    );
  }

  coupleFormula(): LevelFormula {
    return (
      this.getPart("couple")?.formula ?? { ...DEFAULT_COUPLE_FORMULA }
    );
  }

  coupleLevelFromXu(xu: unknown): number {
    return levelFromMetric(xu, this.coupleFormula());
  }

  coupleProgress(xu: unknown) {
    return levelProgress(xu, this.coupleFormula());
  }

  upsertPart(
    raw: unknown,
    byUsername?: string,
  ):
    | { ok: true; part: LevelPartConfig }
    | { ok: false; reason: string } {
    const part = normalizePart(raw);
    if (!part) return { ok: false, reason: "Part không hợp lệ (thiếu id)" };
    // Không đổi metric core
    if (part.id === "play") part.metric = "rounds";
    if (part.id === "couple") part.metric = "xu";
    const idx = this.parts.findIndex((p) => p.id === part.id);
    if (idx >= 0) this.parts[idx] = part;
    else this.parts.push(part);
    this.parts.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    this.updatedAt = Date.now();
    this.updatedBy = byUsername?.trim() || "";
    this.save();
    return { ok: true, part: { ...part, formula: { ...part.formula } } };
  }

  snapshot() {
    return {
      parts: this.parts.map((p) => ({
        ...p,
        formula: { ...p.formula },
        preview: buildLevelTable(p.formula, Math.min(p.formula.maxLevel, 20)),
      })),
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
      coreIds: [...CORE_IDS],
    };
  }

  /** Public — client sync công thức */
  getPublic() {
    return {
      parts: this.parts
        .filter((p) => p.enabled)
        .map((p) => ({
          id: p.id,
          label: p.label,
          metric: p.metric,
          formula: { ...p.formula },
        })),
    };
  }
}

export const levelPartsStore = new LevelPartsStore();
