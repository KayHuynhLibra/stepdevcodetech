/** Màu + hiệu ứng nick công khai — đồng bộ server nameColors / RoleAD. */

export type NameColorId =
  | "default"
  | "gold"
  | "rose"
  | "jade"
  | "cyan"
  | "violet"
  | "crimson"
  | "ember"
  | "pearl"
  | "aurora"
  | "cosmos";

export type NameEffectId =
  | "none"
  | "glow"
  | "shimmer"
  | "pulse"
  | "sparkle"
  | "neon"
  | "float"
  | "flame";

export interface NameColorPreset {
  id: NameColorId;
  label: string;
  hex?: string;
  gradient?: string;
}

export interface NameEffectPreset {
  id: NameEffectId;
  label: string;
}

export const NAME_COLOR_PRESETS: NameColorPreset[] = [
  { id: "default", label: "Mặc định" },
  { id: "gold", label: "Vàng ánh", hex: "#E5C158" },
  { id: "rose", label: "Hồng phấn", hex: "#F0A8C0" },
  { id: "jade", label: "Ngọc bích", hex: "#5EC8A0" },
  { id: "cyan", label: "Thiên thanh", hex: "#7EC8FF" },
  { id: "violet", label: "Tím huyền", hex: "#B89BFF" },
  { id: "crimson", label: "Đỏ rượu", hex: "#E07070" },
  { id: "ember", label: "Hỏa diệm", hex: "#FF9A4A" },
  { id: "pearl", label: "Bạch kim", hex: "#F0E8DC" },
  {
    id: "aurora",
    label: "Cực quang",
    gradient: "linear-gradient(90deg,#7EC8FF,#B89BFF,#F0A8C0,#E5C158)",
  },
  {
    id: "cosmos",
    label: "Vũ trụ",
    gradient: "linear-gradient(90deg,#9B7BFF,#5EC8FF,#E5C158,#FF8AB0)",
  },
];

export const NAME_EFFECT_PRESETS: NameEffectPreset[] = [
  { id: "none", label: "Không" },
  { id: "glow", label: "Hào quang" },
  { id: "shimmer", label: "Lướt sáng" },
  { id: "pulse", label: "Nhịp thở" },
  { id: "sparkle", label: "Lấp lánh" },
  { id: "neon", label: "Neon" },
  { id: "float", label: "Bay nhẹ" },
  { id: "flame", label: "Lửa chữ" },
];

const COLOR_IDS = new Set(NAME_COLOR_PRESETS.map((p) => p.id));
const EFFECT_IDS = new Set(NAME_EFFECT_PRESETS.map((p) => p.id));

export function normalizeNameColor(raw: unknown): NameColorId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return COLOR_IDS.has(s as NameColorId) ? (s as NameColorId) : "default";
}

export function normalizeNameEffect(raw: unknown): NameEffectId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return EFFECT_IDS.has(s as NameEffectId) ? (s as NameEffectId) : "none";
}

export function getNameColorPreset(id: unknown): NameColorPreset {
  const n = normalizeNameColor(id);
  return NAME_COLOR_PRESETS.find((p) => p.id === n) ?? NAME_COLOR_PRESETS[0]!;
}

export function getNameEffectPreset(id: unknown): NameEffectPreset {
  const n = normalizeNameEffect(id);
  return (
    NAME_EFFECT_PRESETS.find((p) => p.id === n) ?? NAME_EFFECT_PRESETS[0]!
  );
}

/** Style object cho tên có màu / gradient. */
export function nameColorStyle(
  id: unknown,
  effectId?: unknown,
): {
  color?: string;
  backgroundImage?: string;
  WebkitBackgroundClip?: "text";
  WebkitTextFillColor?: "transparent";
  backgroundClip?: "text";
} {
  const p = getNameColorPreset(id);
  const fx = normalizeNameEffect(effectId);
  if (p.id === "default" && fx !== "shimmer") return {};
  if (p.gradient || fx === "shimmer") {
    const gradient =
      p.gradient ??
      (p.hex
        ? `linear-gradient(90deg, ${p.hex}, #fff8e8, ${p.hex})`
        : "linear-gradient(90deg,#E3D8C4,#fff,#E3D8C4)");
    return {
      backgroundImage: gradient,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    };
  }
  if (p.hex) return { color: p.hex };
  return {};
}
