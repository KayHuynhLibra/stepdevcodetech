import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { ITEM_XU_MAX, MIN_STAKE } from "./types.js";
import { levelPartsStore } from "./levelPartsStore.js";

/** Trần giá nhẫn — tối đa 12 chữ số. */
export const RING_XU_MAX = ITEM_XU_MAX;

export type RingEffect = "none" | "glow" | "pulse" | "sparkle" | "orbit";

export type RingCategory = "classic" | "luxury" | "romance" | "legend";

/** Khung đại diện cặp đôi (avatar + oval). */
export type CoupleFrameStyle =
  | "bronze"
  | "gold"
  | "rose"
  | "rainbow"
  | "midnight"
  | "jade"
  | "obsidian"
  | "pearl";

/** Kiểu viền khung avatar. */
export type CoupleBorderStyle =
  | "classic"
  | "double"
  | "ornate"
  | "thin"
  | "crystal"
  | "flame";

/** Mức phóng khung couple. */
export type CoupleFrameScale = "sm" | "md" | "lg" | "xl";

/** Động khung couple. */
export type CoupleMotion = "none" | "breathe" | "sway" | "drift" | "sparkle";

/** Khoảng cách / độ rộng layout couple. */
export type CoupleGap = "tight" | "normal" | "wide" | "span";

/** Bố cục couple. */
export type CoupleLayout =
  | "classic"
  | "heart_arch"
  | "banner"
  | "nest"
  | "orbit";

/** Khung pedestal nhẫn. */
export type RingFrameStyle =
  | "classic"
  | "crystal"
  | "gothic"
  | "celestial"
  | "flame"
  | "void"
  | "ornate"
  | "heart"
  | "heart_wide"
  | "diamond"
  | "hex"
  | "shield"
  | "clover"
  | "petal";

export type RingFrameScale = "xs" | "sm" | "md" | "lg" | "xl";

export const RING_EFFECTS: RingEffect[] = [
  "none",
  "glow",
  "pulse",
  "sparkle",
  "orbit",
];

export const COUPLE_FRAMES: CoupleFrameStyle[] = [
  "bronze",
  "gold",
  "rose",
  "rainbow",
  "midnight",
  "jade",
  "obsidian",
  "pearl",
];

export const COUPLE_BORDERS: CoupleBorderStyle[] = [
  "classic",
  "double",
  "ornate",
  "thin",
  "crystal",
  "flame",
];

export const COUPLE_SCALES: CoupleFrameScale[] = ["sm", "md", "lg", "xl"];

export const COUPLE_MOTIONS: CoupleMotion[] = [
  "none",
  "breathe",
  "sway",
  "drift",
  "sparkle",
];

export const COUPLE_GAPS: CoupleGap[] = ["tight", "normal", "wide", "span"];

export const COUPLE_LAYOUTS: CoupleLayout[] = [
  "classic",
  "heart_arch",
  "banner",
  "nest",
  "orbit",
];

export const RING_FRAMES: RingFrameStyle[] = [
  "classic",
  "crystal",
  "gothic",
  "celestial",
  "flame",
  "void",
  "ornate",
  "heart",
  "heart_wide",
  "diamond",
  "hex",
  "shield",
  "clover",
  "petal",
];

export const RING_FRAME_SCALES: RingFrameScale[] = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
];

export const RING_CATEGORIES: { id: RingCategory; label: string }[] = [
  { id: "classic", label: "Cổ điển" },
  { id: "luxury", label: "Xa xỉ" },
  { id: "romance", label: "Lãng mạn" },
  { id: "legend", label: "Huyền thoại" },
];

const RING_CATEGORY_IDS: RingCategory[] = [
  "classic",
  "luxury",
  "romance",
  "legend",
];

export interface RingItem {
  key: string;
  nameVi: string;
  /** Path `/assets/...` hoặc emoji (không bắt đầu bằng `/`) */
  image: string;
  price: number;
  blurb?: string;
  enabled: boolean;
  sort: number;
  category: RingCategory;
  /** catalog = mẫu shop; custom = nhẫn riêng của 1 cặp */
  kind: "catalog" | "custom";
  /** Bond sở hữu nhẫn custom */
  ownerBondId?: string;
  /** Hiệu ứng hiển thị trên avatar cặp */
  effect: RingEffect;
  /** Độ nét / phóng ảnh nhẫn 0–100 (mặc định 70) */
  imageSharpness: number;
  /** Style màu khung couple khi đeo nhẫn này */
  coupleFrame: CoupleFrameStyle;
  /** Kiểu viền khung avatar */
  coupleBorder: CoupleBorderStyle;
  /** Mức to nhỏ khung couple */
  coupleScale: CoupleFrameScale;
  /** Hiệu ứng động khung couple */
  coupleMotion: CoupleMotion;
  /** Độ rộng khoảng cách couple */
  coupleGap: CoupleGap;
  /** Bố cục couple */
  coupleLayout: CoupleLayout;
  /** Style khung pedestal nhẫn */
  ringFrame: RingFrameStyle;
  /** Scale rộng/hẹp khung nhẫn */
  ringFrameScale: RingFrameScale;
}

export type BondStatus = "pending" | "active";

export interface Bond {
  id: string;
  aUserId: string;
  bUserId: string;
  ringKey: string;
  status: BondStatus;
  proposedBy: string;
  proposedAt: number;
  acceptedAt?: number;
  note?: string;
  /** Chữ giữa tên cặp (chỉ Kim Cương) */
  couplePhrase?: string;
  /** Mã cặp đôi công khai (sau khi lên nhẫn) */
  coupleCode?: string;
  /** Xu đã trả cho nhẫn (metric Couple LV) */
  coupleXu?: number;
  /** Khóa đổi thiết kế — chỉ mainadmin mới sửa được */
  designLocked?: boolean;
  /** Lịch sử ringKey đã đeo (mới nhất trước) */
  ringHistory?: string[];
}

export interface RingStoreSnapshot {
  version: 1;
  rings: RingItem[];
  bonds: Bond[];
  updatedAt: number;
}

export interface BondPartnerPublic {
  id: string;
  code: string;
  username: string;
  displayName: string;
  avatar: string;
}

export interface ActiveBondPublic {
  partner: BondPartnerPublic;
  ring: {
    key: string;
    nameVi: string;
    image: string;
    effect: RingEffect;
    imageSharpness: number;
    coupleFrame: CoupleFrameStyle;
    coupleBorder: CoupleBorderStyle;
    coupleScale: CoupleFrameScale;
    coupleMotion: CoupleMotion;
    coupleGap: CoupleGap;
    coupleLayout: CoupleLayout;
    ringFrame: RingFrameStyle;
    ringFrameScale: RingFrameScale;
  };
  since: number;
}

export interface UserBondSnippet {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  partnerAvatar: string;
  ringKey: string;
  ringNameVi: string;
  ringImage: string;
  ringEffect: RingEffect;
  ringSharpness: number;
  coupleFrame: CoupleFrameStyle;
  coupleBorder: CoupleBorderStyle;
  coupleScale: CoupleFrameScale;
  coupleMotion: CoupleMotion;
  coupleGap: CoupleGap;
  coupleLayout: CoupleLayout;
  ringFrame: RingFrameStyle;
  ringFrameScale: RingFrameScale;
  couplePhrase?: string;
  /** Mã cặp đôi (active) */
  coupleCode?: string;
  /** Xu nhẫn (metric Couple LV) */
  coupleXu?: number;
  /** Couple LV từ công thức part couple */
  coupleLevel?: number;
  since: number;
  status: BondStatus;
}

/** Hàng quản trị cặp / lời cầu hôn. */
export interface BondAdminRow {
  id: string;
  status: BondStatus;
  ringKey: string;
  ringNameVi: string;
  ringPrice: number;
  ringImage: string;
  ringEffect?: RingEffect;
  proposedBy: string;
  proposedAt: number;
  acceptedAt?: number;
  note?: string;
  couplePhrase?: string;
  coupleCode?: string;
  coupleXu?: number;
  coupleLevel?: number;
  designLocked?: boolean;
  ringHistory?: string[];
  a: BondPartnerPublic;
  b: BondPartnerPublic;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "rings.json");
const TMP = join(DATA_DIR, "rings.json.tmp");

export const DEFAULT_RINGS: RingItem[] = [
  {
    key: "silver",
    nameVi: "Nhẫn bạc",
    image: "/assets/rings/ring-silver.svg",
    price: 1_000,
    blurb: "Khởi đầu nhẹ nhàng",
    enabled: true,
    sort: 10,
    kind: "catalog",
    category: "classic",
    effect: "glow",
    imageSharpness: 75,
    coupleFrame: "bronze",
    coupleBorder: "classic",
    coupleScale: "md",
    coupleMotion: "breathe",
    coupleGap: "normal",
    coupleLayout: "classic",
    ringFrame: "classic",
    ringFrameScale: "md",
  },
  {
    key: "gold",
    nameVi: "Nhẫn vàng",
    image: "/assets/rings/ring-gold.svg",
    price: 5_000,
    blurb: "Ánh vàng ấm",
    enabled: true,
    sort: 20,
    kind: "catalog",
    category: "luxury",
    effect: "pulse",
    imageSharpness: 80,
    coupleFrame: "gold",
    coupleBorder: "double",
    coupleScale: "lg",
    coupleMotion: "sway",
    coupleGap: "wide",
    coupleLayout: "banner",
    ringFrame: "ornate",
    ringFrameScale: "lg",
  },
  {
    key: "rose",
    nameVi: "Nhẫn hồng",
    image: "/assets/rings/ring-rose.svg",
    price: 10_000,
    blurb: "Hồng lãng mạn",
    enabled: true,
    sort: 30,
    kind: "catalog",
    category: "romance",
    effect: "sparkle",
    imageSharpness: 85,
    coupleFrame: "rose",
    coupleBorder: "ornate",
    coupleScale: "lg",
    coupleMotion: "drift",
    coupleGap: "wide",
    coupleLayout: "heart_arch",
    ringFrame: "heart",
    ringFrameScale: "lg",
  },
  {
    key: "diamond",
    nameVi: "Kim cương",
    image: "/assets/rings/ring-diamond.svg",
    price: 50_000,
    blurb: "Đỉnh cao · chữ tuỳ chỉnh A — … — B",
    enabled: true,
    sort: 40,
    kind: "catalog",
    category: "legend",
    effect: "orbit",
    imageSharpness: 95,
    coupleFrame: "rainbow",
    coupleBorder: "crystal",
    coupleScale: "xl",
    coupleMotion: "sparkle",
    coupleGap: "span",
    coupleLayout: "orbit",
    ringFrame: "heart_wide",
    ringFrameScale: "xl",
  },
];

function defaultCategoryForKey(key: string): RingCategory {
  if (key === "silver") return "classic";
  if (key === "gold") return "luxury";
  if (key === "rose") return "romance";
  if (key === "diamond") return "legend";
  return "classic";
}

function defaultFrameForCategory(cat: RingCategory): CoupleFrameStyle {
  switch (cat) {
    case "luxury":
      return "gold";
    case "romance":
      return "rose";
    case "legend":
      return "rainbow";
    default:
      return "bronze";
  }
}

function isRingCategory(v: unknown): v is RingCategory {
  return typeof v === "string" && (RING_CATEGORY_IDS as string[]).includes(v);
}

function normalizeCategory(raw: unknown, key: string): RingCategory {
  if (isRingCategory(raw)) return raw;
  return defaultCategoryForKey(key);
}

function normalizeCoupleFrame(
  raw: unknown,
  category: RingCategory,
): CoupleFrameStyle {
  const s = String(raw ?? "").trim().toLowerCase();
  if (COUPLE_FRAMES.includes(s as CoupleFrameStyle)) {
    return s as CoupleFrameStyle;
  }
  return defaultFrameForCategory(category);
}

function normalizeCoupleBorder(raw: unknown): CoupleBorderStyle {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_BORDERS.includes(s as CoupleBorderStyle)
    ? (s as CoupleBorderStyle)
    : "classic";
}

function normalizeCoupleScale(raw: unknown): CoupleFrameScale {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_SCALES.includes(s as CoupleFrameScale)
    ? (s as CoupleFrameScale)
    : "md";
}

function normalizeCoupleMotion(raw: unknown): CoupleMotion {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_MOTIONS.includes(s as CoupleMotion)
    ? (s as CoupleMotion)
    : "none";
}

function normalizeCoupleGap(raw: unknown): CoupleGap {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_GAPS.includes(s as CoupleGap) ? (s as CoupleGap) : "normal";
}

function normalizeRingFrame(raw: unknown): RingFrameStyle {
  const s = String(raw ?? "").trim().toLowerCase();
  return RING_FRAMES.includes(s as RingFrameStyle)
    ? (s as RingFrameStyle)
    : "classic";
}

function normalizeRingFrameScale(raw: unknown): RingFrameScale {
  const s = String(raw ?? "").trim().toLowerCase();
  return RING_FRAME_SCALES.includes(s as RingFrameScale)
    ? (s as RingFrameScale)
    : "md";
}

function normalizeCoupleLayout(raw: unknown): CoupleLayout {
  const s = String(raw ?? "").trim().toLowerCase();
  return COUPLE_LAYOUTS.includes(s as CoupleLayout)
    ? (s as CoupleLayout)
    : "classic";
}

function clampRingPrice(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return MIN_STAKE;
  return Math.max(MIN_STAKE, Math.min(RING_XU_MAX, v));
}

function clampSharpness(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 70;
  return Math.max(0, Math.min(100, v));
}

function normalizeEffect(raw: unknown): RingEffect {
  const s = String(raw ?? "").trim().toLowerCase();
  return RING_EFFECTS.includes(s as RingEffect) ? (s as RingEffect) : "glow";
}

function normalizeKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizeImage(raw: unknown): string {
  const s = String(raw ?? "").trim().slice(0, 200);
  if (!s) return "💍";
  return s;
}

function fallbackRing(key: string): RingItem {
  const category = defaultCategoryForKey(key);
  return {
    key,
    nameVi: key,
    image: "💍",
    price: 0,
    enabled: true,
    sort: 0,
    kind: key.startsWith("c_") || key.startsWith("custom_") ? "custom" : "catalog",
    category,
    effect: "glow",
    imageSharpness: 70,
    coupleFrame: defaultFrameForCategory(category),
    coupleBorder: "classic",
    coupleScale: "md",
    coupleMotion: "none",
    coupleGap: "normal",
    coupleLayout: "classic",
    ringFrame: "classic",
    ringFrameScale: "md",
  };
}

function normalizeRingKind(raw: unknown, key: string): "catalog" | "custom" {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "custom") return "custom";
  if (s === "catalog") return "catalog";
  if (key.startsWith("c_") || key.startsWith("custom_")) return "custom";
  return "catalog";
}

function normalizeRing(raw: unknown): RingItem | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<RingItem> & { kind?: string; ownerBondId?: string };
  const key = normalizeKey(g.key);
  if (!key) return null;
  const nameVi = String(g.nameVi ?? "").trim().slice(0, 40) || key;
  const blurb =
    typeof g.blurb === "string" ? g.blurb.trim().slice(0, 80) : undefined;
  const sort = Math.floor(Number(g.sort));
  const category = normalizeCategory(g.category, key);
  const kind = normalizeRingKind(g.kind, key);
  const ownerBondId =
    kind === "custom"
      ? String(g.ownerBondId ?? "").trim() || undefined
      : undefined;
  return {
    key,
    nameVi,
    image: normalizeImage(g.image),
    price: clampRingPrice(g.price),
    blurb: blurb || undefined,
    enabled: g.enabled !== false,
    sort: Number.isFinite(sort) ? sort : 100,
    kind,
    ownerBondId,
    category,
    effect: normalizeEffect(g.effect),
    imageSharpness: clampSharpness(g.imageSharpness),
    coupleFrame: normalizeCoupleFrame(g.coupleFrame, category),
    coupleBorder: normalizeCoupleBorder(g.coupleBorder),
    coupleScale: normalizeCoupleScale(g.coupleScale),
    coupleMotion: normalizeCoupleMotion(g.coupleMotion),
    coupleGap: normalizeCoupleGap(g.coupleGap),
    coupleLayout: normalizeCoupleLayout(g.coupleLayout),
    ringFrame: normalizeRingFrame(g.ringFrame),
    ringFrameScale: normalizeRingFrameScale(g.ringFrameScale),
  };
}

function normalizeCoupleCode(raw: unknown): string | undefined {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return s || undefined;
}

function newCoupleCode(used: Set<string>): string {
  for (let i = 0; i < 24; i++) {
    const code = `CP${randomBytes(3).toString("hex").toUpperCase()}`;
    if (!used.has(code)) return code;
  }
  return `CP${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function normalizeBond(raw: unknown): Bond | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Partial<Bond>;
  const id = String(b.id ?? "").trim();
  const aUserId = String(b.aUserId ?? "").trim();
  const bUserId = String(b.bUserId ?? "").trim();
  const ringKey = normalizeKey(b.ringKey);
  const proposedBy = String(b.proposedBy ?? "").trim();
  if (!id || !aUserId || !bUserId || !ringKey || !proposedBy) return null;
  if (aUserId === bUserId) return null;
  const status: BondStatus = b.status === "active" ? "active" : "pending";
  const proposedAt = Math.floor(Number(b.proposedAt)) || Date.now();
  const acceptedAt = b.acceptedAt != null ? Math.floor(Number(b.acceptedAt)) : undefined;
  const note =
    typeof b.note === "string" ? b.note.trim().slice(0, 80) : undefined;
  const couplePhrase = normalizeCouplePhrase(b.couplePhrase);
  const coupleCode = normalizeCoupleCode(b.coupleCode);
  const coupleXuRaw = Math.floor(Number(b.coupleXu));
  const coupleXu =
    Number.isFinite(coupleXuRaw) && coupleXuRaw > 0 ? coupleXuRaw : undefined;
  const designLocked = b.designLocked === true;
  const ringHistory = Array.isArray(b.ringHistory)
    ? b.ringHistory
        .map((k) => normalizeKey(k))
        .filter((k): k is string => !!k)
        .filter((k, i, arr) => arr.indexOf(k) === i)
        .slice(0, 12)
    : undefined;
  return {
    id,
    aUserId,
    bUserId,
    ringKey,
    status,
    proposedBy,
    proposedAt,
    acceptedAt: acceptedAt && acceptedAt > 0 ? acceptedAt : undefined,
    note: note || undefined,
    couplePhrase: couplePhrase || undefined,
    coupleCode: status === "active" ? coupleCode : undefined,
    coupleXu,
    designLocked: designLocked || undefined,
    ringHistory: ringHistory?.length ? ringHistory : undefined,
  };
}

function pushRingHistory(bond: Bond, prevKey: string) {
  const k = normalizeKey(prevKey);
  if (!k) return;
  const next = [k, ...(bond.ringHistory ?? []).filter((x) => x !== k)];
  bond.ringHistory = next.slice(0, 12);
}

function assignBondRingKey(bond: Bond, nextKey: string) {
  const k = normalizeKey(nextKey);
  if (!k || bond.ringKey === k) return;
  pushRingHistory(bond, bond.ringKey);
  bond.ringKey = k;
}

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, path);
}

function newBondId(): string {
  return `rb_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function bondInvolves(bond: Bond, userId: string): boolean {
  return bond.aUserId === userId || bond.bUserId === userId;
}

export const COUPLE_PHRASE_MAX = 20;
export const COUPLE_PHRASE_DEFAULT = "Với";

export function ringAllowsCustomPhrase(ringKey: unknown): boolean {
  const k = String(ringKey ?? "")
    .trim()
    .toLowerCase();
  return k === "diamond" || k.startsWith("diamond_");
}

export function normalizeCouplePhrase(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, COUPLE_PHRASE_MAX);
  return s.replace(/[<>{}[\]\\|`]/g, "").trim();
}

export function coupleWithLabel(phrase?: string | null): string {
  const p = normalizeCouplePhrase(phrase);
  return p || COUPLE_PHRASE_DEFAULT;
}

class RingStore {
  private rings: RingItem[] = DEFAULT_RINGS.map((r) => ({ ...r }));
  private bonds: Bond[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        console.log("[rings] Created rings.json with defaults");
        return;
      }
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as Partial<RingStoreSnapshot>;
      const rings = Array.isArray(parsed.rings)
        ? parsed.rings.map(normalizeRing).filter((x): x is RingItem => !!x)
        : [];
      const bonds = Array.isArray(parsed.bonds)
        ? parsed.bonds.map(normalizeBond).filter((x): x is Bond => !!x)
        : [];
      if (rings.length) this.rings = rings;
      this.bonds = bonds;
      let dirty = false;
      const usedCodes = new Set(
        this.bonds.map((b) => b.coupleCode).filter(Boolean) as string[],
      );
      for (const b of this.bonds) {
        if (b.status === "active" && !b.coupleCode) {
          b.coupleCode = newCoupleCode(usedCodes);
          usedCodes.add(b.coupleCode);
          dirty = true;
        }
      }
      for (const r of this.rings) {
        if (!r.kind) {
          (r as RingItem).kind = normalizeRingKind(undefined, r.key);
          dirty = true;
        }
      }
      if (dirty) this.save();
      console.log(
        `[rings] Loaded ${this.rings.length} rings · ${this.bonds.length} bonds`,
      );
    } catch (err) {
      console.warn("[rings] Failed to load rings.json:", err);
      this.rings = DEFAULT_RINGS.map((r) => ({ ...r }));
      this.bonds = [];
    }
  }

  private save() {
    try {
      atomicWrite(PATH, this.snapshot());
    } catch (err) {
      console.warn("[rings] Failed to save rings.json:", err);
    }
  }

  /** Catalog shop — chỉ mẫu mặc định (không gồm nhẫn riêng cặp). */
  publicCatalog(): RingItem[] {
    return this.rings
      .filter((r) => r.enabled && (r.kind ?? "catalog") === "catalog")
      .map((r) => ({ ...r }))
      .sort((a, b) => a.sort - b.sort || a.price - b.price || a.key.localeCompare(b.key));
  }

  /** Toàn bộ nhẫn (catalog + custom) — admin. */
  adminCatalog(): RingItem[] {
    return this.rings
      .map((r) => ({ ...r }))
      .sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
  }

  getByKey(key: string): RingItem | undefined {
    const k = normalizeKey(key);
    const g = this.rings.find((x) => x.key === k);
    return g ? { ...g } : undefined;
  }

  snapshot(): RingStoreSnapshot {
    return {
      version: 1,
      rings: this.rings.map((r) => ({ ...r })),
      bonds: this.bonds.map((b) => ({ ...b })),
      updatedAt: Date.now(),
    };
  }

  upsertRing(
    raw: unknown,
  ): { ok: true; ring: RingItem } | { ok: false; reason: string } {
    const ring = normalizeRing(raw);
    if (!ring) return { ok: false, reason: "Nhẫn không hợp lệ (thiếu key)" };
    const idx = this.rings.findIndex((g) => g.key === ring.key);
    if (idx >= 0) this.rings[idx] = ring;
    else this.rings.push(ring);
    this.save();
    return { ok: true, ring: { ...ring } };
  }

  setEnabled(
    key: string,
    enabled: boolean,
  ): { ok: true; ring: RingItem } | { ok: false; reason: string } {
    const k = normalizeKey(key);
    const g = this.rings.find((x) => x.key === k);
    if (!g) return { ok: false, reason: "Không tìm thấy nhẫn" };
    g.enabled = !!enabled;
    this.save();
    return { ok: true, ring: { ...g } };
  }

  removeRing(
    key: string,
  ): { ok: true; key: string } | { ok: false; reason: string } {
    const k = normalizeKey(key);
    const before = this.rings.length;
    this.rings = this.rings.filter((g) => g.key !== k);
    if (this.rings.length === before) {
      return { ok: false, reason: "Không tìm thấy nhẫn" };
    }
    this.save();
    return { ok: true, key: k };
  }

  getBondByUser(userId: string): Bond | undefined {
    const id = String(userId ?? "").trim();
    if (!id) return undefined;
    const active = this.bonds.find(
      (b) => b.status === "active" && bondInvolves(b, id),
    );
    if (active) return { ...active };
    const pending = this.bonds.find(
      (b) => b.status === "pending" && bondInvolves(b, id),
    );
    return pending ? { ...pending } : undefined;
  }

  getBondById(bondId: string): Bond | undefined {
    const id = String(bondId ?? "").trim();
    const b = this.bonds.find((x) => x.id === id);
    return b ? { ...b } : undefined;
  }

  /** Active bond + partner/ring resolved live. */
  getActiveBondPublic(
    userId: string,
    resolveUser: (id: string) => BondPartnerPublic | null,
  ): ActiveBondPublic | null {
    const id = String(userId ?? "").trim();
    if (!id) return null;
    const bond = this.bonds.find(
      (b) => b.status === "active" && bondInvolves(b, id),
    );
    if (!bond) return null;
    const partnerId = bond.aUserId === id ? bond.bUserId : bond.aUserId;
    const partner = resolveUser(partnerId);
    if (!partner) return null;
    const ring = this.getByKey(bond.ringKey) ?? fallbackRing(bond.ringKey);
    return {
      partner: { ...partner },
      ring: {
        key: ring.key,
        nameVi: ring.nameVi,
        image: ring.image,
        effect: ring.effect,
        imageSharpness: ring.imageSharpness,
        coupleFrame: ring.coupleFrame,
        coupleBorder: ring.coupleBorder,
        coupleScale: ring.coupleScale,
        coupleMotion: ring.coupleMotion,
        coupleGap: ring.coupleGap,
        coupleLayout: ring.coupleLayout,
        ringFrame: ring.ringFrame,
        ringFrameScale: ring.ringFrameScale,
      },
      since: bond.acceptedAt ?? bond.proposedAt,
    };
  }

  /**
   * Snippet gắn PublicUser.
   * Active: luôn có. Pending: chỉ khi includePending (self /me).
   */
  bondSnippetFor(
    userId: string,
    resolveUser: (id: string) => BondPartnerPublic | null,
    opts?: { includePending?: boolean },
  ): UserBondSnippet | undefined {
    const id = String(userId ?? "").trim();
    if (!id) return undefined;
    const active = this.getActiveBondPublic(id, resolveUser);
    if (active) {
      const raw = this.bonds.find(
        (b) => b.status === "active" && bondInvolves(b, id),
      );
      const phrase = normalizeCouplePhrase(raw?.couplePhrase);
      return {
        partnerId: active.partner.id,
        partnerCode: active.partner.code,
        partnerName: active.partner.displayName || active.partner.username,
        partnerAvatar: active.partner.avatar,
        ringKey: active.ring.key,
        ringNameVi: active.ring.nameVi,
        ringImage: active.ring.image,
        ringEffect: active.ring.effect,
        ringSharpness: active.ring.imageSharpness,
        coupleFrame: active.ring.coupleFrame,
        coupleBorder: active.ring.coupleBorder,
        coupleScale: active.ring.coupleScale,
        coupleMotion: active.ring.coupleMotion,
        coupleGap: active.ring.coupleGap,
        coupleLayout: active.ring.coupleLayout,
        ringFrame: active.ring.ringFrame,
        ringFrameScale: active.ring.ringFrameScale,
        couplePhrase: phrase || undefined,
        coupleCode: raw?.coupleCode,
        coupleXu: (() => {
          const fromBond = Math.floor(Number(raw?.coupleXu) || 0);
          if (fromBond > 0) return fromBond;
          const price = Math.floor(
            Number(this.getByKey(active.ring.key)?.price) || 0,
          );
          return price > 0 ? price : undefined;
        })(),
        coupleLevel: levelPartsStore.coupleLevelFromXu(
          Math.floor(Number(raw?.coupleXu) || 0) ||
            Math.floor(Number(this.getByKey(active.ring.key)?.price) || 0),
        ),
        since: active.since,
        status: "active",
      };
    }
    if (!opts?.includePending) return undefined;
    const pending = this.bonds.find(
      (b) => b.status === "pending" && bondInvolves(b, id),
    );
    if (!pending) return undefined;
    const partnerId =
      pending.aUserId === id ? pending.bUserId : pending.aUserId;
    const partner = resolveUser(partnerId);
    if (!partner) return undefined;
    const ring = this.getByKey(pending.ringKey) ?? fallbackRing(pending.ringKey);
    return {
      partnerId: partner.id,
      partnerCode: partner.code,
      partnerName: partner.displayName || partner.username,
      partnerAvatar: partner.avatar,
      ringKey: ring.key,
      ringNameVi: ring.nameVi,
      ringImage: ring.image,
      ringEffect: ring.effect,
      ringSharpness: ring.imageSharpness,
      coupleFrame: ring.coupleFrame,
      coupleBorder: ring.coupleBorder,
      coupleScale: ring.coupleScale,
      coupleMotion: ring.coupleMotion,
      coupleGap: ring.coupleGap,
      coupleLayout: ring.coupleLayout,
      ringFrame: ring.ringFrame,
      ringFrameScale: ring.ringFrameScale,
      since: pending.proposedAt,
      status: "pending",
    };
  }

  private hasBlockingBond(userId: string): boolean {
    return this.bonds.some(
      (b) =>
        bondInvolves(b, userId) &&
        (b.status === "active" || b.status === "pending"),
    );
  }

  /**
   * Tạo pending bond. Caller trừ xu trước/sau theo price trả về.
   * fromId đã resolve; toUserId đã resolve (không self).
   */
  propose(opts: {
    fromId: string;
    toUserId: string;
    ringKey: string;
    note?: string;
  }):
    | { ok: true; bond: Bond; price: number; ring: RingItem }
    | { ok: false; reason: string } {
    const fromId = String(opts.fromId ?? "").trim();
    const toUserId = String(opts.toUserId ?? "").trim();
    if (!fromId || !toUserId) {
      return { ok: false, reason: "Thiếu người gửi / nhận" };
    }
    if (fromId === toUserId) {
      return { ok: false, reason: "Không thể cầu hôn chính mình" };
    }
    const ring = this.getByKey(opts.ringKey);
    if (!ring || !ring.enabled) {
      return { ok: false, reason: "Nhẫn không tồn tại hoặc đã tắt" };
    }
    if ((ring.kind ?? "catalog") !== "catalog") {
      return { ok: false, reason: "Chỉ cầu hôn bằng nhẫn catalog" };
    }
    if (this.hasBlockingBond(fromId)) {
      return { ok: false, reason: "Bạn đang có nhẫn / lời cầu hôn" };
    }
    if (this.hasBlockingBond(toUserId)) {
      return { ok: false, reason: "Đối phương đang có nhẫn / lời cầu hôn" };
    }
    const note =
      typeof opts.note === "string"
        ? opts.note.trim().slice(0, 80) || undefined
        : undefined;
    const bond: Bond = {
      id: newBondId(),
      aUserId: fromId,
      bUserId: toUserId,
      ringKey: ring.key,
      status: "pending",
      proposedBy: fromId,
      proposedAt: Date.now(),
      note,
      coupleXu: Math.max(0, Math.floor(ring.price) || 0) || undefined,
    };
    this.bonds.push(bond);
    this.save();
    return { ok: true, bond: { ...bond }, price: ring.price, ring: { ...ring } };
  }

  accept(
    bondId: string,
    userId: string,
  ):
    | { ok: true; bond: Bond; clearedPendingIds: string[] }
    | { ok: false; reason: string } {
    const id = String(bondId ?? "").trim();
    const uid = String(userId ?? "").trim();
    const bond = this.bonds.find((b) => b.id === id);
    if (!bond) return { ok: false, reason: "Không tìm thấy lời cầu hôn" };
    if (bond.status !== "pending") {
      return { ok: false, reason: "Lời cầu hôn không còn hiệu lực" };
    }
    if (bond.proposedBy === uid) {
      return { ok: false, reason: "Người cầu hôn không thể tự chấp nhận" };
    }
    if (!bondInvolves(bond, uid)) {
      return { ok: false, reason: "Không phải lời cầu hôn của bạn" };
    }
    const otherId = bond.aUserId === uid ? bond.bUserId : bond.aUserId;
    // Chặn nếu một trong hai đã active (race)
    const alreadyActive = this.bonds.some(
      (b) =>
        b.id !== bond.id &&
        b.status === "active" &&
        (bondInvolves(b, uid) || bondInvolves(b, otherId)),
    );
    if (alreadyActive) {
      return { ok: false, reason: "Một trong hai đã có nhẫn" };
    }

    bond.status = "active";
    bond.acceptedAt = Date.now();
    if (!bond.coupleCode) {
      const used = new Set(
        this.bonds.map((b) => b.coupleCode).filter(Boolean) as string[],
      );
      bond.coupleCode = newCoupleCode(used);
    }

    const clearedPendingIds: string[] = [];
    this.bonds = this.bonds.filter((b) => {
      if (b.id === bond.id) return true;
      if (
        b.status === "pending" &&
        (bondInvolves(b, uid) || bondInvolves(b, otherId))
      ) {
        clearedPendingIds.push(b.id);
        return false;
      }
      return true;
    });
    this.save();
    return { ok: true, bond: { ...bond }, clearedPendingIds };
  }

  reject(
    bondId: string,
    userId: string,
  ): { ok: true; bond: Bond } | { ok: false; reason: string } {
    const id = String(bondId ?? "").trim();
    const uid = String(userId ?? "").trim();
    const idx = this.bonds.findIndex((b) => b.id === id);
    if (idx < 0) return { ok: false, reason: "Không tìm thấy lời cầu hôn" };
    const bond = this.bonds[idx]!;
    if (bond.status !== "pending") {
      return { ok: false, reason: "Lời cầu hôn không còn hiệu lực" };
    }
    if (!bondInvolves(bond, uid)) {
      return { ok: false, reason: "Không phải lời cầu hôn của bạn" };
    }
    // Proposee hoặc proposer đều có thể hủy pending
    const removed = { ...bond };
    this.bonds.splice(idx, 1);
    this.save();
    return { ok: true, bond: removed };
  }

  /**
   * Đặt chữ giữa A — … — B. Chỉ cặp active + nhẫn Kim Cương.
   * Truyền chuỗi rỗng để về mặc định «Với».
   */
  setCouplePhrase(
    userId: string,
    phraseRaw: unknown,
  ):
    | { ok: true; bond: Bond; couplePhrase?: string }
    | { ok: false; reason: string } {
    const uid = String(userId ?? "").trim();
    if (!uid) return { ok: false, reason: "Thiếu user" };
    const bond = this.bonds.find(
      (b) => b.status === "active" && bondInvolves(b, uid),
    );
    if (!bond) return { ok: false, reason: "Bạn chưa kết đôi" };
    if (!ringAllowsCustomPhrase(bond.ringKey)) {
      return {
        ok: false,
        reason: "Chỉ nhẫn Kim Cương mới được đặt chữ tuỳ chỉnh",
      };
    }
    const phrase = normalizeCouplePhrase(phraseRaw);
    if (phrase) bond.couplePhrase = phrase;
    else delete bond.couplePhrase;
    this.save();
    return {
      ok: true,
      bond: { ...bond },
      couplePhrase: bond.couplePhrase,
    };
  }

  breakBond(
    userId: string,
  ): { ok: true; bond: Bond } | { ok: false; reason: string } {
    const uid = String(userId ?? "").trim();
    const idx = this.bonds.findIndex(
      (b) => b.status === "active" && bondInvolves(b, uid),
    );
    if (idx < 0) {
      // Cũng cho phép hủy pending của mình
      const pIdx = this.bonds.findIndex(
        (b) => b.status === "pending" && bondInvolves(b, uid),
      );
      if (pIdx < 0) return { ok: false, reason: "Bạn không có nhẫn / lời cầu hôn" };
      const removed = { ...this.bonds[pIdx]! };
      this.bonds.splice(pIdx, 1);
      this.save();
      return { ok: true, bond: removed };
    }
    const removed = { ...this.bonds[idx]! };
    this.bonds.splice(idx, 1);
    this.save();
    return { ok: true, bond: removed };
  }

  /**
   * Đổi nhẫn đang đeo (cặp active).
   * Cho phép: catalog enabled, hoặc custom thuộc đúng bond.
   */
  setBondRing(
    userId: string,
    ringKeyRaw: unknown,
  ):
    | { ok: true; bond: Bond; ring: RingItem }
    | { ok: false; reason: string } {
    const uid = String(userId ?? "").trim();
    if (!uid) return { ok: false, reason: "Thiếu user" };
    const bond = this.bonds.find(
      (b) => b.status === "active" && bondInvolves(b, uid),
    );
    if (!bond) return { ok: false, reason: "Bạn chưa kết đôi" };
    if (bond.designLocked) {
      return { ok: false, reason: "Thiết kế nhẫn đang bị khóa (admin)" };
    }
    const ring = this.getByKey(String(ringKeyRaw ?? ""));
    if (!ring || !ring.enabled) {
      return { ok: false, reason: "Nhẫn không tồn tại hoặc đã tắt" };
    }
    const kind = ring.kind ?? "catalog";
    if (kind === "custom" && ring.ownerBondId !== bond.id) {
      return { ok: false, reason: "Nhẫn riêng không thuộc cặp này" };
    }
    assignBondRingKey(bond, ring.key);
    this.save();
    return { ok: true, bond: { ...bond }, ring: { ...ring } };
  }

  /** Staff: gắn nhẫn (catalog/custom) cho bond theo id. */
  adminSetBondRing(
    bondId: string,
    ringKeyRaw: unknown,
    opts?: { bypassLock?: boolean },
  ):
    | { ok: true; bond: Bond; ring: RingItem }
    | { ok: false; reason: string } {
    const id = String(bondId ?? "").trim();
    const bond = this.bonds.find((b) => b.id === id);
    if (!bond) return { ok: false, reason: "Không tìm thấy cặp" };
    if (bond.status !== "active") {
      return { ok: false, reason: "Chỉ đổi nhẫn khi đã lên nhẫn" };
    }
    if (bond.designLocked && !opts?.bypassLock) {
      return { ok: false, reason: "Thiết kế đang khóa — cần mainadmin" };
    }
    const ring = this.getByKey(String(ringKeyRaw ?? ""));
    if (!ring) return { ok: false, reason: "Không tìm thấy nhẫn" };
    const kind = ring.kind ?? "catalog";
    if (kind === "custom" && ring.ownerBondId && ring.ownerBondId !== bond.id) {
      return { ok: false, reason: "Nhẫn riêng thuộc cặp khác" };
    }
    assignBondRingKey(bond, ring.key);
    this.save();
    return { ok: true, bond: { ...bond }, ring: { ...ring } };
  }

  /**
   * Tạo / cập nhật nhẫn riêng cho cặp (key = c_<coupleCode>).
   * Mặc định gắn làm nhẫn đang đeo.
   */
  upsertCustomForBond(
    bondId: string,
    patch: unknown,
    opts?: { equip?: boolean; bypassLock?: boolean },
  ):
    | { ok: true; ring: RingItem; bond: Bond }
    | { ok: false; reason: string } {
    const id = String(bondId ?? "").trim();
    const bond = this.bonds.find((b) => b.id === id);
    if (!bond) return { ok: false, reason: "Không tìm thấy cặp" };
    if (bond.status !== "active" || !bond.coupleCode) {
      return { ok: false, reason: "Cặp chưa có mã cặp đôi" };
    }
    if (bond.designLocked && !opts?.bypassLock) {
      return { ok: false, reason: "Thiết kế đang khóa — cần mainadmin" };
    }
    const baseKey = `c_${bond.coupleCode.toLowerCase()}`;
    const existing = this.getByKey(baseKey);
    const raw =
      patch && typeof patch === "object"
        ? { ...(patch as object), key: baseKey }
        : { key: baseKey };
    const merged = normalizeRing({
      ...(existing ?? fallbackRing(baseKey)),
      ...(raw as object),
      key: baseKey,
      kind: "custom",
      ownerBondId: bond.id,
      // Custom thường không bán shop
      enabled: true,
      price: existing?.price ?? 0,
    });
    if (!merged) return { ok: false, reason: "Nhẫn riêng không hợp lệ" };
    const idx = this.rings.findIndex((g) => g.key === merged.key);
    if (idx >= 0) this.rings[idx] = merged;
    else this.rings.push(merged);
    if (opts?.equip !== false) {
      assignBondRingKey(bond, merged.key);
    }
    this.save();
    return { ok: true, ring: { ...merged }, bond: { ...bond } };
  }

  /** Staff: ghi chú / chữ cặp / khóa thiết kế. */
  adminUpdateBondMeta(
    bondId: string,
    patch: {
      note?: string | null;
      couplePhrase?: string | null;
      designLocked?: boolean;
    },
  ): { ok: true; bond: Bond } | { ok: false; reason: string } {
    const id = String(bondId ?? "").trim();
    const bond = this.bonds.find((b) => b.id === id);
    if (!bond) return { ok: false, reason: "Không tìm thấy cặp" };
    if (patch.note !== undefined) {
      const note =
        patch.note == null
          ? undefined
          : String(patch.note).trim().slice(0, 80) || undefined;
      bond.note = note;
    }
    if (patch.couplePhrase !== undefined) {
      const phrase = normalizeCouplePhrase(patch.couplePhrase);
      bond.couplePhrase = phrase || undefined;
    }
    if (typeof patch.designLocked === "boolean") {
      bond.designLocked = patch.designLocked || undefined;
    }
    this.save();
    return { ok: true, bond: { ...bond } };
  }

  listCustomForBond(bondId: string): RingItem[] {
    const id = String(bondId ?? "").trim();
    return this.rings
      .filter((r) => (r.kind ?? "catalog") === "custom" && r.ownerBondId === id)
      .map((r) => ({ ...r }));
  }

  /** Staff: buộc hủy pending hoặc tách cặp active theo bondId. */
  adminBreakById(
    bondId: string,
  ): { ok: true; bond: Bond } | { ok: false; reason: string } {
    const id = String(bondId ?? "").trim();
    if (!id) return { ok: false, reason: "Thiếu bondId" };
    const idx = this.bonds.findIndex((b) => b.id === id);
    if (idx < 0) return { ok: false, reason: "Không tìm thấy cặp / lời cầu hôn" };
    const removed = { ...this.bonds[idx]! };
    this.bonds.splice(idx, 1);
    // Giữ custom rings trong catalog để admin còn xem/sửa; không xóa ảnh.
    this.save();
    return { ok: true, bond: removed };
  }

  listBonds(): Bond[] {
    return this.bonds
      .map((b) => ({ ...b }))
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "pending" ? -1 : 1;
        }
        const at = a.acceptedAt ?? a.proposedAt;
        const bt = b.acceptedAt ?? b.proposedAt;
        return bt - at;
      });
  }

  /**
   * Snapshot quản trị: bonds kèm tên/avatar + giá nhẫn (để hoàn xu pending).
   */
  listBondsAdmin(
    resolveUser: (id: string) => BondPartnerPublic | null,
  ): BondAdminRow[] {
    return this.listBonds().map((bond) => {
      const ring = this.getByKey(bond.ringKey);
      const a = resolveUser(bond.aUserId);
      const b = resolveUser(bond.bUserId);
      return {
        id: bond.id,
        status: bond.status,
        ringKey: bond.ringKey,
        ringNameVi: ring?.nameVi ?? bond.ringKey,
        ringPrice: ring?.price ?? 0,
        ringImage: ring?.image ?? "💍",
        ringEffect: ring?.effect,
        proposedBy: bond.proposedBy,
        proposedAt: bond.proposedAt,
        acceptedAt: bond.acceptedAt,
        note: bond.note,
        couplePhrase: bond.couplePhrase,
        coupleCode: bond.coupleCode,
        coupleXu: bond.coupleXu ?? ring?.price,
        coupleLevel: levelPartsStore.coupleLevelFromXu(
          bond.coupleXu ?? ring?.price,
        ),
        designLocked: bond.designLocked,
        ringHistory: bond.ringHistory?.length
          ? [...bond.ringHistory]
          : undefined,
        a: a ?? { id: bond.aUserId, code: "—", username: "?", displayName: "?", avatar: "" },
        b: b ?? { id: bond.bUserId, code: "—", username: "?", displayName: "?", avatar: "" },
      };
    });
  }
}

export const ringStore = new RingStore();
