/** Khung avatar / tên / ID + nền hồ sơ chiêm tinh — RoleAD. */

export type AvatarFrameId =
  | "none"
  | "vip"
  | "gold"
  | "celestial"
  | "admin"
  | "jade"
  | "cosmos"
  | "flame"
  | "pearl"
  | "rune"
  | "heart";

export type ProfileThemeId =
  | "cosmic"
  | "aurora"
  | "midnight"
  | "stardust"
  | "nebula"
  | "golden"
  | "lotus"
  | "void";

/** Khung bao quanh nickname trên hồ sơ / badge. */
export type NameFrameId =
  | "none"
  | "plaque"
  | "ribbon"
  | "scroll"
  | "crystal"
  | "rune"
  | "heart"
  | "celestial"
  | "banner"
  | "ink";

/** Khung bao quanh ID badge. */
export type IdFrameId =
  | "classic"
  | "bronze"
  | "crystal"
  | "rune"
  | "seal"
  | "ticket"
  | "hex"
  | "celestial"
  | "heart"
  | "gold";

export interface StylePreset<T extends string> {
  id: T;
  label: string;
}

export const AVATAR_FRAME_PRESETS: StylePreset<AvatarFrameId>[] = [
  { id: "none", label: "Không" },
  { id: "vip", label: "VIP ảo ảnh" },
  { id: "gold", label: "Vàng cổ" },
  { id: "celestial", label: "Chiêm tinh" },
  { id: "admin", label: "Admin rune" },
  { id: "jade", label: "Ngọc bích" },
  { id: "cosmos", label: "Thiên hà" },
  { id: "flame", label: "Hỏa giới" },
  { id: "pearl", label: "Ngọc trai" },
  { id: "rune", label: "Cổ ngữ" },
  { id: "heart", label: "Trái tim" },
];

export const PROFILE_THEME_PRESETS: StylePreset<ProfileThemeId>[] = [
  { id: "cosmic", label: "Vũ trụ" },
  { id: "aurora", label: "Cực quang" },
  { id: "midnight", label: "Đêm sâu" },
  { id: "stardust", label: "Bụi sao" },
  { id: "nebula", label: "Tinh vân" },
  { id: "golden", label: "Hoàng kim" },
  { id: "lotus", label: "Liên hoa" },
  { id: "void", label: "Hư không" },
];

export const NAME_FRAME_PRESETS: StylePreset<NameFrameId>[] = [
  { id: "none", label: "Không" },
  { id: "plaque", label: "Bảng đồng" },
  { id: "ribbon", label: "Ruy băng" },
  { id: "scroll", label: "Cuộn thư" },
  { id: "crystal", label: "Pha lê" },
  { id: "rune", label: "Cổ ngữ" },
  { id: "heart", label: "Trái tim" },
  { id: "celestial", label: "Chiêm tinh" },
  { id: "banner", label: "Banner" },
  { id: "ink", label: "Mực vàng" },
];

export const ID_FRAME_PRESETS: StylePreset<IdFrameId>[] = [
  { id: "classic", label: "Cổ điển" },
  { id: "bronze", label: "Đồng" },
  { id: "crystal", label: "Pha lê" },
  { id: "rune", label: "Cổ ngữ" },
  { id: "seal", label: "Ấn triện" },
  { id: "ticket", label: "Vé số" },
  { id: "hex", label: "Lục giác" },
  { id: "celestial", label: "Chiêm tinh" },
  { id: "heart", label: "Trái tim" },
  { id: "gold", label: "Hoàng kim" },
];

const FRAME_IDS = new Set(AVATAR_FRAME_PRESETS.map((p) => p.id));
const THEME_IDS = new Set(PROFILE_THEME_PRESETS.map((p) => p.id));
const NAME_FRAME_IDS = new Set(NAME_FRAME_PRESETS.map((p) => p.id));
const ID_FRAME_IDS = new Set(ID_FRAME_PRESETS.map((p) => p.id));

export function normalizeAvatarFrame(raw: unknown): AvatarFrameId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return FRAME_IDS.has(s as AvatarFrameId) ? (s as AvatarFrameId) : "none";
}

export function normalizeProfileTheme(raw: unknown): ProfileThemeId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return THEME_IDS.has(s as ProfileThemeId) ? (s as ProfileThemeId) : "cosmic";
}

export function normalizeNameFrame(raw: unknown): NameFrameId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return NAME_FRAME_IDS.has(s as NameFrameId) ? (s as NameFrameId) : "none";
}

export function normalizeIdFrame(raw: unknown): IdFrameId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return ID_FRAME_IDS.has(s as IdFrameId) ? (s as IdFrameId) : "classic";
}
