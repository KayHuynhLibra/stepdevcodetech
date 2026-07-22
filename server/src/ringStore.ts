import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { ITEM_XU_MAX, MIN_STAKE } from "./types.js";

/** Trần giá nhẫn — tối đa 10 chữ số. */
export const RING_XU_MAX = ITEM_XU_MAX;

export type RingEffect = "none" | "glow" | "pulse" | "sparkle" | "orbit";

export type RingCategory = "classic" | "luxury" | "romance" | "legend";

export const RING_EFFECTS: RingEffect[] = [
  "none",
  "glow",
  "pulse",
  "sparkle",
  "orbit",
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
  /** Hiệu ứng hiển thị trên avatar cặp */
  effect: RingEffect;
  /** Độ nét / phóng ảnh nhẫn 0–100 (mặc định 70) */
  imageSharpness: number;
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
  since: number;
  status: BondStatus;
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
    category: "classic",
    effect: "glow",
    imageSharpness: 75,
  },
  {
    key: "gold",
    nameVi: "Nhẫn vàng",
    image: "/assets/rings/ring-gold.svg",
    price: 5_000,
    blurb: "Ánh vàng ấm",
    enabled: true,
    sort: 20,
    category: "luxury",
    effect: "pulse",
    imageSharpness: 80,
  },
  {
    key: "rose",
    nameVi: "Nhẫn hồng",
    image: "/assets/rings/ring-rose.svg",
    price: 10_000,
    blurb: "Hồng lãng mạn",
    enabled: true,
    sort: 30,
    category: "romance",
    effect: "sparkle",
    imageSharpness: 85,
  },
  {
    key: "diamond",
    nameVi: "Kim cương",
    image: "/assets/rings/ring-diamond.svg",
    price: 50_000,
    blurb: "Đỉnh cao",
    enabled: true,
    sort: 40,
    category: "legend",
    effect: "orbit",
    imageSharpness: 95,
  },
];

function defaultCategoryForKey(key: string): RingCategory {
  if (key === "silver") return "classic";
  if (key === "gold") return "luxury";
  if (key === "rose") return "romance";
  if (key === "diamond") return "legend";
  return "classic";
}

function isRingCategory(v: unknown): v is RingCategory {
  return typeof v === "string" && (RING_CATEGORY_IDS as string[]).includes(v);
}

function normalizeCategory(raw: unknown, key: string): RingCategory {
  if (isRingCategory(raw)) return raw;
  return defaultCategoryForKey(key);
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

function normalizeRing(raw: unknown): RingItem | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<RingItem>;
  const key = normalizeKey(g.key);
  if (!key) return null;
  const nameVi = String(g.nameVi ?? "").trim().slice(0, 40) || key;
  const blurb =
    typeof g.blurb === "string" ? g.blurb.trim().slice(0, 80) : undefined;
  const sort = Math.floor(Number(g.sort));
  return {
    key,
    nameVi,
    image: normalizeImage(g.image),
    price: clampRingPrice(g.price),
    blurb: blurb || undefined,
    enabled: g.enabled !== false,
    sort: Number.isFinite(sort) ? sort : 100,
    category: normalizeCategory(g.category, key),
    effect: normalizeEffect(g.effect),
    imageSharpness: clampSharpness(g.imageSharpness),
  };
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
  };
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

  publicCatalog(): RingItem[] {
    return this.rings
      .filter((r) => r.enabled)
      .map((r) => ({ ...r }))
      .sort((a, b) => a.sort - b.sort || a.price - b.price || a.key.localeCompare(b.key));
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
    const ring =
      this.getByKey(bond.ringKey) ??
      ({
        key: bond.ringKey,
        nameVi: bond.ringKey,
        image: "💍",
        price: 0,
        enabled: true,
        sort: 0,
        category: "classic" as const,
        effect: "glow" as const,
        imageSharpness: 70,
      } satisfies RingItem);
    return {
      partner: { ...partner },
      ring: {
        key: ring.key,
        nameVi: ring.nameVi,
        image: ring.image,
        effect: ring.effect,
        imageSharpness: ring.imageSharpness,
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
    const ring =
      this.getByKey(pending.ringKey) ??
      ({
        key: pending.ringKey,
        nameVi: pending.ringKey,
        image: "💍",
        price: 0,
        enabled: true,
        sort: 0,
        category: "classic" as const,
        effect: "glow" as const,
        imageSharpness: 70,
      } satisfies RingItem);
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
}

export const ringStore = new RingStore();
