/** ~20 thuật toán xoay / chọn lá (không gồm ép lá 1–8). */
export const ROTATE_MODE_IDS = [
  "auto",
  "small",
  "big",
  "flat",
  "cool",
  "hot",
  "mid",
  "lowmult",
  "highmult",
  "app",
  "softapp",
  "hedge",
  "softfed",
  "fed",
  "user",
  "contrarian",
  "momentum",
  "sparse",
  "dense",
  "wild",
] as const;

export type RotateMode = (typeof ROTATE_MODE_IDS)[number];

export type PackMode = "pack1" | "pack2" | "pack3" | "pack4";

export const PACK_MODES: PackMode[] = ["pack1", "pack2", "pack3", "pack4"];

export const ROTATE_LABELS: Record<RotateMode, string> = {
  auto: "Auto — weight gốc",
  small: "Small — ưu tiên lá 1–4",
  big: "Big — ưu tiên lá 5–8",
  flat: "Flat — ~12.5% mỗi lá",
  cool: "Cool — giảm 3 lá thắng gần nhất",
  hot: "Hot — tăng lá vừa thắng gần đây",
  mid: "Mid — ưu tiên lá 3–6",
  lowmult: "LowMult — thiên hệ số thấp (1–4)",
  highmult: "HighMult — thiên hệ số cao (5–8)",
  app: "App — hút xu (mềm)",
  softapp: "SoftApp — hút xu rất nhẹ",
  hedge: "Hedge — lệch profit² nhà",
  softfed: "SoftFed — giữ xu vừa phải",
  fed: "Fed — lá nhà lời tối đa",
  user: "User — nhả xu (cược cao)",
  contrarian: "Contrarian — ưu tiên lá ít cược",
  momentum: "Momentum — theo lá nhiều cược",
  sparse: "Sparse — boost lá chưa ai đánh",
  dense: "Dense — boost lá đông cược",
  wild: "Wild — ngẫu nhiên 2 lá trọng số cao",
};

/** Bộ mode 1–4 — chuỗi xoay cố định. */
export const MODE_PACK_ROTATIONS: Record<PackMode, RotateMode[]> = {
  pack1: ["auto", "flat", "small", "big", "cool", "mid"],
  pack2: ["app", "softapp", "hedge", "softfed", "fed", "contrarian"],
  pack3: ["user", "momentum", "hot", "dense", "sparse", "highmult"],
  pack4: [
    "wild",
    "lowmult",
    "highmult",
    "cool",
    "hot",
    "fed",
    "user",
    "auto",
  ],
};

export const MODE_PACK_LABELS: Record<PackMode, string> = {
  pack1: "Bộ 1 — Cân bằng / bias nhóm",
  pack2: "Bộ 2 — Giữ xu / nhà",
  pack3: "Bộ 3 — Trả thưởng / cầu",
  pack4: "Bộ 4 — Hỗn hợp 20 thuật",
};

export function isRotateMode(v: unknown): v is RotateMode {
  return (
    typeof v === "string" &&
    (ROTATE_MODE_IDS as readonly string[]).includes(v)
  );
}

export function isPackMode(v: unknown): v is PackMode {
  return v === "pack1" || v === "pack2" || v === "pack3" || v === "pack4";
}

export function packRotation(pack: PackMode): RotateMode[] {
  return [...MODE_PACK_ROTATIONS[pack]];
}

/** Legacy default ALL chain. */
export const ALL_ROTATION_DEFAULT: RotateMode[] = [
  "auto",
  "small",
  "big",
  "flat",
  "app",
  "hedge",
  "fed",
  "cool",
  "user",
];
