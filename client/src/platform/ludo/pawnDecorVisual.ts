/** Map shop item id → CSS / visual variant for Ludo pawns. */

export type LudoPawnVisual = {
  cssClass: string;
  glyph: string;
  label: string;
};

const PAWN_VISUALS: Record<string, LudoPawnVisual> = {
  "pawn-classic": {
    cssClass: "ludo-pawn--classic",
    glyph: "",
    label: "Quân cổ điển",
  },
  "pawn-gem": {
    cssClass: "ludo-pawn--gem",
    glyph: "◆",
    label: "Quân gem",
  },
  "pawn-crown": {
    cssClass: "ludo-pawn--crown",
    glyph: "♛",
    label: "Quân vương miện",
  },
  "pawn-bolt": {
    cssClass: "ludo-pawn--bolt",
    glyph: "⚡",
    label: "Quân sét",
  },
};

export function pawnDecorClass(id?: string | null): string {
  if (!id) return PAWN_VISUALS["pawn-classic"]!.cssClass;
  if (id.startsWith("ludo-pawn--")) return id;
  return PAWN_VISUALS[id]?.cssClass ?? `ludo-pawn--${id.replace(/^pawn-/, "")}`;
}

export function pawnDecorGlyph(id?: string | null): string {
  if (!id) return "";
  return PAWN_VISUALS[id]?.glyph ?? "";
}

export function pawnDecorLabel(id?: string | null): string {
  if (!id) return PAWN_VISUALS["pawn-classic"]!.label;
  return PAWN_VISUALS[id]?.label ?? id;
}

/** 3D material tweaks by decor id */
export function pawnDecor3dStyle(id?: string | null): {
  metalness: number;
  roughness: number;
  emissiveIntensity: number;
  scale: number;
} {
  switch (id) {
    case "pawn-gem":
      return { metalness: 0.85, roughness: 0.12, emissiveIntensity: 0.45, scale: 1.05 };
    case "pawn-crown":
      return { metalness: 0.55, roughness: 0.28, emissiveIntensity: 0.2, scale: 1.12 };
    case "pawn-bolt":
      return { metalness: 0.35, roughness: 0.35, emissiveIntensity: 0.65, scale: 1.08 };
    default:
      return { metalness: 0.15, roughness: 0.45, emissiveIntensity: 0, scale: 1 };
  }
}
