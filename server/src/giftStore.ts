import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ITEM_XU_MAX, MIN_STAKE } from "./types.js";

/** Trần giá quà catalog — 10 chữ số */
export const GIFT_XU_MAX = ITEM_XU_MAX;

export type GiftCategory = "warm" | "prestige" | "legend" | "fun";

export type GiftFlyStyle = "toast" | "marquee" | "fly" | "fullscreen";

export interface GiftItem {
  key: string;
  nameVi: string;
  emoji: string;
  /** URL ảnh catalog (ưu tiên hiển thị); emoji là fallback */
  image?: string;
  price: number;
  category: GiftCategory;
  blurb?: string;
  enabled: boolean;
}

export interface GiftFlyTier {
  id: string;
  label: string;
  minAmount: number;
  durationMs: number;
  style: GiftFlyStyle;
  enabled: boolean;
}

export interface GiftStoreSnapshot {
  version: 1;
  gifts: GiftItem[];
  flyTiers: GiftFlyTier[];
  updatedAt: number;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "gifts.json");
const TMP = join(DATA_DIR, "gifts.json.tmp");

const CATEGORIES: GiftCategory[] = ["warm", "prestige", "legend", "fun"];
const FLY_STYLES: GiftFlyStyle[] = ["toast", "marquee", "fly", "fullscreen"];

export const DEFAULT_GIFTS: GiftItem[] = [
  {
    key: "lotus",
    nameVi: "Hoa sen",
    emoji: "🪷",
    price: 100,
    category: "warm",
    blurb: "Lời chào nhẹ",
    enabled: true,
  },
  {
    key: "heart",
    nameVi: "Trái tim",
    emoji: "❤️",
    price: 200,
    category: "warm",
    blurb: "Gửi yêu thương",
    enabled: true,
  },
  {
    key: "star",
    nameVi: "Ngôi sao",
    emoji: "⭐",
    price: 500,
    category: "prestige",
    blurb: "Tăng khí vận",
    enabled: true,
  },
  {
    key: "crystal",
    nameVi: "Pha lê",
    emoji: "💎",
    price: 1_000,
    category: "prestige",
    blurb: "Quà trung",
    enabled: true,
  },
  {
    key: "crown",
    nameVi: "Vương miện",
    emoji: "👑",
    price: 5_000,
    category: "legend",
    blurb: "Tôn vinh",
    enabled: true,
  },
  {
    key: "phoenix",
    nameVi: "Phượng hoàng",
    emoji: "🔥",
    price: 20_000,
    category: "legend",
    blurb: "Quà lớn",
    enabled: true,
  },
  {
    key: "dragon",
    nameVi: "Rồng vàng",
    emoji: "🐉",
    price: 50_000,
    category: "legend",
    blurb: "Trần demo 50k",
    enabled: true,
  },
  {
    key: "tea",
    nameVi: "Ấm trà",
    emoji: "🍵",
    price: 300,
    category: "fun",
    blurb: "Mời một ấm",
    enabled: true,
  },
  {
    key: "dice",
    nameVi: "Xúc xắc",
    emoji: "🎲",
    price: 800,
    category: "fun",
    blurb: "Thử vận may",
    enabled: true,
  },
];

export const DEFAULT_FLY_TIERS: GiftFlyTier[] = [
  {
    id: "toast",
    label: "Toast",
    minAmount: 0,
    durationMs: 2800,
    style: "toast",
    enabled: true,
  },
  {
    id: "marquee",
    label: "Marquee",
    minAmount: 1_000,
    durationMs: 4500,
    style: "marquee",
    enabled: true,
  },
  {
    id: "fly",
    label: "Fly",
    minAmount: 5_000,
    durationMs: 5200,
    style: "fly",
    enabled: true,
  },
  {
    id: "fullscreen",
    label: "Fullscreen",
    minAmount: 20_000,
    durationMs: 6500,
    style: "fullscreen",
    enabled: true,
  },
];

function clampGiftPrice(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return MIN_STAKE;
  return Math.max(MIN_STAKE, Math.min(GIFT_XU_MAX, v));
}

function normalizeKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function isGiftCategory(v: unknown): v is GiftCategory {
  return typeof v === "string" && (CATEGORIES as string[]).includes(v);
}

function isFlyStyle(v: unknown): v is GiftFlyStyle {
  return typeof v === "string" && (FLY_STYLES as string[]).includes(v);
}

function normalizeGift(raw: unknown): GiftItem | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<GiftItem>;
  const key = normalizeKey(g.key);
  if (!key) return null;
  const nameVi = String(g.nameVi ?? "").trim().slice(0, 40) || key;
  const emoji = String(g.emoji ?? "🎁").trim().slice(0, 8) || "🎁";
  const imageRaw =
    typeof g.image === "string" ? g.image.trim().slice(0, 240) : "";
  const image = imageRaw || undefined;
  const category: GiftCategory = isGiftCategory(g.category) ? g.category : "fun";
  const blurb =
    typeof g.blurb === "string" ? g.blurb.trim().slice(0, 80) : undefined;
  return {
    key,
    nameVi,
    emoji,
    image,
    price: clampGiftPrice(g.price),
    category,
    blurb: blurb || undefined,
    enabled: g.enabled !== false,
  };
}

function normalizeFlyTier(raw: unknown): GiftFlyTier | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<GiftFlyTier>;
  const id = normalizeKey(t.id);
  if (!id) return null;
  const minAmount = Math.max(0, Math.floor(Number(t.minAmount)) || 0);
  const durationMs = Math.max(
    800,
    Math.min(30_000, Math.floor(Number(t.durationMs)) || 3000),
  );
  const style: GiftFlyStyle = isFlyStyle(t.style) ? t.style : "toast";
  const label = String(t.label ?? id).trim().slice(0, 40) || id;
  return {
    id,
    label,
    minAmount,
    durationMs,
    style,
    enabled: t.enabled !== false,
  };
}

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, path);
}

class GiftStore {
  private gifts: GiftItem[] = DEFAULT_GIFTS.map((g) => ({ ...g }));
  private flyTiers: GiftFlyTier[] = DEFAULT_FLY_TIERS.map((t) => ({ ...t }));

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        console.log("[gifts] Created gifts.json with defaults");
        return;
      }
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as Partial<GiftStoreSnapshot>;
      const gifts = Array.isArray(parsed.gifts)
        ? parsed.gifts.map(normalizeGift).filter((x): x is GiftItem => !!x)
        : [];
      const flyTiers = Array.isArray(parsed.flyTiers)
        ? parsed.flyTiers
            .map(normalizeFlyTier)
            .filter((x): x is GiftFlyTier => !!x)
        : [];
      if (gifts.length) this.gifts = gifts;
      if (flyTiers.length) this.flyTiers = flyTiers;
      console.log(
        `[gifts] Loaded ${this.gifts.length} gifts · ${this.flyTiers.length} fly tiers`,
      );
    } catch (err) {
      console.warn("[gifts] Failed to load gifts.json:", err);
      this.gifts = DEFAULT_GIFTS.map((g) => ({ ...g }));
      this.flyTiers = DEFAULT_FLY_TIERS.map((t) => ({ ...t }));
    }
  }

  private save() {
    try {
      atomicWrite(PATH, this.snapshot());
    } catch (err) {
      console.warn("[gifts] Failed to save gifts.json:", err);
    }
  }

  publicCatalog(): GiftItem[] {
    return this.gifts
      .filter((g) => g.enabled)
      .map((g) => ({ ...g }))
      .sort((a, b) => a.price - b.price || a.key.localeCompare(b.key));
  }

  getByKey(key: string): GiftItem | undefined {
    const k = normalizeKey(key);
    const g = this.gifts.find((x) => x.key === k);
    return g ? { ...g } : undefined;
  }

  resolveFlyTier(amount: number): GiftFlyTier {
    const amt = Math.floor(Number(amount)) || 0;
    const enabled = this.flyTiers
      .filter((t) => t.enabled)
      .sort((a, b) => a.minAmount - b.minAmount);
    let best = enabled[0] ?? { ...DEFAULT_FLY_TIERS[0]! };
    for (const t of enabled) {
      if (amt >= t.minAmount) best = t;
    }
    return { ...best };
  }

  upsertGift(
    raw: unknown,
  ): { ok: true; gift: GiftItem } | { ok: false; reason: string } {
    const gift = normalizeGift(raw);
    if (!gift) return { ok: false, reason: "Quà không hợp lệ (thiếu key)" };
    const idx = this.gifts.findIndex((g) => g.key === gift.key);
    if (idx >= 0) this.gifts[idx] = gift;
    else this.gifts.push(gift);
    this.save();
    return { ok: true, gift: { ...gift } };
  }

  setGiftEnabled(
    key: string,
    enabled: boolean,
  ): { ok: true; gift: GiftItem } | { ok: false; reason: string } {
    const k = normalizeKey(key);
    const g = this.gifts.find((x) => x.key === k);
    if (!g) return { ok: false, reason: "Không tìm thấy quà" };
    g.enabled = !!enabled;
    this.save();
    return { ok: true, gift: { ...g } };
  }

  removeGift(
    key: string,
  ): { ok: true; key: string } | { ok: false; reason: string } {
    const k = normalizeKey(key);
    const before = this.gifts.length;
    this.gifts = this.gifts.filter((g) => g.key !== k);
    if (this.gifts.length === before) {
      return { ok: false, reason: "Không tìm thấy quà" };
    }
    this.save();
    return { ok: true, key: k };
  }

  setFlyTiers(
    raw: unknown,
  ): { ok: true; flyTiers: GiftFlyTier[] } | { ok: false; reason: string } {
    if (!Array.isArray(raw) || raw.length === 0) {
      return { ok: false, reason: "flyTiers phải là mảng không rỗng" };
    }
    const next: GiftFlyTier[] = [];
    const seen = new Set<string>();
    for (const row of raw) {
      const t = normalizeFlyTier(row);
      if (!t) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      next.push(t);
    }
    if (!next.length) return { ok: false, reason: "Không có fly tier hợp lệ" };
    next.sort((a, b) => a.minAmount - b.minAmount);
    this.flyTiers = next;
    this.save();
    return { ok: true, flyTiers: this.flyTiers.map((t) => ({ ...t })) };
  }

  snapshot(): GiftStoreSnapshot {
    return {
      version: 1,
      gifts: this.gifts.map((g) => ({ ...g })),
      flyTiers: this.flyTiers.map((t) => ({ ...t })),
      updatedAt: Date.now(),
    };
  }
}

export const giftStore = new GiftStore();
