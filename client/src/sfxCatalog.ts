/**
 * Catalog SFX — 4 kiểu synth / slot + optional file upload override.
 * Dùng chung client + khớp server playMediaPresets.sfx.styles / paths.
 */

export type SfxStyleId = "classic" | "soft" | "crisp" | "bright";

export const SFX_STYLES: {
  id: SfxStyleId;
  label: string;
  hint: string;
}[] = [
  { id: "classic", label: "Cổ điển", hint: "Mặc định hiện tại" },
  { id: "soft", label: "Êm", hint: "Nhẹ · ít ồn" },
  { id: "crisp", label: "Sắc", hint: "Nhanh · rõ" },
  { id: "bright", label: "Sáng", hint: "Cao · vui" },
];

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

export type SfxSlotName =
  | TarotSfxSlot
  | OlympusSfxSlot
  | BoiSfxSlot
  | ArcanaSfxSlot
  | "ui";

export function isSfxStyleId(v: unknown): v is SfxStyleId {
  return (
    v === "classic" || v === "soft" || v === "crisp" || v === "bright"
  );
}
