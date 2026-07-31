export type OracleDeckId = string;

export type OracleSuit =
  | "major"
  | "wands"
  | "cups"
  | "swords"
  | "pentacles"
  | "zodiac"
  | string;

export type OracleTradition =
  | "rider-waite"
  | "marseille"
  | "thoth"
  | "custom"
  | "zodiac";

export interface OracleDeckMeta {
  id: OracleDeckId;
  nameVi: string;
  blurb: string;
  enabled: boolean;
  sort: number;
  tradition?: OracleTradition;
  research?: boolean;
}

export interface OracleCard {
  key: string;
  deckId: OracleDeckId;
  name: string;
  nameVi: string;
  number: number;
  suit?: OracleSuit;
  element?: string;
  upright: string;
  reversed: string;
  keywords: string[];
  image: string;
  enabled: boolean;
  sort: number;
  blurb?: string;
  tags?: string[];
  notes?: string;
  citations?: string;
  draft?: boolean;
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

export interface OracleDrawHistoryRow {
  id: string;
  at: number;
  deckId: OracleDeckId;
  cards: DrawnOracleCard[];
  spread?: string;
  question?: string;
  notes?: string;
  title?: string;
  mantraClose?: string;
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

export const ORACLE_TRADITION_LABEL: Record<OracleTradition, string> = {
  "rider-waite": "Rider–Waite",
  marseille: "Marseille",
  thoth: "Thoth",
  custom: "Custom",
  zodiac: "Chiêm tinh",
};

export const ORACLE_SUIT_PRESETS = [
  "major",
  "wands",
  "cups",
  "swords",
  "pentacles",
  "zodiac",
] as const;

export const ORACLE_TRADITION_PRESETS: OracleTradition[] = [
  "rider-waite",
  "marseille",
  "thoth",
  "custom",
  "zodiac",
];
