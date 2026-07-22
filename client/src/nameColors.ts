/** Màu nick công khai — đồng bộ server nameColors / RoleAD. */

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

export interface NameColorPreset {
  id: NameColorId;
  label: string;
  hex?: string;
  gradient?: string;
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

const IDS = new Set(NAME_COLOR_PRESETS.map((p) => p.id));

export function normalizeNameColor(raw: unknown): NameColorId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return IDS.has(s as NameColorId) ? (s as NameColorId) : "default";
}

export function getNameColorPreset(id: unknown): NameColorPreset {
  const n = normalizeNameColor(id);
  return NAME_COLOR_PRESETS.find((p) => p.id === n) ?? NAME_COLOR_PRESETS[0]!;
}

/** Style object cho tên có màu / gradient. */
export function nameColorStyle(
  id: unknown,
): { color?: string; backgroundImage?: string; WebkitBackgroundClip?: "text"; WebkitTextFillColor?: "transparent"; backgroundClip?: "text" } {
  const p = getNameColorPreset(id);
  if (p.id === "default") return {};
  if (p.gradient) {
    return {
      backgroundImage: p.gradient,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    };
  }
  if (p.hex) return { color: p.hex };
  return {};
}
