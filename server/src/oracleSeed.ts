/**
 * Seed full bộ bài Bói: Tarot 78 lá (Major + Minor) × 3 truyền thống + Chiêm tinh 12 cung.
 * Nghĩa đầy đủ lấy từ oracleMeanings.ts — admin có thể cập nhật qua API / store JSON.
 */

import {
  MAJOR_MEANINGS,
  MARSEILLE_CITATION,
  MARSEILLE_MAJOR_NOTES,
  MINOR_MEANINGS,
  ORACLE_THEORY_SEED_VERSION,
  THOTH_CITATION,
  THOTH_MAJOR_NOTES,
  ZODIAC_MEANINGS,
} from "./oracleMeanings.js";
import {
  buildLenormandCards,
  buildTeaCards,
  LENORMAND_DECK_META,
  TEA_DECK_META,
} from "./oracleLenormandTea.js";

export { ORACLE_THEORY_SEED_VERSION };

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
  /** Highlight trên Lab nghiên cứu */
  research?: boolean;
}

export interface OracleCardSeed {
  key: string;
  deckId: OracleDeckId;
  name: string;
  nameVi: string;
  /** Số thứ tự trong bộ (0–21 major, 1–14 minor rank, 1–12 zodiac) */
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
  /** Ẩn khỏi catalog/draw public; staff Lab vẫn thấy */
  draft?: boolean;
  domains?: OracleCardDomains;
  level?: OracleCardLevel;
  sourceDoc?: string;
}

/** Parse notes dạng «Tình yêu: …\\nCông việc: …» từ PDF 78 lá. */
export function parseDomainsFromNotes(notes?: string): OracleCardDomains | undefined {
  const raw = String(notes ?? "").trim();
  if (!raw) return undefined;
  const domains: OracleCardDomains = {};
  const take = (label: RegExp, key: keyof OracleCardDomains) => {
    const m = raw.match(label);
    if (m?.[1]) domains[key] = m[1].trim().slice(0, 500);
  };
  take(/Tình yêu:\s*([^\n]+)/i, "love");
  take(/Công việc:\s*([^\n]+)/i, "work");
  take(/Tiền bạc:\s*([^\n]+)/i, "money");
  take(/Sức khỏe:\s*([^\n]+)/i, "health");
  return Object.keys(domains).length ? domains : undefined;
}

function withDocMeta(
  card: OracleCardSeed,
  sourceDoc: string,
): OracleCardSeed {
  const domains = card.domains ?? parseDomainsFromNotes(card.notes);
  return {
    ...card,
    domains,
    level: card.level ?? "public",
    sourceDoc: card.sourceDoc ?? sourceDoc,
  };
}

const MAJOR_META: {
  key: string;
  name: string;
  nameVi: string;
  number: number;
  element: string;
}[] = [
  { key: "fool", name: "The Fool", nameVi: "Kẻ Khờ", number: 0, element: "Air" },
  { key: "magician", name: "The Magician", nameVi: "Nhà Ảo Thuật", number: 1, element: "Air" },
  { key: "priestess", name: "The High Priestess", nameVi: "Nữ Tư Tế", number: 2, element: "Water" },
  { key: "empress", name: "The Empress", nameVi: "Nữ Hoàng", number: 3, element: "Earth" },
  { key: "emperor", name: "The Emperor", nameVi: "Hoàng Đế", number: 4, element: "Fire" },
  { key: "hierophant", name: "The Hierophant", nameVi: "Giáo Hoàng", number: 5, element: "Earth" },
  { key: "lovers", name: "The Lovers", nameVi: "Đôi Tình Nhân", number: 6, element: "Air" },
  { key: "chariot", name: "The Chariot", nameVi: "Chiến Xa", number: 7, element: "Water" },
  { key: "strength", name: "Strength", nameVi: "Sức Mạnh", number: 8, element: "Fire" },
  { key: "hermit", name: "The Hermit", nameVi: "Ẩn Sĩ", number: 9, element: "Earth" },
  { key: "wheel", name: "Wheel of Fortune", nameVi: "Bánh Xe Số Phận", number: 10, element: "Fire" },
  { key: "justice", name: "Justice", nameVi: "Công Lý", number: 11, element: "Air" },
  { key: "hanged", name: "The Hanged Man", nameVi: "Người Bị Treo", number: 12, element: "Water" },
  { key: "death", name: "Death", nameVi: "Tử Thần", number: 13, element: "Water" },
  { key: "temperance", name: "Temperance", nameVi: "Tiết Chế", number: 14, element: "Fire" },
  { key: "devil", name: "The Devil", nameVi: "Ác Quỷ", number: 15, element: "Earth" },
  { key: "tower", name: "The Tower", nameVi: "Tòa Tháp", number: 16, element: "Fire" },
  { key: "star", name: "The Star", nameVi: "Ngôi Sao", number: 17, element: "Air" },
  { key: "moon", name: "The Moon", nameVi: "Mặt Trăng", number: 18, element: "Water" },
  { key: "sun", name: "The Sun", nameVi: "Mặt Trời", number: 19, element: "Fire" },
  { key: "judgement", name: "Judgement", nameVi: "Phán Xét", number: 20, element: "Fire" },
  { key: "world", name: "The World", nameVi: "Thế Giới", number: 21, element: "Earth" },
];

const ZODIAC_META: {
  key: string;
  name: string;
  nameVi: string;
  number: number;
  element: string;
  blurb: string;
}[] = [
  { key: "aries", name: "Aries", nameVi: "Bạch Dương", number: 1, element: "Fire", blurb: "21/3 – 19/4" },
  { key: "taurus", name: "Taurus", nameVi: "Kim Ngưu", number: 2, element: "Earth", blurb: "20/4 – 20/5" },
  { key: "gemini", name: "Gemini", nameVi: "Song Tử", number: 3, element: "Air", blurb: "21/5 – 20/6" },
  { key: "cancer", name: "Cancer", nameVi: "Cự Giải", number: 4, element: "Water", blurb: "21/6 – 22/7" },
  { key: "leo", name: "Leo", nameVi: "Sư Tử", number: 5, element: "Fire", blurb: "23/7 – 22/8" },
  { key: "virgo", name: "Virgo", nameVi: "Xử Nữ", number: 6, element: "Earth", blurb: "23/8 – 22/9" },
  { key: "libra", name: "Libra", nameVi: "Thiên Bình", number: 7, element: "Air", blurb: "23/9 – 22/10" },
  { key: "scorpio", name: "Scorpio", nameVi: "Thiên Yết", number: 8, element: "Water", blurb: "23/10 – 21/11" },
  { key: "sagittarius", name: "Sagittarius", nameVi: "Nhân Mã", number: 9, element: "Fire", blurb: "22/11 – 21/12" },
  { key: "capricorn", name: "Capricorn", nameVi: "Ma Kết", number: 10, element: "Earth", blurb: "22/12 – 19/1" },
  { key: "aquarius", name: "Aquarius", nameVi: "Bảo Bình", number: 11, element: "Air", blurb: "20/1 – 18/2" },
  { key: "pisces", name: "Pisces", nameVi: "Song Ngư", number: 12, element: "Water", blurb: "19/2 – 20/3" },
];

type SuitKey = "wands" | "cups" | "swords" | "pentacles";

const SUITS: {
  key: SuitKey;
  name: string;
  nameVi: string;
  element: string;
}[] = [
  { key: "wands", name: "Wands", nameVi: "Gậy", element: "Fire" },
  { key: "cups", name: "Cups", nameVi: "Cốc", element: "Water" },
  { key: "swords", name: "Swords", nameVi: "Kiếm", element: "Air" },
  { key: "pentacles", name: "Pentacles", nameVi: "Tiền", element: "Earth" },
];

const RANKS: { n: number; en: string; vi: string }[] = [
  { n: 1, en: "Ace", vi: "Át" },
  { n: 2, en: "Two", vi: "Hai" },
  { n: 3, en: "Three", vi: "Ba" },
  { n: 4, en: "Four", vi: "Bốn" },
  { n: 5, en: "Five", vi: "Năm" },
  { n: 6, en: "Six", vi: "Sáu" },
  { n: 7, en: "Seven", vi: "Bảy" },
  { n: 8, en: "Eight", vi: "Tám" },
  { n: 9, en: "Nine", vi: "Chín" },
  { n: 10, en: "Ten", vi: "Mười" },
  { n: 11, en: "Page", vi: "Đầy tớ" },
  { n: 12, en: "Knight", vi: "Hiệp sĩ" },
  { n: 13, en: "Queen", vi: "Nữ hoàng" },
  { n: 14, en: "King", vi: "Nhà vua" },
];

function requireMeaning(
  map: Record<string, { upright: string; reversed: string; keywords: string[]; notes?: string; citations?: string }>,
  key: string,
) {
  const m = map[key];
  if (!m) throw new Error(`Missing oracle meaning for ${key}`);
  return m;
}

function majorCards(deckId: OracleDeckId = "tarot"): OracleCardSeed[] {
  return MAJOR_META.map((c, i) => {
    const m = requireMeaning(MAJOR_MEANINGS, c.key);
    return withDocMeta(
      {
        key: c.key,
        deckId,
        name: c.name,
        nameVi: c.nameVi,
        number: c.number,
        suit: "major" as const,
        element: c.element,
        upright: m.upright,
        reversed: m.reversed,
        keywords: m.keywords,
        image: `/assets/oracle/tarot/${c.key}.jpg`,
        enabled: true,
        sort: i,
        blurb: `Major · ${c.number}`,
        tags: ["rider-waite", "major"],
        notes: m.notes ?? "",
        citations: m.citations ?? "",
        draft: false,
      },
      "tarot-78-156",
    );
  });
}

function minorCards(deckId: OracleDeckId = "tarot"): OracleCardSeed[] {
  const out: OracleCardSeed[] = [];
  let sort = 100;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const key = `${suit.key}_${rank.n}`;
      const m = requireMeaning(MINOR_MEANINGS, key);
      out.push(
        withDocMeta(
          {
            key,
            deckId,
            name: `${rank.en} of ${suit.name}`,
            nameVi: `${rank.vi} ${suit.nameVi}`,
            number: rank.n,
            suit: suit.key,
            element: suit.element,
            upright: m.upright,
            reversed: m.reversed,
            keywords: m.keywords,
            image: `/assets/oracle/tarot/${key}.jpg`,
            enabled: true,
            sort: sort++,
            blurb: `Minor · ${suit.nameVi}`,
            tags: ["rider-waite", suit.key],
            notes: m.notes ?? "",
            citations: m.citations ?? "",
            draft: false,
          },
          "tarot-78-156",
        ),
      );
    }
  }
  return out;
}

export const DEFAULT_ORACLE_DECKS: OracleDeckMeta[] = [
  {
    id: "tarot",
    nameVi: "Rider–Waite (78 lá)",
    blurb: "Truyền thống Rider–Waite–Smith — Major + Minor kinh điển, nghĩa đầy đủ.",
    enabled: true,
    sort: 1,
    tradition: "rider-waite",
    research: true,
  },
  {
    id: "tarot-marseille",
    nameVi: "Marseille (78 lá)",
    blurb: "Tarot de Marseille — hình học cổ; Major kèm note biểu tượng châu Âu.",
    enabled: true,
    sort: 2,
    tradition: "marseille",
    research: true,
  },
  {
    id: "tarot-thoth",
    nameVi: "Thoth (78 lá)",
    blurb: "Thoth Crowley — Qabalah, astrology, alchemy layered trên từng lá.",
    enabled: true,
    sort: 3,
    tradition: "thoth",
    research: true,
  },
  {
    id: "zodiac",
    nameVi: "Chiêm tinh (12 cung)",
    blurb: "Mười hai cung Hoàng đạo — năng lượng tháng / bản ngã.",
    enabled: true,
    sort: 10,
    tradition: "zodiac",
  },
  LENORMAND_DECK_META,
  TEA_DECK_META,
];

function cloneTarot78(
  deckId: OracleDeckId,
  tradition: OracleTradition,
  meaningTag: string,
): OracleCardSeed[] {
  const base = [...majorCards("tarot"), ...minorCards("tarot")];
  const majorNotes =
    tradition === "marseille"
      ? MARSEILLE_MAJOR_NOTES
      : tradition === "thoth"
        ? THOTH_MAJOR_NOTES
        : {};
  const citation =
    tradition === "marseille"
      ? MARSEILLE_CITATION
      : tradition === "thoth"
        ? THOTH_CITATION
        : "";

  return base.map((c) => {
    const tradNote =
      c.suit === "major" ? majorNotes[c.key] ?? "" : "";
    const notes = [tradNote, c.notes].filter(Boolean).join("\n\n");
    return withDocMeta(
      {
        ...c,
        deckId,
        upright: c.upright,
        reversed: c.reversed,
        keywords: [...c.keywords, meaningTag.toLowerCase()].slice(0, 8),
        tags: [tradition, c.suit ?? "card"].filter(Boolean) as string[],
        notes,
        citations: citation || c.citations || "",
        draft: false,
        blurb: c.blurb
          ? `${c.blurb} · ${meaningTag}`
          : `${meaningTag} · ${c.suit ?? "card"}`,
        image: c.image,
        domains: c.domains,
      },
      tradition === "marseille" ? "marseille-clone" : "thoth-clone",
    );
  });
}

export function buildDefaultOracleCards(): OracleCardSeed[] {
  const major = majorCards("tarot");
  const minors = minorCards("tarot");
  const marseille = cloneTarot78("tarot-marseille", "marseille", "Marseille");
  const thoth = cloneTarot78("tarot-thoth", "thoth", "Thoth");
  const zodiac: OracleCardSeed[] = ZODIAC_META.map((c, i) => {
    const m = requireMeaning(ZODIAC_MEANINGS, c.key);
    return withDocMeta(
      {
        key: c.key,
        deckId: "zodiac" as OracleDeckId,
        name: c.name,
        nameVi: c.nameVi,
        number: c.number,
        suit: "zodiac" as const,
        element: c.element,
        upright: m.upright,
        reversed: m.reversed,
        keywords: m.keywords,
        image: `/assets/oracle/zodiac/${c.key}.webp`,
        enabled: true,
        sort: i,
        blurb: c.blurb,
        tags: ["zodiac"],
        notes: m.notes ?? "",
        citations: m.citations ?? "",
        draft: false,
      },
      "zodiac-12",
    );
  });
  return [
    ...major,
    ...minors,
    ...marseille,
    ...thoth,
    ...zodiac,
    ...buildLenormandCards(),
    ...buildTeaCards(),
  ];
}
