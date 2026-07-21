import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { adaptAllEffectiveMode } from "./tarotEngagement.js";
import {
  ALL_ROTATION_DEFAULT,
  isPackMode,
  isRotateMode,
  MODE_PACK_LABELS,
  MODE_PACK_ROTATIONS,
  packRotation,
  PACK_MODES,
  ROTATE_LABELS,
  ROTATE_MODE_IDS,
  type PackMode,
  type RotateMode,
} from "./interAlgorithms.js";

export type { PackMode, RotateMode } from "./interAlgorithms.js";
export {
  MODE_PACK_LABELS,
  MODE_PACK_ROTATIONS,
  ROTATE_LABELS,
  ROTATE_MODE_IDS,
} from "./interAlgorithms.js";

/** Mode can thiệp xác suất lá thắng (mainadmin). */
export type ForceCardMode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type PolicyMode =
  | "app"
  | "softapp"
  | "user"
  | "momentum"
  | "fed"
  | "softfed"
  | "hedge"
  | "contrarian"
  | "sparse"
  | "dense";
/** Legacy bias subset */
export type BiasMode = "auto" | "small" | "big" | "flat" | "cool";

export type InterMode = RotateMode | "all" | PackMode | ForceCardMode;

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

export const POLICY_MODES: PolicyMode[] = [
  "app",
  "softapp",
  "hedge",
  "softfed",
  "fed",
  "user",
  "momentum",
  "contrarian",
  "sparse",
  "dense",
];

/** Thứ tự xoay mặc định khi mode = ALL (tùy chỉnh được). */
export const ALL_ROTATION: RotateMode[] = [...ALL_ROTATION_DEFAULT];

export const ROTATE_MODES: RotateMode[] = [...ROTATE_MODE_IDS];

export const MIN_ALL_ROTATION_LEN = 2;
export const MAX_ALL_ROTATION_LEN = 20;

export function validateAllRotation(raw: unknown):
  | { ok: true; steps: RotateMode[] }
  | { ok: false; reason: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "rotation phải là mảng" };
  }
  const steps: RotateMode[] = [];
  for (const item of raw) {
    if (!isRotateMode(item)) {
      return { ok: false, reason: `Bước không hợp lệ: ${String(item)}` };
    }
    steps.push(item);
  }
  if (steps.length < MIN_ALL_ROTATION_LEN) {
    return {
      ok: false,
      reason: `Chuỗi cần ít nhất ${MIN_ALL_ROTATION_LEN} bước`,
    };
  }
  if (steps.length > MAX_ALL_ROTATION_LEN) {
    return {
      ok: false,
      reason: `Chuỗi tối đa ${MAX_ALL_ROTATION_LEN} bước`,
    };
  }
  return { ok: true, steps };
}

export { isRotateMode } from "./interAlgorithms.js";

export const ALL_SLOT_MS = 5 * 60 * 1000;
/** Thời lượng mỗi slot khi mode ALL (phút) — chọn 1…9 (&lt; 10 phút). */
export const DEFAULT_ALL_SLOT_MINUTES = 5;
export const MIN_ALL_SLOT_MINUTES = 1;
export const MAX_ALL_SLOT_MINUTES = 9;

export function clampAllSlotMinutes(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_ALL_SLOT_MINUTES;
  return Math.max(MIN_ALL_SLOT_MINUTES, Math.min(MAX_ALL_SLOT_MINUTES, n));
}

export const INTER_MODES: InterMode[] = [
  "all",
  ...PACK_MODES,
  ...ROTATE_MODE_IDS,
  ...FORCE_CARD_MODES,
];

export { isPackMode, PACK_MODES } from "./interAlgorithms.js";

export function isForceCardMode(v: unknown): v is ForceCardMode {  return (
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
  return (
    v === "app" ||
    v === "softapp" ||
    v === "user" ||
    v === "momentum" ||
    v === "fed" ||
    v === "softfed" ||
    v === "hedge" ||
    v === "contrarian" ||
    v === "sparse" ||
    v === "dense"
  );
}

export function isBiasMode(v: unknown): v is BiasMode {
  return (
    v === "auto" ||
    v === "small" ||
    v === "big" ||
    v === "flat" ||
    v === "cool"
  );
}

function rotatesLikeAll(mode: InterMode): mode is "all" | PackMode {
  return mode === "all" || isPackMode(mode);
}

export function isInterMode(v: unknown): v is InterMode {
  return (
    v === "all" ||
    isPackMode(v) ||
    isRotateMode(v) ||
    isForceCardMode(v)
  );
}
/** Mode ép thắng → id lá; còn lại null. */
export function forcedCardId(mode: InterMode): number | null {
  return isForceCardMode(mode) ? Number(mode) : null;
}

export interface VaultInterLink {
  enabled: boolean;
  lossThresholdXu: number;
  profitThresholdXu: number;
  onLossMode: InterMode;
  onProfitMode: InterMode;
}

export const DEFAULT_VAULT_INTER_LINK: VaultInterLink = {
  enabled: false,
  lossThresholdXu: 50_000,
  profitThresholdXu: 50_000,
  onLossMode: "small",
  onProfitMode: "big",
};

interface InterFile {
  version: 1 | 2 | 3 | 4;
  mode: InterMode;
  updatedAt: number;
  updatedBy: string;
  /** Phút mỗi slot khi mode = all (v2). */
  allSlotMinutes?: number;
  /** Chuỗi xoay tùy chỉnh khi mode = all (v3). */
  allRotation?: RotateMode[];
  /** Bias Big(+)/Small(−) % — v4 */
  winBiasPct?: number;
  vaultInterLink?: Partial<VaultInterLink>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "inter.json");
const TMP = join(DATA_DIR, "inter.json.tmp");

/**
 * Small = lá 1–4 xác suất cao hơn.
 * Big = lá 5–8 xác suất cao hơn.
 * Auto = weight gốc, không lệch nhóm.
 * Flat = cân đều mỗi lá.
 * Cool = giảm weight 3 lá thắng gần nhất (anti-streak).
 * App = hút xu mềm — ưu tiên lá trả thấp (vẫn random).
 * Hedge = soft-Fed — lệch mạnh theo house profit^2, vẫn random.
 * Fed = đọc cầu user đăng nhập → chọn lá app lời tối đa (cứng).
 * User = nhả xu — ưu tiên lá user thật trả thưởng cao.
 * ALL = xoay các mode tác động mỗi 5 phút.
 * 1–8 = ép thắng đúng lá đó (100%).
 */
const PREF_SHARE = 0.72;
const OTHER_SHARE = 0.28;

function clampWinBias(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-50, Math.min(50, Math.round(n)));
}

function mergeVaultLink(raw: Partial<VaultInterLink>): VaultInterLink {
  const d = DEFAULT_VAULT_INTER_LINK;
  const onLoss =
    raw.onLossMode && isInterMode(raw.onLossMode)
      ? raw.onLossMode
      : d.onLossMode;
  const onProfit =
    raw.onProfitMode && isInterMode(raw.onProfitMode)
      ? raw.onProfitMode
      : d.onProfitMode;
  return {
    enabled: !!raw.enabled,
    lossThresholdXu: Math.max(
      0,
      Math.floor(Number(raw.lossThresholdXu ?? d.lossThresholdXu) || 0),
    ),
    profitThresholdXu: Math.max(
      0,
      Math.floor(Number(raw.profitThresholdXu ?? d.profitThresholdXu) || 0),
    ),
    onLossMode: onLoss,
    onProfitMode: onProfit,
  };
}

/**
 * Áp winBiasPct lên weights: + → Big (5–8), − → Small (1–4).
 */
export function applyWinBiasToWeights(
  weights: number[],
  cardIds: number[],
  winBiasPct: number,
): number[] {
  const pct = clampWinBias(winBiasPct);
  if (pct === 0) return weights;
  const boost = 1 + Math.abs(pct) / 100;
  const cut = 1 / boost;
  return cardIds.map((id, i) => {
    const w = weights[i]!;
    const isBig = id >= 5;
    if (pct > 0) return isBig ? w * boost : w * cut;
    return isBig ? w * cut : w * boost;
  });
}

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
  private allSlotMinutes = DEFAULT_ALL_SLOT_MINUTES;
  /** null = dùng ALL_ROTATION mặc định */
  private allRotation: RotateMode[] | null = null;
  private lastLoggedEffective: string | null = null;
  /** −50…+50 — dương nghiêng Big (5–8), âm nghiêng Small (1–4) */
  private winBiasPct = 0;
  private vaultInterLink: VaultInterLink = {
    ...DEFAULT_VAULT_INTER_LINK,
  };
  /** Tránh spam setMode khi vault link giữ cùng mode */
  private lastVaultLinkApplied: string | null = null;

  getAllRotation(): RotateMode[] {
    if (isPackMode(this.mode)) return packRotation(this.mode);
    return this.allRotation?.length
      ? [...this.allRotation]
      : [...ALL_ROTATION];
  }

  private getRotationChain(): RotateMode[] {
    return this.getAllRotation();
  }

  private getAllSlotMs(): number {
    return this.allSlotMinutes * 60 * 1000;
  }

  getAllSlotMinutes(): number {
    return this.allSlotMinutes;
  }

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
      if (parsed?.version !== 1 && parsed?.version !== 2 && parsed?.version !== 3 && parsed?.version !== 4) {
        return;
      }
      if (isInterMode(parsed.mode)) this.mode = parsed.mode;
      if (typeof parsed.updatedAt === "number") this.updatedAt = parsed.updatedAt;
      if (typeof parsed.updatedBy === "string") this.updatedBy = parsed.updatedBy;
      if (parsed.allSlotMinutes != null) {
        this.allSlotMinutes = clampAllSlotMinutes(parsed.allSlotMinutes);
      }
      if (Array.isArray(parsed.allRotation) && parsed.allRotation.length > 0) {
        const v = validateAllRotation(parsed.allRotation);
        if (v.ok) this.allRotation = v.steps;
      }
      if (typeof parsed.winBiasPct === "number") {
        this.winBiasPct = clampWinBias(parsed.winBiasPct);
      }
      if (parsed.vaultInterLink && typeof parsed.vaultInterLink === "object") {
        this.vaultInterLink = mergeVaultLink(parsed.vaultInterLink);
      }
      const rot = this.getAllRotation();
      console.log(
        `[inter] Loaded mode=${this.mode} allSlot=${this.allSlotMinutes}m rotation=${rot.length} steps bias=${this.winBiasPct} vaultLink=${this.vaultInterLink.enabled}`,
      );
    } catch (err) {
      console.warn("[inter] Failed to load inter.json:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: InterFile = {
      version: 4,
      mode: this.mode,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
      allSlotMinutes: this.allSlotMinutes,
      winBiasPct: this.winBiasPct,
      vaultInterLink: { ...this.vaultInterLink },
      ...(this.allRotation?.length
        ? { allRotation: [...this.allRotation] }
        : {}),
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
   * ALL → xoay theo slot; traffic cao → điều chỉnh nhẹ mode slot.
   */
  getEffectiveMode(traffic?: {
    authStake: number;
    displayStake: number;
  }): Exclude<InterMode, "all" | PackMode> {
    if (!rotatesLikeAll(this.mode)) {
      return this.mode as Exclude<InterMode, "all" | PackMode>;
    }
    const slotMs = this.getAllSlotMs();
    const anchor = this.updatedAt || Date.now();
    const elapsed = Math.max(0, Date.now() - anchor);
    const chain = this.getRotationChain();
    const idx = Math.floor(elapsed / slotMs) % chain.length;
    let eff = chain[idx]!;
    if (traffic) {
      eff = adaptAllEffectiveMode(eff, traffic);
    }
    return eff;
  }

  /** Gọi định kỳ — log khi ALL / Bộ mode đổi slot. */
  tickRotation() {
    if (!rotatesLikeAll(this.mode)) {
      this.lastLoggedEffective = null;
      return;
    }
    const eff = this.getEffectiveMode();
    if (eff !== this.lastLoggedEffective) {
      const snap = this.getRotationInfo();
      const tag = isPackMode(this.mode) ? this.mode.toUpperCase() : "ALL";
      console.log(
        `[inter:${tag}] slot → ${eff} · còn ~${Math.ceil(snap.remainingMs / 1000)}s · tiếp ${snap.nextMode}`,
      );
      this.lastLoggedEffective = eff;
    }
  }

  getRotationInfo() {
    const chain = this.getRotationChain();
    const slotMs = this.getAllSlotMs();
    const anchor = this.updatedAt || Date.now();
    const elapsed = Math.max(0, Date.now() - anchor);
    const idx = Math.floor(elapsed / slotMs) % chain.length;
    const intoSlot = elapsed % slotMs;
    const remainingMs = slotMs - intoSlot;
    const nextIdx = (idx + 1) % chain.length;
    return {
      rotation: [...chain],
      slotMs,
      slotMinutes: this.allSlotMinutes,
      slotIndex: idx,
      effectiveMode: chain[idx]!,
      nextMode: chain[nextIdx]!,
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

  setAllSlotMinutes(
    minutes: number,
    byUsername: string,
  ): { ok: true; allSlotMinutes: number } | { ok: false; reason: string } {
    const next = clampAllSlotMinutes(minutes);
    this.allSlotMinutes = next;
    this.updatedBy = byUsername;
    if (rotatesLikeAll(this.mode)) {
      this.updatedAt = Date.now();
      this.lastLoggedEffective = null;
    }
    this.save();
    console.log(`[inter] ALL slot → ${next} phút by ${byUsername}`);
    return { ok: true, allSlotMinutes: next };
  }

  setAllRotation(
    steps: RotateMode[],
    byUsername: string,
  ): { ok: true; allRotation: RotateMode[] } | { ok: false; reason: string } {
    const v = validateAllRotation(steps);
    if (!v.ok) return v;
    this.allRotation = v.steps;
    this.updatedBy = byUsername;
    if (rotatesLikeAll(this.mode)) {
      this.updatedAt = Date.now();
      this.lastLoggedEffective = null;
    }
    this.save();
    console.log(
      `[inter] ALL rotation → [${v.steps.join("→")}] by ${byUsername}`,
    );
    return { ok: true, allRotation: this.getAllRotation() };
  }

  resetAllRotationToDefault(byUsername: string) {
    return this.setAllRotation([...ALL_ROTATION], byUsername);
  }

  getWinBiasPct(): number {
    return this.winBiasPct;
  }

  setWinBiasPct(pct: number, byUsername: string) {
    this.winBiasPct = clampWinBias(pct);
    this.updatedAt = Date.now();
    this.updatedBy = byUsername;
    this.save();
    return { ok: true as const, winBiasPct: this.winBiasPct };
  }

  getVaultInterLink(): VaultInterLink {
    return { ...this.vaultInterLink };
  }

  setVaultInterLink(
    partial: Partial<VaultInterLink>,
    byUsername: string,
  ) {
    this.vaultInterLink = mergeVaultLink({
      ...this.vaultInterLink,
      ...partial,
    });
    this.updatedAt = Date.now();
    this.updatedBy = byUsername;
    this.lastVaultLinkApplied = null;
    this.save();
    return { ok: true as const, vaultInterLink: this.getVaultInterLink() };
  }

  /**
   * Theo netFromPlay Kho Tarot: lỗ nặng → onLossMode, lãi nhiều → onProfitMode.
   * Gọi định kỳ; không đụng mode nếu link tắt hoặc trong khoảng ngưỡng.
   */
  applyVaultNet(netFromPlay: number): {
    applied: boolean;
    mode?: InterMode;
    reason: string;
  } {
    const link = this.vaultInterLink;
    if (!link.enabled) {
      return { applied: false, reason: "vault link tắt" };
    }
    let target: InterMode | null = null;
    if (netFromPlay <= -link.lossThresholdXu) {
      target = link.onLossMode;
    } else if (netFromPlay >= link.profitThresholdXu) {
      target = link.onProfitMode;
    }
    if (!target) {
      return { applied: false, reason: "trong ngưỡng trung tính" };
    }
    const key = `${target}:${Math.sign(netFromPlay)}`;
    if (this.lastVaultLinkApplied === key && this.mode === target) {
      return { applied: false, reason: "đã áp cùng mode", mode: target };
    }
    this.setMode(target, "vault-auto");
    this.lastVaultLinkApplied = key;
    return { applied: true, mode: target, reason: `netFromPlay=${netFromPlay}` };
  }

  getSnapshot() {
    const effectiveMode = this.getEffectiveMode();
    const chain = this.getAllRotation();
    const rotation =
      rotatesLikeAll(this.mode)
        ? this.getRotationInfo()
        : {
            rotation: [...chain],
            slotMs: this.getAllSlotMs(),
            slotMinutes: this.allSlotMinutes,
            slotIndex: 0,
            effectiveMode,
            nextMode: chain[1] ?? chain[0]!,
            remainingMs: 0,
            nextRotateAt: 0,
          };

    const packLabels = Object.fromEntries(
      (Object.keys(MODE_PACK_LABELS) as PackMode[]).map((p) => [
        p,
        MODE_PACK_LABELS[p],
      ]),
    ) as Record<PackMode, string>;

    return {
      mode: this.mode,
      effectiveMode,
      allSlotMinutes: this.allSlotMinutes,
      allRotation: [...chain],
      defaultRotation: [...ALL_ROTATION],
      winBiasPct: this.winBiasPct,
      vaultInterLink: this.getVaultInterLink(),
      rotateCatalog: ROTATE_MODE_IDS.map((id) => ({
        id,
        label: ROTATE_LABELS[id],
      })),
      modePacks: PACK_MODES.map((p) => ({
        id: p,
        label: MODE_PACK_LABELS[p],
        rotation: [...MODE_PACK_ROTATIONS[p]],
      })),
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
      labels: {
        all: `ALL — xoay ${chain.join("→")} (mỗi ${this.allSlotMinutes} phút/slot)`,
        ...ROTATE_LABELS,
        ...packLabels,
        ...FORCE_LABELS,
      } as Record<string, string>,
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
  if (mode === "all" || isPackMode(mode)) {
    return [...baseWeights];
  }

  const forced = forcedCardId(mode);
  if (forced != null) {
    return cardIds.map((id) => (id === forced ? 100 : 0));
  }

  if (
    mode === "auto" ||
    mode === "flat" ||
    mode === "cool" ||
    isPolicyMode(mode)
  ) {
    return [...baseWeights];
  }

  const prefSets: Record<string, Set<number>> = {
    small: new Set([1, 2, 3, 4]),
    big: new Set([5, 6, 7, 8]),
    mid: new Set([3, 4, 5, 6]),
    lowmult: new Set([1, 2, 3, 4]),
    highmult: new Set([5, 6, 7, 8]),
  };
  const prefIds = prefSets[mode];
  if (!prefIds) return [...baseWeights];

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
