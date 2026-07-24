/**
 * Fee Pocket — lớp trung chuyển phí độc lập với vault / game features.
 *
 * Invariant (giữ khi mở rộng app):
 * 1. Mọi xu phí đốt từ user → `collectFee` / `refundFee` (KHÔNG ghi vault trực tiếp).
 * 2. Chỉ `releaseToVault` mới đưa xu vào Kho Tarot (`pocket_fee`).
 * 3. Source là slug string mở (đăng ký label trong FEE_SOURCE_LABELS; source lạ vẫn lưu được).
 * 4. Schema có version + migrate; thêm field mới không phá file cũ.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { vaultStore } from "./vaultStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "fee-pocket.json");
const TMP = join(DATA_DIR, "fee-pocket.json.tmp");

/** Schema file hiện tại — tăng khi migrate. */
export const FEE_POCKET_SCHEMA = 2;

/** Nguồn phí đã biết (khuyến nghị). Source khác vẫn hợp lệ qua normalizeSource. */
export const FEE_SOURCE_IDS = [
  "ring",
  "chat",
  "cultivation",
  "lixi",
] as const;

export type FeePocketKnownSource = (typeof FEE_SOURCE_IDS)[number];

/** Source slug ổn định — known hoặc custom (vd. gift_fee, gem_fee sau này). */
export type FeePocketSource = string;

export type FeePocketLedgerType = "in" | "refund" | "to_vault";

export const FEE_SOURCE_LABELS: Record<string, string> = {
  ring: "Nhẫn / cầu hôn",
  chat: "Phí chat",
  cultivation: "Phí Tu Tiên",
  lixi: "% lì xì Room",
  mixed: "Hỗn hợp",
  unknown: "Khác",
};

export function feeSourceLabel(source: string): string {
  const s = String(source ?? "").trim() || "unknown";
  return FEE_SOURCE_LABELS[s] ?? s;
}

/**
 * Chuẩn hóa source thành slug an toàn cho JSON key.
 * Giữ tương thích ring/chat/cultivation/lixi; source mới: chữ thường, [a-z0-9_], max 32.
 */
export function normalizeFeeSource(raw: unknown): FeePocketSource {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return s || "unknown";
}

export interface FeePocketLedgerEntry {
  id: string;
  at: number;
  type: FeePocketLedgerType;
  source: FeePocketSource;
  amount: number;
  balanceAfter: number;
  note: string;
  byUsername: string;
  userId?: string;
  username?: string;
  /** Tham chiếu nghiệp vụ (bondId, roomId, …) */
  ref?: string;
  /** Meta mở rộng — không phá schema khi thêm field */
  meta?: Record<string, string | number | boolean | null>;
}

interface FeePocketFile {
  version: number;
  balance: number;
  totalIn: number;
  totalRefunded: number;
  totalToVault: number;
  /** Dynamic map — không khóa cứng 4 nguồn */
  bySource: Record<string, number>;
  ledger: FeePocketLedgerEntry[];
}

const LEDGER_CAP = 800;

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeBySource(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const source = normalizeFeeSource(k);
    const n = clampNonNeg(Number(v) || 0);
    if (n > 0) out[source] = (out[source] ?? 0) + n;
  }
  return out;
}

function normalizeLedgerEntry(raw: unknown): FeePocketLedgerEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Partial<FeePocketLedgerEntry>;
  const type = e.type;
  if (type !== "in" && type !== "refund" && type !== "to_vault") return null;
  const amount = clampNonNeg(Number(e.amount) || 0);
  if (amount <= 0) return null;
  const entry: FeePocketLedgerEntry = {
    id: String(e.id ?? randomBytes(6).toString("hex")),
    at: Math.floor(Number(e.at)) || Date.now(),
    type,
    source: normalizeFeeSource(e.source ?? "unknown"),
    amount,
    balanceAfter: clampNonNeg(Number(e.balanceAfter) || 0),
    note: String(e.note ?? "").slice(0, 160),
    byUsername: String(e.byUsername ?? "system").slice(0, 40),
  };
  if (e.userId) entry.userId = String(e.userId).slice(0, 40);
  if (e.username) entry.username = String(e.username).slice(0, 40);
  if (e.ref) entry.ref = String(e.ref).slice(0, 64);
  if (e.meta && typeof e.meta === "object") {
    entry.meta = e.meta as FeePocketLedgerEntry["meta"];
  }
  return entry;
}

export interface FeeCollectOpts {
  source: FeePocketSource | FeePocketKnownSource;
  amount: number;
  userId?: string;
  username?: string;
  note?: string;
  ref?: string;
  byUsername?: string;
  meta?: FeePocketLedgerEntry["meta"];
}

class FeePocketStore {
  private balance = 0;
  private totalIn = 0;
  private totalRefunded = 0;
  private totalToVault = 0;
  private bySource: Record<string, number> = {};
  private ledger: FeePocketLedgerEntry[] = [];
  private schemaVersion = FEE_POCKET_SCHEMA;

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        console.log("[fee-pocket] Created fee-pocket.json");
        return;
      }
      const parsed = JSON.parse(
        readFileSync(PATH, "utf8"),
      ) as Partial<FeePocketFile>;
      const fileVer = Math.floor(Number(parsed.version) || 1);
      this.balance = clampNonNeg(Number(parsed.balance) || 0);
      this.totalIn = clampNonNeg(Number(parsed.totalIn) || 0);
      this.totalRefunded = clampNonNeg(Number(parsed.totalRefunded) || 0);
      this.totalToVault = clampNonNeg(Number(parsed.totalToVault) || 0);
      this.bySource = normalizeBySource(parsed.bySource);
      this.ledger = Array.isArray(parsed.ledger)
        ? parsed.ledger
            .map(normalizeLedgerEntry)
            .filter((x): x is FeePocketLedgerEntry => !!x)
            .slice(0, LEDGER_CAP)
        : [];
      this.schemaVersion = FEE_POCKET_SCHEMA;
      if (fileVer < FEE_POCKET_SCHEMA) {
        this.save();
        console.log(
          `[fee-pocket] Migrated schema v${fileVer} → v${FEE_POCKET_SCHEMA}`,
        );
      }
      console.log(
        `[fee-pocket] Loaded · balance ${this.balance.toLocaleString("vi-VN")} · sources ${Object.keys(this.bySource).length}`,
      );
    } catch (err) {
      console.warn("[fee-pocket] load failed:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const body: FeePocketFile = {
        version: this.schemaVersion,
        balance: this.balance,
        totalIn: this.totalIn,
        totalRefunded: this.totalRefunded,
        totalToVault: this.totalToVault,
        bySource: { ...this.bySource },
        ledger: this.ledger.slice(0, LEDGER_CAP),
      };
      writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[fee-pocket] save failed:", err);
    }
  }

  private push(
    entry: Omit<FeePocketLedgerEntry, "id" | "at" | "balanceAfter">,
  ) {
    this.ledger.unshift({
      id: randomBytes(6).toString("hex"),
      at: Date.now(),
      balanceAfter: this.balance,
      ...entry,
    });
    if (this.ledger.length > LEDGER_CAP) this.ledger.length = LEDGER_CAP;
  }

  private bumpSource(source: FeePocketSource, delta: number) {
    const cur = this.bySource[source] ?? 0;
    const next = cur + delta;
    if (next <= 0) delete this.bySource[source];
    else this.bySource[source] = next;
  }

  /** Alias ổn định cho feature mới — luôn dùng API này thay vì vault fee. */
  collectFee(opts: FeeCollectOpts) {
    return this.deposit(opts);
  }

  deposit(opts: FeeCollectOpts):
    | { ok: true; amount: number; balance: number; source: FeePocketSource }
    | { ok: false; reason: string } {
    const source = normalizeFeeSource(opts.source);
    const amount = clampNonNeg(opts.amount);
    if (amount <= 0) return { ok: false, reason: "Số xu không hợp lệ" };
    this.balance += amount;
    this.totalIn += amount;
    this.bumpSource(source, amount);
    this.push({
      type: "in",
      source,
      amount,
      note: opts.note?.trim().slice(0, 160) || `Phí ${feeSourceLabel(source)}`,
      byUsername: opts.byUsername?.trim() || "system",
      userId: opts.userId,
      username: opts.username,
      ref: opts.ref,
      meta: opts.meta,
    });
    this.save();
    return { ok: true, amount, balance: this.balance, source };
  }

  refundFee(opts: FeeCollectOpts) {
    return this.refund(opts);
  }

  refund(opts: FeeCollectOpts):
    | { ok: true; amount: number; balance: number; source: FeePocketSource }
    | { ok: false; reason: string } {
    const source = normalizeFeeSource(opts.source);
    const amount = clampNonNeg(opts.amount);
    if (amount <= 0) return { ok: false, reason: "Số xu không hợp lệ" };
    if (amount > this.balance) {
      return { ok: false, reason: "Fee Pocket không đủ để hoàn" };
    }
    this.balance -= amount;
    this.totalRefunded += amount;
    this.bumpSource(source, -amount);
    this.push({
      type: "refund",
      source,
      amount,
      note: opts.note?.trim().slice(0, 160) || `Hoàn ${feeSourceLabel(source)}`,
      byUsername: opts.byUsername?.trim() || "system",
      userId: opts.userId,
      username: opts.username,
      ref: opts.ref,
      meta: opts.meta,
    });
    this.save();
    return { ok: true, amount, balance: this.balance, source };
  }

  /**
   * Trừ pocket thôi (caller tự ghi vault) — prefer `releaseToVault`.
   */
  transferToVault(
    amountRaw: unknown,
    byUsername: string,
  ):
    | { ok: true; amount: number; balance: number }
    | { ok: false; reason: string } {
    if (this.balance <= 0) {
      return { ok: false, reason: "Fee Pocket đang trống" };
    }
    let amount = Math.floor(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0 || amount > this.balance) {
      amount = this.balance;
    }
    this.balance -= amount;
    this.totalToVault += amount;
    this.push({
      type: "to_vault",
      source: "mixed",
      amount,
      note: "Chuyển vào Kho Tarot",
      byUsername: byUsername.trim() || "admin",
    });
    this.save();
    return { ok: true, amount, balance: this.balance };
  }

  /**
   * Atomic: trừ pocket + ghi vault `pocket_fee`.
   * Dùng API này từ admin / automation — không gọi vault fee riêng.
   */
  releaseToVault(
    amountRaw: unknown,
    byUsername: string,
  ):
    | {
        ok: true;
        amount: number;
        balance: number;
        pocket: ReturnType<FeePocketStore["snapshot"]>;
      }
    | { ok: false; reason: string } {
    const moved = this.transferToVault(amountRaw, byUsername);
    if (!moved.ok) return moved;
    vaultStore.recordFeeFromPocket(
      moved.amount,
      byUsername,
      `Fee Pocket → Kho · ${moved.amount.toLocaleString("vi-VN")} xu`,
    );
    return {
      ok: true,
      amount: moved.amount,
      balance: moved.balance,
      pocket: this.snapshot(),
    };
  }

  snapshot() {
    const sourceRows = Object.entries(this.bySource)
      .map(([id, total]) => ({
        id,
        label: feeSourceLabel(id),
        total,
      }))
      .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
    return {
      schemaVersion: this.schemaVersion,
      balance: this.balance,
      totalIn: this.totalIn,
      totalRefunded: this.totalRefunded,
      totalToVault: this.totalToVault,
      bySource: { ...this.bySource },
      sources: sourceRows,
      knownSources: FEE_SOURCE_IDS.map((id) => ({
        id,
        label: feeSourceLabel(id),
      })),
      ledger: this.ledger.slice(0, 80),
    };
  }
}

export const feePocketStore = new FeePocketStore();
