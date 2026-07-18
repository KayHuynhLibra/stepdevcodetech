import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/** Mode can thiệp xác suất lá thắng (mainadmin). */
export type ForceCardMode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type PolicyMode = "app" | "user" | "fed";
/** Mode tác động xoay trong ALL (không gồm ép lá / ALL). */
export type RotateMode = "auto" | "small" | "big" | PolicyMode;
export type InterMode = RotateMode | "all" | ForceCardMode;

export const FORCE_CARD_MODES: ForceCardMode[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
];

export const POLICY_MODES: PolicyMode[] = ["app", "user", "fed"];

/** Thứ tự xoay khi mode = ALL — mỗi slot 5 phút. */
export const ALL_ROTATION: RotateMode[] = [
  "auto",
  "small",
  "big",
  "app",
  "fed",
  "user",
];

export const ALL_SLOT_MS = 5 * 60 * 1000;

export const INTER_MODES: InterMode[] = [
  "all",
  "auto",
  "small",
  "big",
  "app",
  "user",
  "fed",
  ...FORCE_CARD_MODES,
];

export function isForceCardMode(v: unknown): v is ForceCardMode {
  return (
    v === "1" ||
    v === "2" ||
    v === "3" ||
    v === "4" ||
    v === "5" ||
    v === "6" ||
    v === "7" ||
    v === "8"
  );
}

export function isPolicyMode(v: unknown): v is PolicyMode {
  return v === "app" || v === "user" || v === "fed";
}

export function isRotateMode(v: unknown): v is RotateMode {
  return (
    v === "auto" ||
    v === "small" ||
    v === "big" ||
    isPolicyMode(v)
  );
}

export function isInterMode(v: unknown): v is InterMode {
  return v === "all" || isRotateMode(v) || isForceCardMode(v);
}

/** Mode ép thắng → id lá; còn lại null. */
export function forcedCardId(mode: InterMode): number | null {
  return isForceCardMode(mode) ? Number(mode) : null;
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
 * App = hút xu mềm — ưu tiên lá trả thấp (vẫn random).
 * Fed = đọc cầu user đăng nhập → chọn lá app lời tối đa (cứng).
 * User = nhả xu — ưu tiên lá user thật trả thưởng cao.
 * ALL = xoay các mode tác động mỗi 5 phút.
 * 1–8 = ép thắng đúng lá đó (100%).
 */
const PREF_SHARE = 0.72;
const OTHER_SHARE = 0.28;

const FORCE_LABELS: Record<ForceCardMode, string> = {
  "1": "Ép lá #1 — Nhà Ảo Thuật (100%)",
  "2": "Ép lá #2 — Nữ Tư Tế (100%)",
  "3": "Ép lá #3 — Nữ Hoàng (100%)",
  "4": "Ép lá #4 — Hoàng Đế (100%)",
  "5": "Ép lá #5 — Đôi Tình Nhân (100%)",
  "6": "Ép lá #6 — Xe Ngựa (100%)",
  "7": "Ép lá #7 — Sức Mạnh (100%)",
  "8": "Ép lá #8 — Mặt Trời (100%)",
};

export class InterStore {
  private mode: InterMode = "auto";
  private updatedAt = 0;
  private updatedBy = "";
  private lastLoggedEffective: string | null = null;

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

  /** Mode đã chọn (có thể là ALL). */
  getMode(): InterMode {
    return this.mode;
  }

  /**
   * Mode thực sự áp dụng khi rút bài.
   * ALL → xoay theo slot 5 phút kể từ lúc bật ALL.
   */
  getEffectiveMode(): Exclude<InterMode, "all"> {
    if (this.mode !== "all") return this.mode;
    const anchor = this.updatedAt || Date.now();
    const elapsed = Math.max(0, Date.now() - anchor);
    const idx = Math.floor(elapsed / ALL_SLOT_MS) % ALL_ROTATION.length;
    return ALL_ROTATION[idx]!;
  }

  /** Gọi định kỳ — log khi ALL đổi slot. */
  tickRotation() {
    if (this.mode !== "all") {
      this.lastLoggedEffective = null;
      return;
    }
    const eff = this.getEffectiveMode();
    if (eff !== this.lastLoggedEffective) {
      const snap = this.getRotationInfo();
      console.log(
        `[inter:ALL] slot → ${eff} · còn ~${Math.ceil(snap.remainingMs / 1000)}s · tiếp ${snap.nextMode}`,
      );
      this.lastLoggedEffective = eff;
    }
  }

  getRotationInfo() {
    const anchor = this.updatedAt || Date.now();
    const elapsed = Math.max(0, Date.now() - anchor);
    const idx = Math.floor(elapsed / ALL_SLOT_MS) % ALL_ROTATION.length;
    const intoSlot = elapsed % ALL_SLOT_MS;
    const remainingMs = ALL_SLOT_MS - intoSlot;
    const nextIdx = (idx + 1) % ALL_ROTATION.length;
    return {
      rotation: [...ALL_ROTATION],
      slotMs: ALL_SLOT_MS,
      slotIndex: idx,
      effectiveMode: ALL_ROTATION[idx]!,
      nextMode: ALL_ROTATION[nextIdx]!,
      remainingMs,
      nextRotateAt: Date.now() + remainingMs,
    };
  }

  setMode(mode: InterMode, byUsername: string): { ok: true; mode: InterMode } {
    this.mode = mode;
    this.updatedAt = Date.now();
    this.updatedBy = byUsername;
    this.lastLoggedEffective = null;
    this.save();
    console.log(`[inter] Mode → ${mode} by ${byUsername}`);
    return { ok: true, mode: this.mode };
  }

  getSnapshot() {
    const effectiveMode = this.getEffectiveMode();
    const rotation =
      this.mode === "all"
        ? this.getRotationInfo()
        : {
            rotation: [...ALL_ROTATION],
            slotMs: ALL_SLOT_MS,
            slotIndex: 0,
            effectiveMode,
            nextMode: ALL_ROTATION[1]!,
            remainingMs: 0,
            nextRotateAt: 0,
          };

    return {
      mode: this.mode,
      effectiveMode,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
      labels: {
        all: "ALL — xoay auto→small→big→app→fed→user mỗi 5 phút",
        auto: "Tự động — weight gốc, không lệch nhóm",
        small: "Small — ưu tiên lá 1–4 (Nhà Ảo Thuật … Hoàng Đế)",
        big: "Big — ưu tiên lá 5–8 (Đôi Tình Nhân … Mặt Trời)",
        app: "App — hút xu mềm theo stake user (ưu tiên lá trả ít, vẫn random)",
        fed: "Fed — đọc cầu user đăng nhập; luôn chọn lá app lời tối đa (thường lá ít/không ai đánh)",
        user: "User — nhả xu theo stake user thật (ưu tiên lá trả nhiều)",
        ...FORCE_LABELS,
      } as Record<InterMode, string>,
      groups: {
        small: [1, 2, 3, 4],
        big: [5, 6, 7, 8],
      },
      prefShare: PREF_SHARE,
      otherShare: OTHER_SHARE,
      all: rotation,
    };
  }
}

/** Trọng số hiệu dụng theo mode (tổng ~100). Không nhận ALL — dùng effective. */
export function effectiveWeights(
  baseWeights: number[],
  mode: InterMode,
  cardIds: number[],
): number[] {
  if (mode === "all") {
    return [...baseWeights];
  }

  const forced = forcedCardId(mode);
  if (forced != null) {
    return cardIds.map((id) => (id === forced ? 100 : 0));
  }

  if (mode === "auto" || isPolicyMode(mode)) return [...baseWeights];

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
