import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import {
  buildDefaultOracleCards,
  DEFAULT_ORACLE_DECKS,
  type OracleCardSeed,
  type OracleDeckId,
  type OracleDeckMeta,
} from "./oracleSeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "oracle-decks.json");
const TMP = join(DATA_DIR, "oracle-decks.json.tmp");
const HISTORY_PATH = join(DATA_DIR, "oracle-draws.json");
const HISTORY_TMP = join(DATA_DIR, "oracle-draws.json.tmp");

export type { OracleDeckId, OracleDeckMeta };

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
}

export interface OracleDrawHistoryRow {
  id: string;
  at: number;
  deckId: OracleDeckId;
  cards: DrawnOracleCard[];
}

export interface OracleSnapshot {
  version: 1;
  decks: OracleDeckMeta[];
  cards: OracleCard[];
  updatedAt: number;
}

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, path);
}

function normalizeDeckId(raw: unknown): OracleDeckId | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "tarot" || s === "zodiac") return s;
  return null;
}

function normalizeKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
}

function normalizeCard(raw: unknown): OracleCard | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<OracleCard>;
  const key = normalizeKey(c.key);
  const deckId = normalizeDeckId(c.deckId);
  if (!key || !deckId) return null;
  const name = String(c.name ?? "").trim().slice(0, 60) || key;
  const nameVi = String(c.nameVi ?? "").trim().slice(0, 60) || name;
  const upright = String(c.upright ?? "").trim().slice(0, 500) || "—";
  const reversed = String(c.reversed ?? "").trim().slice(0, 500) || "—";
  const keywords = Array.isArray(c.keywords)
    ? c.keywords
        .map((k) => String(k).trim().slice(0, 24))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const image = String(c.image ?? "").trim().slice(0, 200) || "🃏";
  const number = Math.floor(Number(c.number));
  const sort = Math.floor(Number(c.sort));
  const suitRaw = String(c.suit ?? "").trim().toLowerCase();
  const suitOk = [
    "major",
    "wands",
    "cups",
    "swords",
    "pentacles",
    "zodiac",
  ].includes(suitRaw)
    ? (suitRaw as OracleCard["suit"])
    : undefined;
  return {
    key,
    deckId,
    name,
    nameVi,
    number: Number.isFinite(number) ? number : 0,
    suit: suitOk,
    element: c.element ? String(c.element).trim().slice(0, 24) : undefined,
    upright,
    reversed,
    keywords,
    image,
    enabled: c.enabled !== false,
    sort: Number.isFinite(sort) ? sort : 0,
    blurb: c.blurb ? String(c.blurb).trim().slice(0, 120) : undefined,
  };
}

function normalizeDeck(raw: unknown): OracleDeckMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<OracleDeckMeta>;
  const id = normalizeDeckId(d.id);
  if (!id) return null;
  return {
    id,
    nameVi: String(d.nameVi ?? id).trim().slice(0, 60) || id,
    blurb: String(d.blurb ?? "").trim().slice(0, 200),
    enabled: d.enabled !== false,
    sort: Math.floor(Number(d.sort)) || 0,
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

class OracleStore {
  private decks: OracleDeckMeta[] = DEFAULT_ORACLE_DECKS.map((d) => ({ ...d }));
  private cards: OracleCard[] = buildDefaultOracleCards().map((c) => ({ ...c }));
  private updatedAt = Date.now();
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
      if (decks.length) this.decks = decks;
      if (cards.length) this.cards = cards;
      else {
        // File trống / hỏng → seed lại
        this.cards = buildDefaultOracleCards().map((c) => ({ ...c }));
        this.decks = DEFAULT_ORACLE_DECKS.map((d) => ({ ...d }));
        this.save();
      }
      this.updatedAt = Math.floor(Number(raw.updatedAt)) || Date.now();
    } catch {
      this.decks = DEFAULT_ORACLE_DECKS.map((d) => ({ ...d }));
      this.cards = buildDefaultOracleCards().map((c) => ({ ...c }));
      this.save();
    }
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
            .map((r) => ({
              id: String(r.id),
              at: Math.floor(Number(r.at)) || Date.now(),
              deckId: (normalizeDeckId(r.deckId) ?? "tarot") as OracleDeckId,
              cards: Array.isArray(r.cards) ? r.cards : [],
            })),
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
    prev.unshift(row);
    this.drawHistory.set(uid, prev.slice(0, 30));
    this.saveHistory();
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
      updatedAt: this.updatedAt,
    };
  }

  /** Public: chỉ deck/card đang bật. */
  publicCatalog() {
    const decks = this.decks
      .filter((d) => d.enabled)
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    const enabledDeck = new Set(decks.map((d) => d.id));
    const cards = this.cards
      .filter((c) => c.enabled && enabledDeck.has(c.deckId))
      .slice()
      .sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
    return { decks, cards, updatedAt: this.updatedAt };
  }

  adminCatalog() {
    return {
      decks: this.decks
        .slice()
        .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)),
      cards: this.cards
        .slice()
        .sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key)),
      updatedAt: this.updatedAt,
      counts: {
        tarot: this.cards.filter((c) => c.deckId === "tarot").length,
        zodiac: this.cards.filter((c) => c.deckId === "zodiac").length,
        enabled: this.cards.filter((c) => c.enabled).length,
      },
    };
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
    const idx = this.cards.findIndex((c) => c.key === next.key);
    if (idx >= 0) {
      this.cards[idx] = { ...this.cards[idx]!, ...next, key: next.key };
    } else {
      this.cards.push(next);
    }
    this.save();
    const card = this.cards.find((c) => c.key === next.key)!;
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
      const idx = this.cards.findIndex((c) => c.key === next.key);
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
  ): { ok: true; card: OracleCard } | { ok: false; reason: string } {
    const key = normalizeKey(keyRaw);
    const card = this.cards.find((c) => c.key === key);
    if (!card) return { ok: false, reason: "Không tìm thấy lá" };
    card.enabled = !!enabled;
    this.save();
    return { ok: true, card: { ...card } };
  }

  resetToSeed(): { ok: true; count: number } {
    this.decks = DEFAULT_ORACLE_DECKS.map((d) => ({ ...d }));
    this.cards = buildDefaultOracleCards().map((c) => ({ ...c }));
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
    const pool = this.cards.filter((c) => c.enabled && c.deckId === deckId);
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
    return { ok: true, deckId, cards };
  }
}

export const oracleStore = new OracleStore();
