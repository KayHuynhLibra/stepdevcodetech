/**
 * Cấu hình bàn Tarot: thời gian đếm ngược + kiểu xoay lá khi reveal + số lá đặt tối đa.
 * Persist `server/data/table-config.json` (volume).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  MAX_CARDS_PER_ROUND,
  MAX_CARDS_PER_ROUND_MAX,
  MAX_CARDS_PER_ROUND_MIN,
  PHASE_MS,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "table-config.json");
const TMP = join(DATA_DIR, "table-config.json.tmp");

export type RevealStyleId = "classic" | "fan" | "spiral";

export const REVEAL_STYLE_IDS: RevealStyleId[] = ["classic", "fan", "spiral"];

export const REVEAL_STYLE_LABELS: Record<RevealStyleId, string> = {
  classic: "Cổ điển — gom + xáo + lật",
  fan: "Quạt bài — trải quạt rồi rút",
  spiral: "Xoáy ốc — spiral rồi hiện lá",
};

const PLACING_MIN = 15_000;
const PLACING_MAX = 90_000;
const REVEALING_MIN = 4_000;
const REVEALING_MAX = 15_000;
const PAYOUT_MIN = 3_000;
const PAYOUT_MAX = 12_000;

export interface TableConfigSnapshot {
  placingMs: number;
  revealingMs: number;
  payoutMs: number;
  revealStyle: RevealStyleId;
  maxCardsPerRound: number;
  updatedAt: number;
  updatedBy?: string;
}

interface TableConfigFile {
  version: 1;
  placingMs: number;
  revealingMs: number;
  payoutMs: number;
  revealStyle: RevealStyleId;
  maxCardsPerRound?: number;
  updatedAt: number;
  updatedBy?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function normalizeRevealStyle(raw: unknown): RevealStyleId {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return REVEAL_STYLE_IDS.includes(s as RevealStyleId)
    ? (s as RevealStyleId)
    : "classic";
}

export function normalizeMaxCardsPerRound(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return MAX_CARDS_PER_ROUND;
  return clamp(n, MAX_CARDS_PER_ROUND_MIN, MAX_CARDS_PER_ROUND_MAX);
}

class TableConfigStore {
  private placingMs: number = PHASE_MS.placing;
  private revealingMs: number = PHASE_MS.revealing;
  private payoutMs: number = PHASE_MS.payout;
  private revealStyle: RevealStyleId = "classic";
  private maxCardsPerRound: number = MAX_CARDS_PER_ROUND;
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as TableConfigFile;
      if (parsed?.version !== 1) return;
      this.placingMs = clamp(
        Number(parsed.placingMs) || PHASE_MS.placing,
        PLACING_MIN,
        PLACING_MAX,
      );
      this.revealingMs = clamp(
        Number(parsed.revealingMs) || PHASE_MS.revealing,
        REVEALING_MIN,
        REVEALING_MAX,
      );
      this.payoutMs = clamp(
        Number(parsed.payoutMs) || PHASE_MS.payout,
        PAYOUT_MIN,
        PAYOUT_MAX,
      );
      this.revealStyle = normalizeRevealStyle(parsed.revealStyle);
      this.maxCardsPerRound =
        parsed.maxCardsPerRound !== undefined && parsed.maxCardsPerRound !== null
          ? normalizeMaxCardsPerRound(parsed.maxCardsPerRound)
          : MAX_CARDS_PER_ROUND;
      this.updatedAt = Number(parsed.updatedAt) || 0;
      this.updatedBy = String(parsed.updatedBy ?? "");
    } catch (err) {
      console.warn("[table-config] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: TableConfigFile = {
      version: 1,
      placingMs: this.placingMs,
      revealingMs: this.revealingMs,
      payoutMs: this.payoutMs,
      revealStyle: this.revealStyle,
      maxCardsPerRound: this.maxCardsPerRound,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  getSnapshot(): TableConfigSnapshot {
    return {
      placingMs: this.placingMs,
      revealingMs: this.revealingMs,
      payoutMs: this.payoutMs,
      revealStyle: this.revealStyle,
      maxCardsPerRound: this.maxCardsPerRound,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy || undefined,
    };
  }

  /** Public — gửi kèm room state / client. */
  getPublic(): {
    placingMs: number;
    revealingMs: number;
    payoutMs: number;
    revealStyle: RevealStyleId;
    maxCardsPerRound: number;
  } {
    return {
      placingMs: this.placingMs,
      revealingMs: this.revealingMs,
      payoutMs: this.payoutMs,
      revealStyle: this.revealStyle,
      maxCardsPerRound: this.maxCardsPerRound,
    };
  }

  phaseMs(phase: "placing" | "revealing" | "payout"): number {
    if (phase === "placing") return this.placingMs;
    if (phase === "revealing") return this.revealingMs;
    return this.payoutMs;
  }

  cardsPerRoundLimit(): number {
    return this.maxCardsPerRound;
  }

  update(
    patch: {
      placingMs?: unknown;
      revealingMs?: unknown;
      payoutMs?: unknown;
      revealStyle?: unknown;
      maxCardsPerRound?: unknown;
    },
    byUsername: string,
  ): { ok: true; config: TableConfigSnapshot } | { ok: false; reason: string } {
    if (patch.placingMs !== undefined && patch.placingMs !== null && patch.placingMs !== "") {
      const n = Number(patch.placingMs);
      if (!Number.isFinite(n)) {
        return { ok: false, reason: "placingMs không hợp lệ" };
      }
      this.placingMs = clamp(n, PLACING_MIN, PLACING_MAX);
    }
    if (
      patch.revealingMs !== undefined &&
      patch.revealingMs !== null &&
      patch.revealingMs !== ""
    ) {
      const n = Number(patch.revealingMs);
      if (!Number.isFinite(n)) {
        return { ok: false, reason: "revealingMs không hợp lệ" };
      }
      this.revealingMs = clamp(n, REVEALING_MIN, REVEALING_MAX);
    }
    if (patch.payoutMs !== undefined && patch.payoutMs !== null && patch.payoutMs !== "") {
      const n = Number(patch.payoutMs);
      if (!Number.isFinite(n)) {
        return { ok: false, reason: "payoutMs không hợp lệ" };
      }
      this.payoutMs = clamp(n, PAYOUT_MIN, PAYOUT_MAX);
    }
    if (patch.revealStyle !== undefined && patch.revealStyle !== null) {
      this.revealStyle = normalizeRevealStyle(patch.revealStyle);
    }
    if (
      patch.maxCardsPerRound !== undefined &&
      patch.maxCardsPerRound !== null &&
      patch.maxCardsPerRound !== ""
    ) {
      const n = Number(patch.maxCardsPerRound);
      if (!Number.isFinite(n)) {
        return { ok: false, reason: "maxCardsPerRound không hợp lệ" };
      }
      this.maxCardsPerRound = normalizeMaxCardsPerRound(n);
    }
    this.updatedAt = Date.now();
    this.updatedBy = String(byUsername ?? "").trim().slice(0, 40);
    this.save();
    return { ok: true, config: this.getSnapshot() };
  }
}

export const tableConfigStore = new TableConfigStore();

export const TABLE_CONFIG_LIMITS = {
  placingMs: { min: PLACING_MIN, max: PLACING_MAX },
  revealingMs: { min: REVEALING_MIN, max: REVEALING_MAX },
  payoutMs: { min: PAYOUT_MIN, max: PAYOUT_MAX },
  maxCardsPerRound: {
    min: MAX_CARDS_PER_ROUND_MIN,
    max: MAX_CARDS_PER_ROUND_MAX,
  },
} as const;
