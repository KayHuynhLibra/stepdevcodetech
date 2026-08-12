export type OracleDeckId = string;

export type OracleSuit =
  | "major"
  | "wands"
  | "cups"
  | "swords"
  | "pentacles"
  | "zodiac"
  | "lenormand"
  | "tea"
  | string;

export type OracleTradition =
  | "rider-waite"
  | "marseille"
  | "thoth"
  | "custom"
  | "zodiac";

export type OracleCardLevel = "public" | "deep";

export type OracleCardDomains = {
  love?: string;
  work?: string;
  money?: string;
  health?: string;
};

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
  domains?: OracleCardDomains;
  level?: OracleCardLevel;
  sourceDoc?: string;
}

export interface OracleSpread {
  id: string;
  nameVi: string;
  blurb: string;
  cardCount: number;
  positions: string[];
  enabled: boolean;
  sort: number;
  tags?: string[];
  source?: string;
  draft?: boolean;
}

export interface OracleTimingHint {
  id: string;
  labelVi: string;
  suit?: string;
  number?: number;
  key?: string;
  hint: string;
  sort: number;
}

export interface OracleLibraryDoc {
  id: string;
  title: string;
  pages?: number;
  ingestedAt: number;
  version: string;
  notes?: string;
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
  /** Chỉ staff / lab — không có trên catalog public */
  theoryNotes?: string;
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
  timingHint?: string;
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
  lenormand: "Lenormand",
  tea: "Trà",
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
  "lenormand",
  "tea",
] as const;

export const ORACLE_TRADITION_PRESETS: OracleTradition[] = [
  "rider-waite",
  "marseille",
  "thoth",
  "custom",
  "zodiac",
];
