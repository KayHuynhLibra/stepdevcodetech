import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import {
  buildDefaultOracleCards,
  DEFAULT_ORACLE_DECKS,
  ORACLE_THEORY_SEED_VERSION,
  parseDomainsFromNotes,
  type OracleCardDomains,
  type OracleCardLevel,
  type OracleCardSeed,
  type OracleDeckId,
  type OracleDeckMeta,
} from "./oracleSeed.js";
import { DEFAULT_ORACLE_SPREADS, type OracleSpreadSeed } from "./oracleSpreads.js";
import { DEFAULT_TIMING_RULES, pickTimingHint, type TimingHint } from "./oracleTiming.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "oracle-decks.json");
const TMP = join(DATA_DIR, "oracle-decks.json.tmp");
const HISTORY_PATH = join(DATA_DIR, "oracle-draws.json");
const HISTORY_TMP = join(DATA_DIR, "oracle-draws.json.tmp");

export type { OracleDeckId, OracleDeckMeta };
export type OracleSpread = OracleSpreadSeed;

export type OracleLibraryDoc = {
  id: string;
  title: string;
  pages?: number;
  ingestedAt: number;
  version: string;
  notes?: string;
};

export interface OracleCard extends OracleCardSeed {}

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

export interface OracleSnapshot {
  version: 1;
  decks: OracleDeckMeta[];
  cards: OracleCard[];
  updatedAt: number;
  spreads?: OracleSpread[];
  timingRules?: TimingHint[];
  library?: OracleLibraryDoc[];
  /** Bump khi seed lí thuyết được làm giàu — trigger merge meaning fields */
  theoryVersion?: number;
}

/** Catalog staff (book78/tarot78) — metadata only. PDF binary stays in studying/ (gitignored), never public. */
const DEFAULT_LIBRARY: OracleLibraryDoc[] = [
  {
    id: "tarot-78-156",
    title: "Tarot 78 lá - 156 trang",
    pages: 156,
    ingestedAt: 1710000000000,
    version: "1.0",
    notes: "study:pdfs/12 · promote: meanings → cards upright/reversed",
  },
  {
    id: "spread-vi",
    title: "Các spread bài tarot tiếng Việt",
    pages: 12,
    ingestedAt: 1710000100000,
    version: "1.0",
    notes: "study:pdfs/01 · promote: spreads positions (đã có seed một phần)",
  },
  {
    id: "timing-tarot",
    title: "Dự đoán thời gian trong Tarot",
    pages: 40,
    ingestedAt: 1710000200000,
    version: "1.0",
    notes: "study:pdfs/02 · promote: timingRules (đã seed suit timing)",
  },
  {
    id: "waite-74",
    title: "Hướng dẫn Waite-Smith 74",
    pages: 74,
    ingestedAt: 1710000300000,
    version: "1.0",
    notes: "study:pdfs/07 · promote: theoryNotes / keywords RWS (staff Lab)",
  },
  {
    id: "self-learn-24",
    title: "Tự học Tarot 24",
    pages: 24,
    ingestedAt: 1710000400000,
    version: "1.0",
    notes: "study:pdfs/11 · promote: Lab curriculum / mantras (không host PDF)",
  },
  {
    id: "intro-88",
    title: "Tarot dẫn nhập 88",
    pages: 88,
    ingestedAt: 1710000500000,
    version: "1.0",
    notes: "study:pdfs/09 · promote: onboarding copy Lab",
  },
  {
    id: "sample-spreads-66",
    title: "Những trải bài mẫu 66",
    pages: 66,
    ingestedAt: 1710000600000,
    version: "1.0",
    notes: "study:pdfs/08 · promote: thêm spreads layout vào CMS",
  },
  {
    id: "lenormand-36",
    title: "Lenormand 36 lá (44 trang)",
    pages: 44,
    ingestedAt: 1710000700000,
    version: "1.0",
    notes: "study:pdfs/03 · promote: deck lenormand keywords",
  },
  {
    id: "lenormand-overview",
    title: "Lenormand sơ lược 51",
    pages: 51,
    ingestedAt: 1710000800000,
    version: "1.0",
    notes: "study:pdfs/04 · promote: Lab overview + playing-card map",
  },
  {
    id: "tea-35",
    title: "Bói trà 35",
    pages: 35,
    ingestedAt: 1710000900000,
    version: "1.0",
    notes: "study:pdfs/14 · promote: deck tea keywords",
  },
  {
    id: "chu-giai",
    title: "Tarot chú giải",
    pages: 200,
    ingestedAt: 1710001000000,
    version: "1.0",
    notes: "study:pdfs/13 · promote: symbol glossary → theoryNotes (không host PDF)",
  },
  {
    id: "anthony-louis-21",
    title: "Anthony Louis toàn thư (trích 21)",
    pages: 21,
    ingestedAt: 1710001100000,
    version: "1.0",
    notes: "study:pdfs/10 · study-only copyrighted excerpt; không promote nguyên văn",
  },
  {
    id: "minor-56-summary",
    title: "56 lá ẩn phụ (3 trang)",
    pages: 3,
    ingestedAt: 1710001200000,
    version: "1.0",
    notes: "study:pdfs/06 · promote: minor arcana suit summary cheatsheet",
  },
  {
    id: "old-style-tarot",
    title: "Old style tarot",
    pages: 80,
    ingestedAt: 1710001300000,
    version: "1.0",
    notes: "study:pdfs/05 · study-only visual reference; art riêng đã có JPG RWS",
  },
  {
    id: "meanings-mega",
    title: "Ý nghĩa các lá bài trong Tarot (mega)",
    pages: 400,
    ingestedAt: 1710001400000,
    version: "1.0",
    notes: "study:pdfs/15 · study-only (~90MB); không ship binary; extract chọn lọc qua CMS",
  },
];

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, path);
}

function normalizeDeckId(raw: unknown): OracleDeckId | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
  return s.length >= 2 ? s : null;
}

function normalizeSuit(raw: unknown): OracleCard["suit"] | undefined {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  return s || undefined;
}

function normalizeDomains(raw: unknown): OracleCardDomains | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Partial<OracleCardDomains>;
  const domains: OracleCardDomains = {};
  const add = (key: keyof OracleCardDomains) => {
    const value = d[key];
    if (value == null) return;
    const text = String(value).trim().slice(0, 500);
    if (text) domains[key] = text;
  };
  add("love");
  add("work");
  add("money");
  add("health");
  return Object.keys(domains).length ? domains : undefined;
}

function normalizeLevel(raw: unknown): OracleCardLevel {
  return String(raw ?? "").trim().toLowerCase() === "deep" ? "deep" : "public";
}

function normalizeKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
}

function normalizeTradition(raw: unknown): OracleDeckMeta["tradition"] | undefined {
  const s = String(raw ?? "").trim().toLowerCase();
  if (
    s === "rider-waite" ||
    s === "marseille" ||
    s === "thoth" ||
    s === "custom" ||
    s === "zodiac"
  ) {
    return s;
  }
  return undefined;
}

function normalizeCard(raw: unknown): OracleCard | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<OracleCard>;
  const key = normalizeKey(c.key);
  const deckId = normalizeDeckId(c.deckId);
  if (!key || !deckId) return null;
  const name = String(c.name ?? "").trim().slice(0, 60) || key;
  const nameVi = String(c.nameVi ?? "").trim().slice(0, 60) || name;
  const upright = String(c.upright ?? "").trim().slice(0, 800) || "—";
  const reversed = String(c.reversed ?? "").trim().slice(0, 800) || "—";
  const keywords = Array.isArray(c.keywords)
    ? c.keywords
        .map((k) => String(k).trim().slice(0, 24))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const tags = Array.isArray(c.tags)
    ? c.tags
        .map((k) => String(k).trim().slice(0, 32))
        .filter(Boolean)
        .slice(0, 16)
    : undefined;
  const image = String(c.image ?? "").trim().slice(0, 200) || "🃏";
  const number = Math.floor(Number(c.number));
  const sort = Math.floor(Number(c.sort));
  const notes = c.notes != null ? String(c.notes).trim().slice(0, 2000) : undefined;
  const citations =
    c.citations != null ? String(c.citations).trim().slice(0, 500) : undefined;
  const domains = normalizeDomains(c.domains ?? (notes ? parseDomainsFromNotes(notes) : undefined));
  const level = normalizeLevel(c.level);
  const sourceDoc =
    c.sourceDoc != null ? String(c.sourceDoc).trim().slice(0, 80) : undefined;
  return {
    key,
    deckId,
    name,
    nameVi,
    number: Number.isFinite(number) ? number : 0,
    suit: normalizeSuit(c.suit),
    element: c.element ? String(c.element).trim().slice(0, 24) : undefined,
    upright,
    reversed,
    keywords,
    image,
    enabled: c.enabled !== false,
    sort: Number.isFinite(sort) ? sort : 0,
    blurb: c.blurb ? String(c.blurb).trim().slice(0, 120) : undefined,
    tags: tags?.length ? tags : undefined,
    notes: notes || undefined,
    citations: citations || undefined,
    draft: c.draft === true,
    domains,
    level,
    sourceDoc: sourceDoc || undefined,
  };
}

function normalizeDeck(raw: unknown): OracleDeckMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<OracleDeckMeta>;
  const id = normalizeDeckId(d.id);
  if (!id) return null;
  const tradition = normalizeTradition(d.tradition);
  return {
    id,
    nameVi: String(d.nameVi ?? id).trim().slice(0, 60) || id,
    blurb: String(d.blurb ?? "").trim().slice(0, 200),
    enabled: d.enabled !== false,
    sort: Math.floor(Number(d.sort)) || 0,
    tradition: tradition ?? (id === "zodiac" ? "zodiac" : "custom"),
    research: d.research === true,
  };
}

function normalizeSpread(raw: unknown): OracleSpread | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<OracleSpread>;
  const id = normalizeKey(s.id);
  if (!id) return null;
  const positions = Array.isArray(s.positions)
    ? s.positions
        .map((p) => String(p).trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  if (!positions.length) return null;
  const cardCount = Math.floor(Number(s.cardCount));
  return {
    id,
    nameVi: String(s.nameVi ?? id).trim().slice(0, 80) || id,
    blurb: String(s.blurb ?? "").trim().slice(0, 200),
    cardCount: Number.isFinite(cardCount) && cardCount > 0 ? cardCount : positions.length,
    positions,
    enabled: s.enabled !== false,
    sort: Math.floor(Number(s.sort)) || 0,
    tags: Array.isArray(s.tags)
      ? s.tags
          .map((t) => String(t).trim().slice(0, 32))
          .filter(Boolean)
          .slice(0, 16)
      : undefined,
    source: s.source != null ? String(s.source).trim().slice(0, 32) : undefined,
    draft: s.draft === true,
  };
}

function normalizeTimingRule(raw: unknown): TimingHint | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<TimingHint>;
  const id = normalizeKey(r.id);
  if (!id) return null;
  const hint = String(r.hint ?? "").trim().slice(0, 240);
  if (!hint) return null;
  return {
    id,
    labelVi: String(r.labelVi ?? id).trim().slice(0, 80) || id,
    suit: r.suit != null ? String(r.suit).trim().slice(0, 24) || undefined : undefined,
    number: Number.isFinite(Number(r.number)) ? Math.floor(Number(r.number)) : undefined,
    key: r.key != null ? String(r.key).trim().slice(0, 40) || undefined : undefined,
    hint,
    sort: Math.floor(Number(r.sort)) || 0,
  };
}

function normalizeLibraryDoc(raw: unknown): OracleLibraryDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Partial<OracleLibraryDoc>;
  const id = normalizeKey(doc.id);
  if (!id) return null;
  return {
    id,
    title: String(doc.title ?? id).trim().slice(0, 120) || id,
    pages:
      doc.pages != null && Number.isFinite(Number(doc.pages))
        ? Math.max(1, Math.floor(Number(doc.pages)))
        : undefined,
    ingestedAt: Number.isFinite(Number(doc.ingestedAt))
      ? Math.floor(Number(doc.ingestedAt))
      : Date.now(),
    version: String(doc.version ?? "1.0").trim().slice(0, 24) || "1.0",
    notes: doc.notes != null ? String(doc.notes).trim().slice(0, 500) : undefined,
  };
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

function normalizeHistoryRow(raw: unknown): OracleDrawHistoryRow {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<OracleDrawHistoryRow>;
  const cards = Array.isArray(r.cards) ? r.cards : [];
  const spread =
    r.spread != null && String(r.spread).trim()
      ? String(r.spread).trim().slice(0, 48)
      : String(cards.length || "");
  const timingHint =
    r.timingHint != null && String(r.timingHint).trim()
      ? String(r.timingHint).trim().slice(0, 280)
      : undefined;
  return {
    id: String(r.id ?? "").trim() || `od_${Date.now().toString(36)}`,
    at: Math.floor(Number(r.at)) || Date.now(),
    deckId: (normalizeDeckId(r.deckId) ?? "tarot") as OracleDeckId,
    cards,
    spread,
    question: r.question != null ? String(r.question).trim().slice(0, 120) : undefined,
    notes: r.notes != null ? String(r.notes).trim().slice(0, 2000) : undefined,
    title: r.title != null ? String(r.title).trim().slice(0, 120) : undefined,
    mantraClose:
      r.mantraClose != null
        ? String(r.mantraClose).trim().slice(0, 280)
        : undefined,
    timingHint,
  };
}

function ensureSpreadsTimingLibrary(
  spreads: OracleSpread[],
  timingRules: TimingHint[],
  library: OracleLibraryDoc[],
): { spreads: OracleSpread[]; timingRules: TimingHint[]; library: OracleLibraryDoc[]; changed: boolean } {
  let changed = false;
  const spreadMap = new Map(spreads.map((s) => [s.id, s] as const));
  for (const spread of DEFAULT_ORACLE_SPREADS) {
    if (!spreadMap.has(spread.id)) {
      spreadMap.set(spread.id, { ...spread });
      changed = true;
    }
  }
  const timingMap = new Map(timingRules.map((r) => [r.id, r] as const));
  for (const rule of DEFAULT_TIMING_RULES) {
    if (!timingMap.has(rule.id)) {
      timingMap.set(rule.id, { ...rule });
      changed = true;
    }
  }
  const libraryMap = new Map(library.map((d) => [d.id, d] as const));
  for (const doc of DEFAULT_LIBRARY) {
    if (!libraryMap.has(doc.id)) {
      libraryMap.set(doc.id, { ...doc });
      changed = true;
    }
  }
  return {
    spreads: [...spreadMap.values()].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)),
    timingRules: [...timingMap.values()].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)),
    library: [...libraryMap.values()].sort((a, b) => a.ingestedAt - b.ingestedAt || a.id.localeCompare(b.id)),
    changed,
  };
}

class OracleStore {
  private decks: OracleDeckMeta[] = DEFAULT_ORACLE_DECKS.map((d) => ({ ...d }));
  private cards: OracleCard[] = buildDefaultOracleCards().map((c) => ({ ...c }));
  private spreads: OracleSpread[] = DEFAULT_ORACLE_SPREADS.map((s) => ({ ...s }));
  private timingRules: TimingHint[] = DEFAULT_TIMING_RULES.map((r) => ({ ...r }));
  private library: OracleLibraryDoc[] = DEFAULT_LIBRARY.map((d) => ({ ...d }));
  private updatedAt = Date.now();
  private theoryVersion = ORACLE_THEORY_SEED_VERSION;
  /** userId -> recent draws */
  private drawHistory = new Map<string, OracleDrawHistoryRow[]>();

  constructor() {
    this.load();
    this.loadHistory();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        return;
      }
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as Partial<OracleSnapshot>;
      const decks = Array.isArray(raw.decks)
        ? raw.decks.map(normalizeDeck).filter((d): d is OracleDeckMeta => !!d)
        : [];
      const cards = Array.isArray(raw.cards)
        ? raw.cards.map(normalizeCard).filter((c): c is OracleCard => !!c)
        : [];
      const spreads = Array.isArray(raw.spreads)
        ? raw.spreads.map(normalizeSpread).filter((s): s is OracleSpread => !!s)
        : [];
      const timingRules = Array.isArray(raw.timingRules)
        ? raw.timingRules.map(normalizeTimingRule).filter((r): r is TimingHint => !!r)
        : [];
      const library = Array.isArray(raw.library)
        ? raw.library.map(normalizeLibraryDoc).filter((d): d is OracleLibraryDoc => !!d)
        : [];
      if (decks.length) this.decks = decks;
      if (cards.length) this.cards = cards;
      if (!cards.length) {
        // File trống / hỏng → seed lại
        this.cards = buildDefaultOracleCards().map((c) => ({ ...c }));
        this.decks = DEFAULT_ORACLE_DECKS.map((d) => ({ ...d }));
        this.spreads = DEFAULT_ORACLE_SPREADS.map((s) => ({ ...s }));
        this.timingRules = DEFAULT_TIMING_RULES.map((r) => ({ ...r }));
        this.library = DEFAULT_LIBRARY.map((d) => ({ ...d }));
        this.theoryVersion = ORACLE_THEORY_SEED_VERSION;
        this.save();
        return;
      }
      if (spreads.length) this.spreads = spreads;
      if (timingRules.length) this.timingRules = timingRules;
      if (library.length) this.library = library;
      this.theoryVersion = Math.floor(Number(raw.theoryVersion)) || 0;
      let dirty = false;
      if (this.migratePlaceholderTarotImages()) dirty = true;
      if (this.ensureTraditionDecks()) dirty = true;
      const ensured = ensureSpreadsTimingLibrary(this.spreads, this.timingRules, this.library);
      this.spreads = ensured.spreads;
      this.timingRules = ensured.timingRules;
      this.library = ensured.library;
      if (ensured.changed) dirty = true;
      if (this.enrichTheoryFromSeed()) dirty = true;
      if (dirty) this.save();
      this.updatedAt = Math.floor(Number(raw.updatedAt)) || Date.now();
    } catch {
      this.decks = DEFAULT_ORACLE_DECKS.map((d) => ({ ...d }));
      this.cards = buildDefaultOracleCards().map((c) => ({ ...c }));
      this.spreads = DEFAULT_ORACLE_SPREADS.map((s) => ({ ...s }));
      this.timingRules = DEFAULT_TIMING_RULES.map((r) => ({ ...r }));
      this.library = DEFAULT_LIBRARY.map((d) => ({ ...d }));
      this.theoryVersion = ORACLE_THEORY_SEED_VERSION;
      this.save();
    }
  }

  /**
   * Khi seed lí thuyết bump version: cập nhật upright/reversed/keywords/notes/citations
   * từ seed, giữ image / enabled / draft / sort / name do admin chỉnh.
   */
  private enrichTheoryFromSeed(): boolean {
    if (this.theoryVersion >= ORACLE_THEORY_SEED_VERSION) return false;
    const seeded = buildDefaultOracleCards();
    const byId = new Map(
      seeded.map((c) => [`${c.deckId}:${c.key}`, c] as const),
    );
    this.cards = this.cards.map((c) => {
      const s = byId.get(`${c.deckId}:${c.key}`);
      if (!s) return c;
      return {
        ...c,
        upright: s.upright,
        reversed: s.reversed,
        keywords: s.keywords,
        notes: s.notes || c.notes,
        citations: s.citations || c.citations,
        blurb: s.blurb ?? c.blurb,
        element: s.element ?? c.element,
        tags: s.tags?.length ? s.tags : c.tags,
        domains: s.domains ?? c.domains ?? parseDomainsFromNotes(s.notes ?? c.notes),
        level: s.level ?? c.level ?? "public",
        sourceDoc: s.sourceDoc ?? c.sourceDoc,
      };
    });
    // Bổ sung lá seed mới (nếu có)
    const have = new Set(this.cards.map((c) => `${c.deckId}:${c.key}`));
    for (const s of seeded) {
      const id = `${s.deckId}:${s.key}`;
      if (!have.has(id)) this.cards.push({ ...s });
    }
    this.theoryVersion = ORACLE_THEORY_SEED_VERSION;
    return true;
  }

  /** Emoji / 🃏 / default .webp|.svg → JPG từ PDF 78 lá; không đụng URL upload thật. */
  private migratePlaceholderTarotImages(): boolean {
    let changed = false;
    const tarotDecks = new Set(["tarot", "tarot-marseille", "tarot-thoth"]);
    this.cards = this.cards.map((c) => {
      if (!tarotDecks.has(c.deckId)) return c;
      const img = String(c.image ?? "").trim();
      const defaultJpg = `/assets/oracle/tarot/${c.key}.jpg`;
      const isDefaultAsset =
        !img ||
        img === "🃏" ||
        (!img.startsWith("/") &&
          !img.startsWith("http") &&
          !img.startsWith("data:")) ||
        img === `/assets/oracle/tarot/${c.key}.webp` ||
        img === `/assets/oracle/tarot/${c.key}.svg` ||
        img === defaultJpg;
      // Chỉ đổi placeholder / art mặc định; giữ upload custom (/uploads/...)
      if (!isDefaultAsset) return c;
      if (img === defaultJpg) return c;
      changed = true;
      return { ...c, image: defaultJpg };
    });
    return changed;
  }

  /** Bổ sung Marseille/Thoth nếu store cũ chưa có. */
  private ensureTraditionDecks(): boolean {
    let changed = false;
    const have = new Set(this.decks.map((d) => d.id));
    for (const d of DEFAULT_ORACLE_DECKS) {
      if (have.has(d.id)) {
        const idx = this.decks.findIndex((x) => x.id === d.id);
        if (idx >= 0 && !this.decks[idx]!.tradition) {
          this.decks[idx] = {
            ...this.decks[idx]!,
            tradition: d.tradition,
            research: d.research ?? this.decks[idx]!.research,
            nameVi: this.decks[idx]!.nameVi || d.nameVi,
          };
          changed = true;
        }
        continue;
      }
      this.decks.push({ ...d });
      const seeded = buildDefaultOracleCards().filter((c) => c.deckId === d.id);
      this.cards.push(...seeded.map((c) => ({ ...c })));
      changed = true;
    }
    return changed;
  }

  private ensureSpreadsTimingLibrary(): boolean {
    const ensured = ensureSpreadsTimingLibrary(this.spreads, this.timingRules, this.library);
    const changed =
      ensured.changed ||
      ensured.spreads.length !== this.spreads.length ||
      ensured.timingRules.length !== this.timingRules.length ||
      ensured.library.length !== this.library.length;
    this.spreads = ensured.spreads;
    this.timingRules = ensured.timingRules;
    this.library = ensured.library;
    return changed;
  }

  private save() {
    this.updatedAt = Date.now();
    atomicWrite(PATH, this.snapshot());
  }

  private loadHistory() {
    try {
      if (!existsSync(HISTORY_PATH)) return;
      const raw = JSON.parse(readFileSync(HISTORY_PATH, "utf8")) as {
        byUser?: Record<string, OracleDrawHistoryRow[]>;
      };
      if (!raw?.byUser || typeof raw.byUser !== "object") return;
      for (const [uid, rows] of Object.entries(raw.byUser)) {
        if (!Array.isArray(rows)) continue;
        this.drawHistory.set(
          uid,
          rows
            .filter((r) => r && typeof r === "object" && r.id)
            .slice(0, 30)
            .map((r) => normalizeHistoryRow(r)),
        );
      }
    } catch {
      /* ignore */
    }
  }

  private saveHistory() {
    const byUser: Record<string, OracleDrawHistoryRow[]> = {};
    for (const [uid, rows] of this.drawHistory) {
      byUser[uid] = rows.slice(0, 20);
    }
    atomicWrite(HISTORY_PATH, { version: 1, byUser });
  }

  recordDrawHistory(userId: string, row: OracleDrawHistoryRow): void {
    const uid = String(userId ?? "").trim();
    if (!uid) return;
    const prev = this.drawHistory.get(uid) ?? [];
    prev.unshift(normalizeHistoryRow(row));
    this.drawHistory.set(uid, prev.slice(0, 30));
    this.saveHistory();
  }

  updateDrawHistory(
    userId: string,
    id: string,
    patch: { notes?: string; title?: string },
  ): OracleDrawHistoryRow | null {
    const uid = String(userId ?? "").trim();
    const drawId = String(id ?? "").trim();
    if (!uid || !drawId) return null;
    const rows = this.drawHistory.get(uid) ?? [];
    const idx = rows.findIndex((r) => r.id === drawId);
    if (idx < 0) return null;
    const cur = rows[idx]!;
    if (patch.notes !== undefined) {
      cur.notes = String(patch.notes).trim().slice(0, 2000);
    }
    if (patch.title !== undefined) {
      cur.title = String(patch.title).trim().slice(0, 120) || undefined;
    }
    rows[idx] = cur;
    this.drawHistory.set(uid, rows);
    this.saveHistory();
    return { ...cur, cards: cur.cards.map((c) => ({ ...c })) };
  }

  listDrawHistory(userId: string, limit = 10): OracleDrawHistoryRow[] {
    const uid = String(userId ?? "").trim();
    const rows = this.drawHistory.get(uid) ?? [];
    return rows.slice(0, Math.min(30, Math.max(1, limit))).map((r) => ({
      ...r,
      cards: r.cards.map((c) => ({ ...c })),
    }));
  }

  snapshot(): OracleSnapshot {
    return {
      version: 1,
      decks: this.decks.map((d) => ({ ...d })),
      cards: this.cards.map((c) => ({ ...c })),
      spreads: this.spreads.map((s) => ({ ...s })),
      timingRules: this.timingRules.map((r) => ({ ...r })),
      library: this.library.map((d) => ({ ...d })),
      updatedAt: this.updatedAt,
      theoryVersion: this.theoryVersion,
    };
  }

  /** Public: deck/card bật; ẩn draft trừ lab. */
  publicCatalog(opts?: { lab?: boolean }) {
    const lab = !!opts?.lab;
    const decks = this.decks
      .filter((d) => d.enabled)
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    const enabledDeck = new Set(decks.map((d) => d.id));
    const cards = this.cards
      .filter(
        (c) =>
          c.enabled &&
          enabledDeck.has(c.deckId) &&
          (lab || !c.draft),
      )
      .slice()
      .sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
    const publicCards = lab
      ? cards
      : cards.map(({ notes, citations, tags, draft, domains, level, sourceDoc, ...rest }) => rest);
    const spreads = this.spreads
      .filter((s) => s.enabled && (lab || !s.draft))
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    return {
      decks,
      cards: publicCards,
      spreads,
      timingRules: this.listTimingRules(),
      updatedAt: this.updatedAt,
      lab,
    };
  }

  adminCatalog() {
    return {
      decks: this.decks
        .slice()
        .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)),
      cards: this.cards
        .slice()
        .sort(
          (a, b) =>
            a.deckId.localeCompare(b.deckId) ||
            a.sort - b.sort ||
            a.key.localeCompare(b.key),
        ),
      spreads: this.listSpreads(false),
      timingRules: this.listTimingRules(),
      library: this.listLibrary(),
      updatedAt: this.updatedAt,
      counts: {
        tarot: this.cards.filter((c) => c.deckId === "tarot").length,
        zodiac: this.cards.filter((c) => c.deckId === "zodiac").length,
        lenormand: this.cards.filter((c) => c.deckId === "lenormand").length,
        tea: this.cards.filter((c) => c.deckId === "tea").length,
        enabled: this.cards.filter((c) => c.enabled).length,
        draft: this.cards.filter((c) => c.draft).length,
        total: this.cards.length,
        byDeck: Object.fromEntries(
          this.decks.map((d) => [
            d.id,
            this.cards.filter((c) => c.deckId === d.id).length,
          ]),
        ),
      },
    };
  }

  listSpreads(publicOnly = false): OracleSpread[] {
    return this.spreads
      .filter((s) => !publicOnly || (s.enabled && !s.draft))
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
      .map((s) => ({ ...s }));
  }

  upsertSpread(
    patch: unknown,
  ): { ok: true; spread: OracleSpread } | { ok: false; reason: string } {
    const next = normalizeSpread(patch);
    if (!next) return { ok: false, reason: "Spread không hợp lệ" };
    const idx = this.spreads.findIndex((s) => s.id === next.id);
    if (idx >= 0) this.spreads[idx] = { ...this.spreads[idx]!, ...next };
    else this.spreads.push(next);
    this.save();
    return { ok: true, spread: { ...next } };
  }

  setSpreadEnabled(idRaw: unknown, enabled: boolean): { ok: true; spread: OracleSpread } | { ok: false; reason: string } {
    const id = normalizeKey(idRaw);
    const spread = this.spreads.find((s) => s.id === id);
    if (!spread) return { ok: false, reason: "Không tìm thấy spread" };
    spread.enabled = !!enabled;
    this.save();
    return { ok: true, spread: { ...spread } };
  }

  listTimingRules(): TimingHint[] {
    return this.timingRules
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
      .map((r) => ({ ...r }));
  }

  setTimingRules(rules: TimingHint[]): { ok: true; count: number } {
    this.timingRules = rules.map(normalizeTimingRule).filter((r): r is TimingHint => !!r);
    this.save();
    return { ok: true, count: this.timingRules.length };
  }

  listLibrary(): OracleLibraryDoc[] {
    return this.library
      .slice()
      .sort((a, b) => a.ingestedAt - b.ingestedAt || a.id.localeCompare(b.id))
      .map((d) => ({ ...d }));
  }

  upsertLibraryDoc(
    doc: unknown,
  ): { ok: true; doc: OracleLibraryDoc } | { ok: false; reason: string } {
    const next = normalizeLibraryDoc(doc);
    if (!next) return { ok: false, reason: "Library doc không hợp lệ" };
    const idx = this.library.findIndex((d) => d.id === next.id);
    if (idx >= 0) this.library[idx] = { ...this.library[idx]!, ...next };
    else this.library.push(next);
    this.save();
    return { ok: true, doc: { ...next } };
  }

  upsertDeck(
    patch: unknown,
  ): { ok: true; deck: OracleDeckMeta } | { ok: false; reason: string } {
    const next = normalizeDeck(patch);
    if (!next) return { ok: false, reason: "Deck không hợp lệ" };
    const idx = this.decks.findIndex((d) => d.id === next.id);
    if (idx >= 0) this.decks[idx] = { ...this.decks[idx]!, ...next };
    else this.decks.push(next);
    this.save();
    return { ok: true, deck: { ...next } };
  }

  upsertCard(
    patch: unknown,
  ): { ok: true; card: OracleCard } | { ok: false; reason: string } {
    const next = normalizeCard(patch);
    if (!next) return { ok: false, reason: "Lá bài không hợp lệ" };
    const idx = this.cards.findIndex(
      (c) => c.key === next.key && c.deckId === next.deckId,
    );
    if (idx >= 0) {
      this.cards[idx] = { ...this.cards[idx]!, ...next, key: next.key };
    } else {
      this.cards.push(next);
    }
    this.save();
    const card = this.cards.find(
      (c) => c.key === next.key && c.deckId === next.deckId,
    )!;
    return { ok: true, card: { ...card } };
  }

  /** Batch import / cập nhật nhiều lá (CSV-JSON array). */
  batchUpsertCards(
    rows: unknown,
  ):
    | { ok: true; upserted: number; failed: number; errors: string[] }
    | { ok: false; reason: string } {
    if (!Array.isArray(rows)) {
      return { ok: false, reason: "Body phải là mảng lá bài" };
    }
    let upserted = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const row of rows.slice(0, 500)) {
      const next = normalizeCard(row);
      if (!next) {
        failed += 1;
        errors.push("invalid row");
        continue;
      }
      const idx = this.cards.findIndex(
        (c) => c.key === next.key && c.deckId === next.deckId,
      );
      if (idx >= 0) this.cards[idx] = { ...this.cards[idx]!, ...next };
      else this.cards.push(next);
      upserted += 1;
    }
    if (upserted > 0) this.save();
    return { ok: true, upserted, failed, errors: errors.slice(0, 20) };
  }

  setCardEnabled(
    keyRaw: unknown,
    enabled: boolean,
    deckIdRaw?: unknown,
  ): { ok: true; card: OracleCard } | { ok: false; reason: string } {
    const key = normalizeKey(keyRaw);
    const deckId = normalizeDeckId(deckIdRaw);
    const card = this.cards.find(
      (c) => c.key === key && (!deckId || c.deckId === deckId),
    );
    if (!card) return { ok: false, reason: "Không tìm thấy lá" };
    card.enabled = !!enabled;
    this.save();
    return { ok: true, card: { ...card } };
  }

  /** Clone 78 keys từ template deck sang deck đích (không ghi đè lá đã có). */
  cloneDeckTemplate(
    fromIdRaw: unknown,
    toIdRaw: unknown,
  ):
    | { ok: true; added: number; deckId: string }
    | { ok: false; reason: string } {
    const fromId = normalizeDeckId(fromIdRaw) ?? "tarot";
    const toId = normalizeDeckId(toIdRaw);
    if (!toId) return { ok: false, reason: "Deck đích không hợp lệ" };
    if (!this.decks.some((d) => d.id === toId)) {
      return { ok: false, reason: "Tạo deck đích trước khi clone" };
    }
    const src = this.cards.filter((c) => c.deckId === fromId);
    if (!src.length) return { ok: false, reason: "Deck nguồn trống" };
    let added = 0;
    for (const c of src) {
      const exists = this.cards.some(
        (x) => x.deckId === toId && x.key === c.key,
      );
      if (exists) continue;
      this.cards.push({
        ...c,
        deckId: toId,
        tags: [...(c.tags ?? []), "cloned"].slice(0, 16),
        draft: false,
      });
      added += 1;
    }
    if (added) this.save();
    return { ok: true, added, deckId: toId };
  }

  /** Gán tag hàng loạt theo bộ hoặc key list. */
  batchTag(
    tagsRaw: unknown,
    opts: { deckId?: unknown; keys?: unknown; mode?: "add" | "set" },
  ): { ok: true; updated: number } | { ok: false; reason: string } {
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw
          .map((t) => String(t).trim().slice(0, 32))
          .filter(Boolean)
          .slice(0, 16)
      : String(tagsRaw ?? "")
          .split(/[,;]+/)
          .map((t) => t.trim().slice(0, 32))
          .filter(Boolean)
          .slice(0, 16);
    if (!tags.length) return { ok: false, reason: "Thiếu tags" };
    const deckId = normalizeDeckId(opts.deckId);
    const keys = Array.isArray(opts.keys)
      ? new Set(opts.keys.map((k) => normalizeKey(k)).filter(Boolean))
      : null;
    const mode = opts.mode === "set" ? "set" : "add";
    let updated = 0;
    this.cards = this.cards.map((c) => {
      if (deckId && c.deckId !== deckId) return c;
      if (keys && !keys.has(c.key)) return c;
      const nextTags =
        mode === "set"
          ? tags
          : [...new Set([...(c.tags ?? []), ...tags])].slice(0, 16);
      updated += 1;
      return { ...c, tags: nextTags };
    });
    if (updated) this.save();
    return { ok: true, updated };
  }

  resetToSeed(): { ok: true; count: number } {
    this.decks = DEFAULT_ORACLE_DECKS.map((d) => ({ ...d }));
    this.cards = buildDefaultOracleCards().map((c) => ({ ...c }));
    this.spreads = DEFAULT_ORACLE_SPREADS.map((s) => ({ ...s }));
    this.timingRules = DEFAULT_TIMING_RULES.map((r) => ({ ...r }));
    this.library = DEFAULT_LIBRARY.map((d) => ({ ...d }));
    this.theoryVersion = ORACLE_THEORY_SEED_VERSION;
    this.save();
    return { ok: true, count: this.cards.length };
  }

  draw(
    deckIdRaw: unknown,
    countRaw: unknown,
  ):
    | { ok: true; deckId: OracleDeckId; cards: DrawnOracleCard[] }
    | { ok: false; reason: string } {
    const deckId = normalizeDeckId(deckIdRaw) ?? "tarot";
    const deck = this.decks.find((d) => d.id === deckId);
    if (!deck || !deck.enabled) {
      return { ok: false, reason: "Bộ bài đang tắt" };
    }
    let count = Math.floor(Number(countRaw));
    if (!Number.isFinite(count) || count < 1) count = 1;
    if (count > 10) count = 10;
    const pool = this.cards.filter(
      (c) => c.enabled && !c.draft && c.deckId === deckId,
    );
    if (pool.length < count) {
      return { ok: false, reason: "Không đủ lá trong bộ" };
    }
    const shuffled = shuffleInPlace([...pool]);
    const picked = shuffled.slice(0, count);
    const spreadPositions =
      count === 3
        ? (["Quá khứ", "Hiện tại", "Tương lai"] as const)
        : count === 5
          ? ([
              "Bạn",
              "Đối phương",
              "Quan hệ",
              "Thách thức",
              "Lời khuyên",
            ] as const)
          : count === 10
            ? ([
                "Hiện tại",
                "Thách thức",
                "Quá khứ gần",
                "Tương lai gần",
                "Mục tiêu",
                "Gần đây",
                "Bản thân",
                "Môi trường",
                "Hy vọng/sợ",
                "Kết quả",
              ] as const)
            : null;
    const cards: DrawnOracleCard[] = picked.map((c, i) => {
      const reversedDraw = (randomBytes(1)[0]! & 1) === 1;
      return {
        key: c.key,
        deckId: c.deckId,
        name: c.name,
        nameVi: c.nameVi,
        number: c.number,
        suit: c.suit,
        element: c.element,
        upright: c.upright,
        reversed: c.reversed,
        keywords: [...c.keywords],
        image: c.image,
        blurb: c.blurb,
        reversedDraw,
        meaning: reversedDraw ? c.reversed : c.upright,
        position:
          spreadPositions?.[i] ??
          (count === 1 ? "Lá rút" : `Vị trí ${i + 1}`),
      };
    });
    pickTimingHint(
      cards.map((c) => ({ key: c.key, suit: c.suit, number: c.number })),
      this.timingRules,
    );
    return { ok: true, deckId, cards };
  }
}

export const oracleStore = new OracleStore();
