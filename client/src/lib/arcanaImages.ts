import type { SyntheticEvent } from "react";

/** Portrait art for Arcana wheel (not Tarot card faces). */
export const ARCANA_PORTRAIT_BY_ID: Record<number, string> = {
  1: "/assets/arcana-chars/char-01-lucent.webp?v=1",
  2: "/assets/arcana-chars/char-02-veil.webp?v=1",
  3: "/assets/arcana-chars/char-03-aurelia.webp?v=1",
  4: "/assets/arcana-chars/char-04-kael.webp?v=1",
  5: "/assets/arcana-chars/char-05-twinflame.webp?v=1",
  6: "/assets/arcana-chars/char-06-vanguard.webp?v=1",
  7: "/assets/arcana-chars/char-07-astraea.webp?v=1",
  8: "/assets/arcana-chars/char-08-solara.webp?v=1",
};

const CARD_FALLBACK_BY_ID: Record<number, string> = {
  1: "/assets/cards/card-01-magician.webp?v=6",
  2: "/assets/cards/card-02-priestess.webp?v=6",
  3: "/assets/cards/card-03-empress.webp?v=6",
  4: "/assets/cards/card-04-emperor.webp?v=6",
  5: "/assets/cards/card-05-lovers.webp?v=6",
  6: "/assets/cards/card-06-chariot.webp?v=6",
  7: "/assets/cards/card-07-star.webp?v=6",
  8: "/assets/cards/card-08-sun.webp?v=6",
};

export const ARCANA_IMAGE_BACK = "/assets/cards/card-back.webp?v=6";

export function arcanaPortraitUrl(id: number): string {
  return ARCANA_PORTRAIT_BY_ID[id] ?? ARCANA_IMAGE_BACK;
}

export function arcanaCardFallbackUrl(id: number): string {
  return CARD_FALLBACK_BY_ID[id] ?? ARCANA_IMAGE_BACK;
}

/** onError: portrait → card face → card back */
export function onArcanaImgError(
  e: SyntheticEvent<HTMLImageElement>,
  slotId?: number,
): void {
  const img = e.currentTarget;
  const stage = img.dataset.arcanaFb ?? "0";
  if (stage === "0" && slotId != null && CARD_FALLBACK_BY_ID[slotId]) {
    img.dataset.arcanaFb = "1";
    img.src = CARD_FALLBACK_BY_ID[slotId]!;
    return;
  }
  if (stage !== "2") {
    img.dataset.arcanaFb = "2";
    img.src = ARCANA_IMAGE_BACK;
  }
}
