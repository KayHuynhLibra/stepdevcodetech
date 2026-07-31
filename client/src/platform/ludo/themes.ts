export type LudoThemeId = "classic" | "soccer" | "arena";

export const LUDO_THEMES: {
  id: LudoThemeId;
  nameVi: string;
  blurb: string;
  swatch: string;
}[] = [
  {
    id: "classic",
    nameVi: "Cổ điển",
    blurb: "Gỗ · kem · bàn quen thuộc",
    swatch: "linear-gradient(135deg,#f7efe0,#c23b2e 40%,#2b6cb0)",
  },
  {
    id: "soccer",
    nameVi: "Sân bóng",
    blurb: "Cỏ · khung thành · safe bóng",
    swatch: "linear-gradient(135deg,#7bc67e,#1e7a3a 45%,#f5f5f5)",
  },
  {
    id: "arena",
    nameVi: "Đấu trường",
    blurb: "Đá tối · nút khối lửa",
    swatch: "linear-gradient(135deg,#2a2030,#c45a12 50%,#1a1210)",
  },
];

export function isLudoThemeId(v: unknown): v is LudoThemeId {
  return v === "classic" || v === "soccer" || v === "arena";
}

export function normalizeThemeId(v: unknown): LudoThemeId {
  return isLudoThemeId(v) ? v : "classic";
}
