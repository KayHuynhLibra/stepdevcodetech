export type OracleDeckId = "tarot" | "zodiac";

export interface OracleDeckMeta {
  id: OracleDeckId;
  nameVi: string;
  blurb: string;
  enabled: boolean;
  sort: number;
}

export interface OracleCard {
  key: string;
  deckId: OracleDeckId;
  name: string;
  nameVi: string;
  number: number;
  suit?: "major" | "wands" | "cups" | "swords" | "pentacles" | "zodiac";
  element?: string;
  upright: string;
  reversed: string;
  keywords: string[];
  image: string;
  enabled: boolean;
  sort: number;
  blurb?: string;
}

export interface DrawnOracleCard {
  key: string;
  deckId: OracleDeckId;
  name: string;
  nameVi: string;
  number: number;
  suit?: OracleCard["suit"];
  element?: string;
  upright: string;
  reversed: string;
  keywords: string[];
  image: string;
  blurb?: string;
  reversedDraw: boolean;
  meaning: string;
  position?: string;
}

export function isOracleEmoji(image: string | undefined | null): boolean {
  const s = String(image ?? "").trim();
  if (!s) return true;
  if (s.startsWith("/") || s.startsWith("http") || s.startsWith("data:")) {
    return false;
  }
  return true;
}

export const ORACLE_SUIT_LABEL: Record<string, string> = {
  major: "Major",
  wands: "Gậy",
  cups: "Cốc",
  swords: "Kiếm",
  pentacles: "Tiền",
  zodiac: "Cung",
};
