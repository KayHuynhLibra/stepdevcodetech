/**
 * Catalog SFX — gói âm (voice pack) khác nhau về chất liệu, không chỉ chỉnh êm/sắc.
 * Upload file vẫn override từng slot.
 */

export type SfxStyleId = "classic" | "mystic" | "casino" | "fortune";

/** Legacy admin / preset IDs — map sang gói mới */
export type SfxStyleIdLegacy = "soft" | "crisp" | "bright";

export const SFX_STYLES: {
  id: SfxStyleId;
  label: string;
  hint: string;
}[] = [
  { id: "classic", label: "Cổ điển", hint: "Bài gỗ · dày lớp" },
  { id: "mystic", label: "Huyền bí", hint: "Pad · chuông nghi lễ" },
  { id: "casino", label: "Sòng bài", hint: "Chip · dứt · rõ" },
  { id: "fortune", label: "Tài vận", hint: "Chuông may · fanfare" },
];

export function normalizeSfxStyleId(v: unknown): SfxStyleId | null {
  if (v === "classic" || v === "mystic" || v === "casino" || v === "fortune") {
    return v;
  }
  if (v === "soft") return "mystic";
  if (v === "crisp") return "casino";
  if (v === "bright") return "fortune";
  return null;
}

export function isSfxStyleId(v: unknown): v is SfxStyleId {
  return normalizeSfxStyleId(v) != null;
}

/** Slot bàn Tarot 8 lá (ưu tiên) */
export const TAROT_SFX_SLOTS = [
  "gather",
  "shuffle",
  "suspense",
  "flip",
  "win",
  "lose",
  "tick",
] as const;

export type TarotSfxSlot = (typeof TAROT_SFX_SLOTS)[number];

export const TAROT_SFX_SLOT_META: Record<
  TarotSfxSlot,
  { label: string; hint: string }
> = {
  gather: { label: "Gom bài", hint: "Thu lá về giữa" },
  shuffle: { label: "Xào bài", hint: "Trộn bộ trước trải" },
  suspense: { label: "Hồi hộp", hint: "Trước khi lật" },
  flip: { label: "Lật lá", hint: "Úp → ngửa" },
  win: { label: "Thắng", hint: "Kết quả thắng" },
  lose: { label: "Thua", hint: "Kết quả thua" },
  tick: { label: "Đếm giây", hint: "Tick 5s cuối" },
};

export const OLYMPUS_SFX_SLOTS = [
  "spin",
  "land",
  "thunder",
  "oly_win",
] as const;

export type OlympusSfxSlot = (typeof OLYMPUS_SFX_SLOTS)[number];

export const OLYMPUS_SFX_SLOT_META: Record<
  OlympusSfxSlot,
  { label: string; hint: string }
> = {
  spin: { label: "Quay", hint: "Bắt đầu spin" },
  land: { label: "Dừng ô", hint: "Reel / ô dừng" },
  thunder: { label: "Sấm", hint: "Zeus / bolt" },
  oly_win: { label: "Thắng", hint: "Win Olympus" },
};

export const BOI_SFX_SLOTS = ["flip", "shuffle", "ui"] as const;

export type BoiSfxSlot = (typeof BOI_SFX_SLOTS)[number];

export const BOI_SFX_SLOT_META: Record<
  BoiSfxSlot,
  { label: string; hint: string }
> = {
  flip: { label: "Lật lá", hint: "Ritual flip" },
  shuffle: { label: "Xào", hint: "Xào bộ" },
  ui: { label: "UI", hint: "Click / nút" },
};

/** Slot Arcana wheel */
export const ARCANA_SFX_SLOTS = [
  "spin",
  "land",
  "win",
  "lose",
  "ui",
] as const;

export type ArcanaSfxSlot = (typeof ARCANA_SFX_SLOTS)[number];

export const ARCANA_SFX_SLOT_META: Record<
  ArcanaSfxSlot,
  { label: string; hint: string }
> = {
  spin: { label: "Quay", hint: "Bắt đầu spin bánh" },
  land: { label: "Dừng", hint: "Kim dừng ô" },
  win: { label: "Thắng", hint: "Kết quả thắng" },
  lose: { label: "Thua", hint: "Kết quả thua" },
  ui: { label: "UI", hint: "Click / nút" },
};

/** Slot Ludo */
export const LUDO_SFX_SLOTS = [
  "roll",
  "move",
  "capture",
  "home",
  "win",
  "tick",
  "ui",
] as const;

export type LudoSfxSlot = (typeof LUDO_SFX_SLOTS)[number];

export const LUDO_SFX_SLOT_META: Record<
  LudoSfxSlot,
  { label: string; hint: string }
> = {
  roll: { label: "Xúc xắc", hint: "Tung xúc xắc" },
  move: { label: "Đi quân", hint: "Quân nhảy ô" },
  capture: { label: "Ăn quân", hint: "Đá đối thủ về chuồng" },
  home: { label: "Về đích", hint: "Vào cột / về nhà" },
  win: { label: "Thắng", hint: "Ván kết thúc" },
  tick: { label: "Đếm giây", hint: "Tick 5s cuối" },
  ui: { label: "UI", hint: "Click / nút" },
};

export type SfxSlotName =
  | TarotSfxSlot
  | OlympusSfxSlot
  | BoiSfxSlot
  | ArcanaSfxSlot
  | LudoSfxSlot
  | "ui";
