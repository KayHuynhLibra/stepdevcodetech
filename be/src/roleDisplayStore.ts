/**
 * Cấu hình HIỂN THỊ role rail (IdentityBadge / profile).
 * Không ảnh hưởng auth, grants, capability.
 * Persist `be/data/role-display.json`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "role-display.json");
const TMP = join(DATA_DIR, "role-display.json.tmp");

export const ROLE_DISPLAY_SLOTS = [
  "couple",
  "level",
  "role",
  "cult",
  "vip",
  "badges",
  "id",
] as const;

export type RoleDisplaySlot = (typeof ROLE_DISPLAY_SLOTS)[number];

export const ROLE_DISPLAY_SIZES = ["sm", "md", "lg"] as const;
export type RoleDisplaySize = (typeof ROLE_DISPLAY_SIZES)[number];

export const ROLE_DISPLAY_FRAMES = [
  "pill",
  "chip",
  "badge",
  "plain",
  "ribbon",
  "glass",
  "outline",
  "stamp",
] as const;
export type RoleDisplayFrame = (typeof ROLE_DISPLAY_FRAMES)[number];

export const ROLE_DISPLAY_TEXT_STYLES = [
  "normal",
  "bold",
  "caps",
  "wide",
  "serif",
  "outline",
] as const;
export type RoleDisplayTextStyle = (typeof ROLE_DISPLAY_TEXT_STYLES)[number];

export const ROLE_LABEL_KEYS = [
  "mainadmin",
  "admin",
  "mod",
  "eco",
  "audit",
  "sgift",
  "ring",
  "pm",
  "tarot78",
  "book78",
  "deal",
  "onl",
  "tutien",
  "user",
  "player",
  "guest",
  "bot",
  "vip",
  "couple",
] as const;
export type RoleLabelKey = (typeof ROLE_LABEL_KEYS)[number];

export const ROLE_DISPLAY_SLOT_LABELS: Record<RoleDisplaySlot, string> = {
  couple: "Cặp đôi",
  level: "Level",
  role: "Role chính",
  cult: "Tu Tiên",
  vip: "VIP",
  badges: "Huy hiệu",
  id: "ID",
};

export const ROLE_DISPLAY_SIZE_LABELS: Record<RoleDisplaySize, string> = {
  sm: "Nhỏ",
  md: "Vừa",
  lg: "To",
};

export const ROLE_DISPLAY_FRAME_LABELS: Record<RoleDisplayFrame, string> = {
  pill: "Viên thuốc",
  chip: "Chip",
  badge: "Huy hiệu",
  plain: "Phẳng",
  ribbon: "Ruy băng",
  glass: "Kính mờ",
  outline: "Viền rỗng",
  stamp: "Con dấu",
};

export const ROLE_DISPLAY_TEXT_LABELS: Record<RoleDisplayTextStyle, string> = {
  normal: "Thường",
  bold: "Đậm",
  caps: "IN HOA",
  wide: "Giãn chữ",
  serif: "Serif",
  outline: "Viền chữ",
};

export const DEFAULT_ROLE_LABELS: Record<RoleLabelKey, string> = {
  mainadmin: "Mainadmin",
  admin: "Admin",
  mod: "Mod",
  eco: "Eco",
  audit: "Audit",
  sgift: "SGift",
  ring: "Ring",
  pm: "P+M",
  tarot78: "Tarot78",
  book78: "Book78",
  deal: "Deal",
  onl: "Onl",
  tutien: "Tu Tiên",
  user: "Player",
  player: "Người chơi",
  guest: "Khách",
  bot: "Bot",
  vip: "VIP",
  couple: "Cặp đôi",
};

export interface RoleColorOverride {
  text?: string;
  bg?: string;
}

export interface RoleDisplayPublic {
  order: RoleDisplaySlot[];
  size: RoleDisplaySize;
  frameStyle: RoleDisplayFrame;
  textStyle: RoleDisplayTextStyle;
  showGlyph: boolean;
  roleLabels: Partial<Record<RoleLabelKey, string>>;
  /** Màu chữ / nền pill theo role — hex; chuỗi cũ = chỉ text */
  roleColors: Partial<Record<RoleLabelKey, RoleColorOverride>>;
}

export interface RoleDisplaySnapshot extends RoleDisplayPublic {
  updatedAt: number;
  updatedBy?: string;
}

interface RoleDisplayFile extends RoleDisplayPublic {
  version: 1;
  updatedAt: number;
  updatedBy?: string;
}

const DEFAULT_ORDER: RoleDisplaySlot[] = [...ROLE_DISPLAY_SLOTS];

function normalizeSize(raw: unknown): RoleDisplaySize {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return ROLE_DISPLAY_SIZES.includes(s as RoleDisplaySize)
    ? (s as RoleDisplaySize)
    : "md";
}

function normalizeFrame(raw: unknown): RoleDisplayFrame {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return ROLE_DISPLAY_FRAMES.includes(s as RoleDisplayFrame)
    ? (s as RoleDisplayFrame)
    : "pill";
}

function normalizeTextStyle(raw: unknown): RoleDisplayTextStyle {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return ROLE_DISPLAY_TEXT_STYLES.includes(s as RoleDisplayTextStyle)
    ? (s as RoleDisplayTextStyle)
    : "normal";
}

function normalizeOrder(raw: unknown): RoleDisplaySlot[] {
  const seen = new Set<RoleDisplaySlot>();
  const out: RoleDisplaySlot[] = [];
  const list = Array.isArray(raw) ? raw : DEFAULT_ORDER;
  for (const item of list) {
    const s = String(item ?? "")
      .trim()
      .toLowerCase() as RoleDisplaySlot;
    if (!ROLE_DISPLAY_SLOTS.includes(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  for (const slot of DEFAULT_ORDER) {
    if (!seen.has(slot)) out.push(slot);
  }
  return out;
}

function normalizeRoleLabels(
  raw: unknown,
): Partial<Record<RoleLabelKey, string>> {
  const out: Partial<Record<RoleLabelKey, string>> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const key of ROLE_LABEL_KEYS) {
    const v = src[key];
    if (typeof v !== "string") continue;
    const t = v.trim().slice(0, 24);
    if (!t) continue;
    out[key] = t;
  }
  return out;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function normalizeRoleColorHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!HEX_RE.test(t)) return null;
  return t.length === 4
    ? `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toUpperCase()
    : t.toUpperCase();
}

function normalizeRoleColors(
  raw: unknown,
): Partial<Record<RoleLabelKey, RoleColorOverride>> {
  const out: Partial<Record<RoleLabelKey, RoleColorOverride>> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const key of ROLE_LABEL_KEYS) {
    const v = src[key];
    if (typeof v === "string") {
      const text = normalizeRoleColorHex(v);
      if (text) out[key] = { text };
      continue;
    }
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const text = normalizeRoleColorHex(o.text ?? o.color);
    const bg = normalizeRoleColorHex(o.bg ?? o.background);
    if (!text && !bg) continue;
    out[key] = {
      ...(text ? { text } : {}),
      ...(bg ? { bg } : {}),
    };
  }
  return out;
}

class RoleDisplayStore {
  private order: RoleDisplaySlot[] = [...DEFAULT_ORDER];
  private size: RoleDisplaySize = "md";
  private frameStyle: RoleDisplayFrame = "pill";
  private textStyle: RoleDisplayTextStyle = "normal";
  private showGlyph = true;
  private roleLabels: Partial<Record<RoleLabelKey, string>> = {};
  private roleColors: Partial<Record<RoleLabelKey, RoleColorOverride>> = {};
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as RoleDisplayFile;
      if (parsed?.version !== 1) return;
      this.order = normalizeOrder(parsed.order);
      this.size = normalizeSize(parsed.size);
      this.frameStyle = normalizeFrame(parsed.frameStyle);
      this.textStyle = normalizeTextStyle(parsed.textStyle);
      this.showGlyph = parsed.showGlyph !== false;
      this.roleLabels = normalizeRoleLabels(parsed.roleLabels);
      this.roleColors = normalizeRoleColors(parsed.roleColors);
      this.updatedAt = Number(parsed.updatedAt) || 0;
      this.updatedBy = String(parsed.updatedBy ?? "");
    } catch (err) {
      console.warn("[role-display] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: RoleDisplayFile = {
      version: 1,
      order: this.order,
      size: this.size,
      frameStyle: this.frameStyle,
      textStyle: this.textStyle,
      showGlyph: this.showGlyph,
      roleLabels: this.roleLabels,
      roleColors: this.roleColors,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  getPublic(): RoleDisplayPublic {
    const roleColors: Partial<Record<RoleLabelKey, RoleColorOverride>> = {};
    for (const [k, v] of Object.entries(this.roleColors)) {
      if (v) roleColors[k as RoleLabelKey] = { ...v };
    }
    return {
      order: [...this.order],
      size: this.size,
      frameStyle: this.frameStyle,
      textStyle: this.textStyle,
      showGlyph: this.showGlyph,
      roleLabels: { ...this.roleLabels },
      roleColors,
    };
  }

  getSnapshot(): RoleDisplaySnapshot {
    return {
      ...this.getPublic(),
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
    };
  }

  update(
    patch: {
      order?: unknown;
      size?: unknown;
      frameStyle?: unknown;
      textStyle?: unknown;
      showGlyph?: unknown;
      roleLabels?: unknown;
      roleColors?: unknown;
    },
    byUsername: string,
  ): { ok: true; config: RoleDisplaySnapshot } | { ok: false; reason: string } {
    if (patch.order !== undefined) {
      this.order = normalizeOrder(patch.order);
    }
    if (patch.size !== undefined && patch.size !== null && patch.size !== "") {
      this.size = normalizeSize(patch.size);
    }
    if (
      patch.frameStyle !== undefined &&
      patch.frameStyle !== null &&
      patch.frameStyle !== ""
    ) {
      this.frameStyle = normalizeFrame(patch.frameStyle);
    }
    if (
      patch.textStyle !== undefined &&
      patch.textStyle !== null &&
      patch.textStyle !== ""
    ) {
      this.textStyle = normalizeTextStyle(patch.textStyle);
    }
    if (patch.showGlyph !== undefined && patch.showGlyph !== null) {
      this.showGlyph = !(
        patch.showGlyph === false ||
        patch.showGlyph === 0 ||
        patch.showGlyph === "0" ||
        patch.showGlyph === "false"
      );
    }
    if (patch.roleLabels !== undefined) {
      this.roleLabels = normalizeRoleLabels(patch.roleLabels);
    }
    if (patch.roleColors !== undefined) {
      this.roleColors = normalizeRoleColors(patch.roleColors);
    }
    this.updatedAt = Date.now();
    this.updatedBy = String(byUsername ?? "").trim().slice(0, 40);
    this.save();
    return { ok: true, config: this.getSnapshot() };
  }
}

export const roleDisplayStore = new RoleDisplayStore();
