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

/**
 * Pipeline rút lá (cao → thấp):
 * 1) primaryTier MODE1/MODE2/MODE3 — lớp phủ toàn cục (áp ALL + mode đơn + pack)
 * 2) Thuật toán slot / mode cố định
 * 3) winBiasPct / engagement
 *
 * MODE2: lá 4–8 ×0.5 · MODE3: lá 4–8 ×0.25 — sau thuật toán.
 */
export const MODE_PACK_ROTATIONS: Record<PackMode, RotateMode[]> = {
  pack1: ["auto", "flat", "small", "big", "cool", "mid"],
  pack2: ["auto", "flat", "small", "big", "cool", "mid"],
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
    "app",
    "softapp",
    "hedge",
    "softfed",
    "auto",
  ],
};

/** @deprecated — mul theo pack; overlay thật dùng primaryTierHighCardMul. */
export const MODE_PACK_HIGH_CARD_WEIGHT_MUL: Partial<Record<PackMode, number>> = {
  pack2: 0.5,
};

/** @deprecated */
export const MODE_PACK_HIGH_CARD_DAMP_PCT = MODE_PACK_HIGH_CARD_WEIGHT_MUL;

export const MODE_PACK_LABELS: Record<PackMode, string> = {
  pack1: "Chuỗi bias (auto→flat→small→big→cool→mid)",
  pack2: "Chuỗi bias (giống pack1)",
  pack3: "Bộ 3 — Tầng thuật · trả xu / cầu",
  pack4: "Bộ 4 — Tầng thuật · hỗn hợp + guard",
};

export type PrimaryTier = "mode1" | "mode2" | "mode3";

export const PRIMARY_TIERS: PrimaryTier[] = ["mode1", "mode2", "mode3"];

export function isPrimaryTier(v: unknown): v is PrimaryTier {
  return v === "mode1" || v === "mode2" || v === "mode3";
}

/** Hệ số weight lá cao theo cấp MODE (áp mọi ALL / mode đơn / pack). */
export function primaryTierHighCardMul(tier: PrimaryTier): number {
  if (tier === "mode3") return 0.25;
  if (tier === "mode2") return 0.5;
  return 1;
}

/** MODE2 giảm nhóm lá cao — gồm cả #4 (người chơi hay Auto 4–8). */
export const MODE2_HIGH_CARD_MIN_ID = 4;

/** Shortcut pack bias (không còn là cấp MODE — cấp MODE = primaryTier). */
export const PRIMARY_MODE_PACKS: PackMode[] = ["pack1", "pack2"];

export function isPrimaryModePack(v: unknown): v is PackMode {
  return v === "pack1" || v === "pack2";
}

/**
 * Nhân weight lá cao (≥ minId) với `mul` (0.5 = chia đôi %).
 * Lá thấp hơn giữ nguyên → % thực tế tăng tương đối.
 */
export function scaleHighCardWeights(
  weights: number[],
  cardIds: number[],
  mul: number,
  minHighId: number = MODE2_HIGH_CARD_MIN_ID,
): number[] {
  const m = Number(mul);
  if (!Number.isFinite(m) || m <= 0 || m === 1) return weights;
  const clamped = Math.max(0.01, Math.min(m, 10));
  const minId = Math.max(1, Math.floor(Number(minHighId) || MODE2_HIGH_CARD_MIN_ID));
  return cardIds.map((id, i) => {
    const w = weights[i]!;
    return id >= minId ? w * clamped : w;
  });
}

/** Legacy tên — mul = 1 − dampPct/100 nếu dampPct>1 nghĩa là % cắt; nếu ≤1 coi là hệ số trực tiếp. */
export function dampenHighCardWeights(
  weights: number[],
  cardIds: number[],
  mulOrDamp: number,
): number[] {
  const n = Number(mulOrDamp);
  if (!Number.isFinite(n) || n <= 0) return weights;
  // 0.5 → chia đôi; 50 → cắt 50% (cũng ×0.5)
  const mul = n > 1 ? Math.max(0.01, 1 - n / 100) : n;
  return scaleHighCardWeights(weights, cardIds, mul);
}

export function packHighCardWeightMul(pack: PackMode): number {
  return MODE_PACK_HIGH_CARD_WEIGHT_MUL[pack] ?? 1;
}

/** @deprecated */
export function packHighCardDampPct(pack: PackMode): number {
  return packHighCardWeightMul(pack);
}

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
