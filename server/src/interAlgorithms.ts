/** ~26 thuật toán xoay / chọn lá (không gồm ép lá 1–8). */
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
  "softuser",
  "contrarian",
  "momentum",
  "sparse",
  "dense",
  "wild",
  "vaultguard",
  "vaultpct",
  "flowguard",
  "moneysteer",
  "crowdcap",
  "fogbreak",
  "smartai",
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
  user: "User — nhả xu (đặt cao)",
  softuser: "SoftUser — nhả xu nhẹ",
  contrarian: "Contrarian — ưu tiên lá ít người đặt",
  momentum: "Momentum — theo lá nhiều người đặt",
  sparse: "Sparse — boost lá chưa ai đánh",
  dense: "Dense — boost lá đông người đặt",
  wild: "Wild — ngẫu nhiên 2 lá trọng số cao",
  vaultguard: "VaultGuard — kho lỗ→hút, lãi→nhả nhẹ (xu)",
  vaultpct: "VaultPct — theo % edge kho Tarot",
  flowguard: "FlowGuard — theo % dòng tiền 1h/24h",
  moneysteer: "MoneySteer — gộp % cả 2 kho + flow (điều khiển)",
  crowdcap: "CrowdCap — giảm lá bị đám đông pile",
  fogbreak: "FogBreak — bẻ cầu mềm (nhiễu, không lộ)",
  smartai: "SmartAI — học online từ cầu/stake/kho (nhẹ)",
};

/** Bộ mode 1–4 — chuỗi xoay cố định. */
export const MODE_PACK_ROTATIONS: Record<PackMode, RotateMode[]> = {
  pack1: ["auto", "flat", "small", "big", "cool", "mid"],
  pack2: [
    "app",
    "softapp",
    "hedge",
    "softfed",
    "fed",
    "vaultguard",
    "vaultpct",
    "flowguard",
    "moneysteer",
    "contrarian",
  ],
  pack3: [
    "user",
    "softuser",
    "momentum",
    "hot",
    "dense",
    "sparse",
    "fogbreak",
    "highmult",
  ],
  pack4: [
    "wild",
    "crowdcap",
    "fogbreak",
    "smartai",
    "vaultguard",
    "vaultpct",
    "moneysteer",
    "softuser",
    "cool",
    "hot",
    "fed",
    "user",
    "auto",
  ],
};

export const MODE_PACK_LABELS: Record<PackMode, string> = {
  pack1: "Bộ 1 — Cân bằng / bias nhóm",
  pack2: "Bộ 2 — Giữ xu / nhà / kho",
  pack3: "Bộ 3 — Trả xu / cầu / bẻ cầu mềm",
  pack4: "Bộ 4 — Hỗn hợp + guard + fog",
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
  "vaultguard",
  "vaultpct",
  "moneysteer",
  "fed",
  "cool",
  "user",
  "crowdcap",
  "fogbreak",
  "smartai",
];
