/** Client mirror — hiển thị role rail (không đụng auth). */

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

/** Keys có thể đổi tên hiển thị trên badge / hồ sơ. */
export const ROLE_LABEL_KEYS = [
  "mainadmin",
  "admin",
  "mod",
  "eco",
  "audit",
  "sgift",
  "ring",
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

export const DEFAULT_ROLE_GLYPHS: Record<RoleLabelKey, string> = {
  mainadmin: "✦",
  admin: "🛡",
  mod: "⚔",
  eco: "🌿",
  audit: "👁",
  sgift: "🎁",
  ring: "💍",
  deal: "⚖",
  onl: "📡",
  tutien: "☯",
  user: "👤",
  player: "👤",
  guest: "◌",
  bot: "⚙",
  vip: "★",
  couple: "♥",
};

export const ROLE_LABEL_UI_LABELS: Record<RoleLabelKey, string> = {
  mainadmin: "Mainadmin",
  admin: "Admin",
  mod: "Mod",
  eco: "Eco",
  audit: "Audit",
  sgift: "SGift",
  ring: "Ring",
  deal: "Deal",
  onl: "Onl",
  tutien: "Tu Tiên (role)",
  user: "User / Player (auth)",
  player: "Người chơi (hồ sơ)",
  guest: "Khách",
  bot: "Bot",
  vip: "VIP",
  couple: "Cặp đôi",
};

export interface RoleColorOverride {
  /** Màu chữ (không đụng viền pill) */
  text?: string;
  /** Màu nền pill */
  bg?: string;
}

export interface RoleDisplayPublic {
  order: RoleDisplaySlot[];
  size: RoleDisplaySize;
  frameStyle: RoleDisplayFrame;
  textStyle: RoleDisplayTextStyle;
  showGlyph: boolean;
  /** Override tên hiển thị — để trống = mặc định */
  roleLabels: Partial<Record<RoleLabelKey, string>>;
  /** Màu chữ / nền pill theo role — hex */
  roleColors: Partial<Record<RoleLabelKey, RoleColorOverride>>;
}

export interface RoleDisplaySnapshot extends RoleDisplayPublic {
  updatedAt?: number;
  updatedBy?: string;
}

export const DEFAULT_ROLE_DISPLAY: RoleDisplayPublic = {
  order: [...ROLE_DISPLAY_SLOTS],
  size: "md",
  frameStyle: "pill",
  textStyle: "normal",
  showGlyph: true,
  roleLabels: {},
  roleColors: {},
};

/** Preset nhanh khi chỉnh màu role */
export const ROLE_COLOR_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: "gold", label: "Vàng", hex: "#E5C158" },
  { id: "rose", label: "Hồng", hex: "#F0A8C0" },
  { id: "jade", label: "Ngọc", hex: "#5EC8A0" },
  { id: "cyan", label: "Cyan", hex: "#7EC8FF" },
  { id: "violet", label: "Tím", hex: "#B89BFF" },
  { id: "crimson", label: "Đỏ", hex: "#E07070" },
  { id: "ember", label: "Cam", hex: "#FF9A4A" },
  { id: "pearl", label: "Bạch", hex: "#F0E8DC" },
];

export const ROLE_BG_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: "night", label: "Đêm", hex: "#1A2638" },
  { id: "ink", label: "Mực", hex: "#121D2D" },
  { id: "wine", label: "Rượu", hex: "#3A1A28" },
  { id: "royal", label: "Hoàng", hex: "#2A1F48" },
  { id: "forest", label: "Rừng", hex: "#143028" },
  { id: "ocean", label: "Biển", hex: "#0F2840" },
  { id: "ember", label: "Than", hex: "#3A2010" },
  { id: "steel", label: "Thép", hex: "#2A3340" },
];

export function isRoleLabelKey(raw: unknown): raw is RoleLabelKey {
  return ROLE_LABEL_KEYS.includes(String(raw ?? "").trim().toLowerCase() as RoleLabelKey);
}

export function normalizeRoleLabels(
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

export function normalizeRoleColorHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!HEX_RE.test(t)) return null;
  return t.length === 4
    ? `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toUpperCase()
    : t.toUpperCase();
}

/** Chuỗi cũ → { text }; object { text, bg } → chuẩn hóa. */
export function normalizeRoleColors(
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

/** Tên hiển thị: custom RoleAD → default. */
export function resolveRoleLabel(
  key: RoleLabelKey | string | null | undefined,
  labels?: Partial<Record<RoleLabelKey, string>> | null,
): string {
  const k = String(key ?? "")
    .trim()
    .toLowerCase();
  if (!isRoleLabelKey(k)) return DEFAULT_ROLE_LABELS.player;
  const custom = labels?.[k]?.trim();
  if (custom) return custom;
  return DEFAULT_ROLE_LABELS[k];
}

export function resolveRoleGlyph(key: RoleLabelKey | string | null | undefined): string {
  const k = String(key ?? "")
    .trim()
    .toLowerCase();
  if (!isRoleLabelKey(k)) return DEFAULT_ROLE_GLYPHS.player;
  return DEFAULT_ROLE_GLYPHS[k];
}

export type RoleColorStyle = {
  color?: string;
  background?: string;
  backgroundImage?: string;
  /** Cho text/glyph inherit đúng khi CSS frame/text-style ghi đè */
  ["--role-fg"]?: string;
};

/** Style inline khi RoleAD gán màu chữ / nền (chữ ≠ viền). */
export function resolveRoleColorStyle(
  key: RoleLabelKey | string | null | undefined,
  colors?: Partial<Record<RoleLabelKey, RoleColorOverride | string>> | null,
): RoleColorStyle | undefined {
  const k = String(key ?? "")
    .trim()
    .toLowerCase();
  if (!isRoleLabelKey(k)) return undefined;
  const raw = colors?.[k];
  if (!raw) return undefined;
  let text: string | undefined;
  let bg: string | undefined;
  if (typeof raw === "string") {
    text = normalizeRoleColorHex(raw) ?? undefined;
  } else {
    text = raw.text;
    bg = raw.bg;
  }
  if (!text && !bg) return undefined;
  const style: RoleColorStyle = {};
  if (text) {
    style.color = text;
    style["--role-fg"] = text;
  }
  if (bg) {
    style.background = bg;
    style.backgroundImage = "none";
  }
  return style;
}

export function normalizeRoleDisplay(raw: unknown): RoleDisplayPublic {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<RoleDisplayPublic>;
  const seen = new Set<RoleDisplaySlot>();
  const order: RoleDisplaySlot[] = [];
  for (const item of Array.isArray(src.order) ? src.order : DEFAULT_ROLE_DISPLAY.order) {
    const s = String(item ?? "")
      .trim()
      .toLowerCase() as RoleDisplaySlot;
    if (!ROLE_DISPLAY_SLOTS.includes(s) || seen.has(s)) continue;
    seen.add(s);
    order.push(s);
  }
  for (const slot of ROLE_DISPLAY_SLOTS) {
    if (!seen.has(slot)) order.push(slot);
  }
  const size = ROLE_DISPLAY_SIZES.includes(src.size as RoleDisplaySize)
    ? (src.size as RoleDisplaySize)
    : "md";
  const frameStyle = ROLE_DISPLAY_FRAMES.includes(src.frameStyle as RoleDisplayFrame)
    ? (src.frameStyle as RoleDisplayFrame)
    : "pill";
  const textStyle = ROLE_DISPLAY_TEXT_STYLES.includes(
    src.textStyle as RoleDisplayTextStyle,
  )
    ? (src.textStyle as RoleDisplayTextStyle)
    : "normal";
  return {
    order,
    size,
    frameStyle,
    textStyle,
    showGlyph: src.showGlyph !== false,
    roleLabels: normalizeRoleLabels(src.roleLabels),
    roleColors: normalizeRoleColors(src.roleColors),
  };
}

const EVENT = "role-display-updated";
let cache: RoleDisplayPublic = {
  ...DEFAULT_ROLE_DISPLAY,
  order: [...DEFAULT_ROLE_DISPLAY.order],
  roleLabels: {},
  roleColors: {},
};
let fetchPromise: Promise<RoleDisplayPublic> | null = null;

export function getRoleDisplayCache(): RoleDisplayPublic {
  return cache;
}

export function setRoleDisplayCache(next: RoleDisplayPublic) {
  cache = normalizeRoleDisplay(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: cache }));
  }
}

export async function fetchRoleDisplay(): Promise<RoleDisplayPublic> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const r = await fetch("/api/role-display", { credentials: "same-origin" });
      if (!r.ok) return cache;
      const json = (await r.json()) as { ok?: boolean; config?: unknown };
      if (json?.config) {
        cache = normalizeRoleDisplay(json.config);
      }
    } catch {
      /* keep cache */
    } finally {
      fetchPromise = null;
    }
    return cache;
  })();
  return fetchPromise;
}

export function subscribeRoleDisplay(cb: (cfg: RoleDisplayPublic) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<RoleDisplayPublic>).detail;
    cb(detail ? normalizeRoleDisplay(detail) : cache);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
