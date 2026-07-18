import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/** Mode can thiệp xác suất lá thắng (mainadmin). */
export type InterMode = "auto" | "small" | "big";

export const INTER_MODES: InterMode[] = ["auto", "small", "big"];

export function isInterMode(v: unknown): v is InterMode {
  return v === "auto" || v === "small" || v === "big";
}

interface InterFile {
  version: 1;
  mode: InterMode;
  updatedAt: number;
  updatedBy: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "inter.json");
const TMP = join(DATA_DIR, "inter.json.tmp");

/**
 * Small = lá 1–4 xác suất cao hơn.
 * Big = lá 5–8 xác suất cao hơn.
 * Auto = weight gốc, không lệch nhóm.
 */
const PREF_SHARE = 0.72;
const OTHER_SHARE = 0.28;

export class InterStore {
  private mode: InterMode = "auto";
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        console.log("[inter] Mode mặc định: auto");
        return;
      }
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as InterFile;
      if (parsed?.version !== 1) return;
      if (isInterMode(parsed.mode)) this.mode = parsed.mode;
      if (typeof parsed.updatedAt === "number") this.updatedAt = parsed.updatedAt;
      if (typeof parsed.updatedBy === "string") this.updatedBy = parsed.updatedBy;
      console.log(`[inter] Loaded mode=${this.mode}`);
    } catch (err) {
      console.warn("[inter] Failed to load inter.json:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: InterFile = {
      version: 1,
      mode: this.mode,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  getMode(): InterMode {
    return this.mode;
  }

  setMode(mode: InterMode, byUsername: string): { ok: true; mode: InterMode } {
    this.mode = mode;
    this.updatedAt = Date.now();
    this.updatedBy = byUsername;
    this.save();
    console.log(`[inter] Mode → ${mode} by ${byUsername}`);
    return { ok: true, mode: this.mode };
  }

  getSnapshot() {
    return {
      mode: this.mode,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
      labels: {
        auto: "Tự động — weight gốc, không lệch nhóm",
        small: "Small — ưu tiên lá 1–4 (Nhà Ảo Thuật … Hoàng Đế)",
        big: "Big — ưu tiên lá 5–8 (Đôi Tình Nhân … Mặt Trời)",
      } as Record<InterMode, string>,
      groups: {
        small: [1, 2, 3, 4],
        big: [5, 6, 7, 8],
      },
      prefShare: PREF_SHARE,
      otherShare: OTHER_SHARE,
    };
  }
}

/** Trọng số hiệu dụng theo mode (tổng ~100). */
export function effectiveWeights(
  baseWeights: number[],
  mode: InterMode,
  cardIds: number[],
): number[] {
  if (mode === "auto") return [...baseWeights];

  const prefIds = new Set(mode === "small" ? [1, 2, 3, 4] : [5, 6, 7, 8]);
  let prefTotal = 0;
  let otherTotal = 0;
  for (let i = 0; i < cardIds.length; i++) {
    const id = cardIds[i]!;
    const w = baseWeights[i]!;
    if (prefIds.has(id)) prefTotal += w;
    else otherTotal += w;
  }
  if (prefTotal <= 0 || otherTotal <= 0) return [...baseWeights];

  return cardIds.map((id, i) => {
    const w = baseWeights[i]!;
    if (prefIds.has(id)) return (w / prefTotal) * PREF_SHARE * 100;
    return (w / otherTotal) * OTHER_SHARE * 100;
  });
}

export const interStore = new InterStore();
