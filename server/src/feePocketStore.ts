/**
 * Fee Pocket — trung chuyển mọi khoản phí trước khi vào Kho Tarot.
 * Chỉ admin «Add vào vault» mới chuyển pocket → vault.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "fee-pocket.json");
const TMP = join(DATA_DIR, "fee-pocket.json.tmp");

export type FeePocketSource = "ring" | "chat" | "cultivation" | "lixi";

export type FeePocketLedgerType = "in" | "refund" | "to_vault";

export interface FeePocketLedgerEntry {
  id: string;
  at: number;
  type: FeePocketLedgerType;
  source: FeePocketSource | "mixed";
  amount: number;
  balanceAfter: number;
  note: string;
  byUsername: string;
  userId?: string;
  username?: string;
  ref?: string;
}

interface FeePocketFile {
  version: 1;
  balance: number;
  totalIn: number;
  totalRefunded: number;
  totalToVault: number;
  bySource: Record<FeePocketSource, number>;
  ledger: FeePocketLedgerEntry[];
}

const LEDGER_CAP = 500;

const EMPTY_BY_SOURCE = (): Record<FeePocketSource, number> => ({
  ring: 0,
  chat: 0,
  cultivation: 0,
  lixi: 0,
});

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

class FeePocketStore {
  private balance = 0;
  private totalIn = 0;
  private totalRefunded = 0;
  private totalToVault = 0;
  private bySource: Record<FeePocketSource, number> = EMPTY_BY_SOURCE();
  private ledger: FeePocketLedgerEntry[] = [];

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
      this.balance = clampNonNeg(Number(parsed.balance) || 0);
      this.totalIn = clampNonNeg(Number(parsed.totalIn) || 0);
      this.totalRefunded = clampNonNeg(Number(parsed.totalRefunded) || 0);
      this.totalToVault = clampNonNeg(Number(parsed.totalToVault) || 0);
      const bs = parsed.bySource ?? EMPTY_BY_SOURCE();
      this.bySource = {
        ring: clampNonNeg(Number(bs.ring) || 0),
        chat: clampNonNeg(Number(bs.chat) || 0),
        cultivation: clampNonNeg(Number(bs.cultivation) || 0),
        lixi: clampNonNeg(Number(bs.lixi) || 0),
      };
      this.ledger = Array.isArray(parsed.ledger)
        ? parsed.ledger.slice(0, LEDGER_CAP)
        : [];
      console.log(
        `[fee-pocket] Loaded · balance ${this.balance.toLocaleString("vi-VN")}`,
      );
    } catch (err) {
      console.warn("[fee-pocket] load failed:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const body: FeePocketFile = {
        version: 1,
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

  deposit(opts: {
    source: FeePocketSource;
    amount: number;
    userId?: string;
    username?: string;
    note?: string;
    ref?: string;
    byUsername?: string;
  }):
    | { ok: true; amount: number; balance: number }
    | { ok: false; reason: string } {
    const amount = clampNonNeg(opts.amount);
    if (amount <= 0) return { ok: false, reason: "Số xu không hợp lệ" };
    this.balance += amount;
    this.totalIn += amount;
    this.bySource[opts.source] += amount;
    this.push({
      type: "in",
      source: opts.source,
      amount,
      note: opts.note?.trim() || `Phí ${opts.source}`,
      byUsername: opts.byUsername?.trim() || "system",
      userId: opts.userId,
      username: opts.username,
      ref: opts.ref,
    });
    this.save();
    return { ok: true, amount, balance: this.balance };
  }

  refund(opts: {
    source: FeePocketSource;
    amount: number;
    userId?: string;
    username?: string;
    note?: string;
    ref?: string;
    byUsername?: string;
  }):
    | { ok: true; amount: number; balance: number }
    | { ok: false; reason: string } {
    const amount = clampNonNeg(opts.amount);
    if (amount <= 0) return { ok: false, reason: "Số xu không hợp lệ" };
    if (amount > this.balance) {
      return { ok: false, reason: "Fee Pocket không đủ để hoàn" };
    }
    this.balance -= amount;
    this.totalRefunded += amount;
    this.bySource[opts.source] = Math.max(
      0,
      this.bySource[opts.source] - amount,
    );
    this.push({
      type: "refund",
      source: opts.source,
      amount,
      note: opts.note?.trim() || `Hoàn ${opts.source}`,
      byUsername: opts.byUsername?.trim() || "system",
      userId: opts.userId,
      username: opts.username,
      ref: opts.ref,
    });
    this.save();
    return { ok: true, amount, balance: this.balance };
  }

  /**
   * Trừ pocket; caller ghi vault. amount thiếu/≤0/>balance → toàn bộ.
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

  snapshot() {
    return {
      balance: this.balance,
      totalIn: this.totalIn,
      totalRefunded: this.totalRefunded,
      totalToVault: this.totalToVault,
      bySource: { ...this.bySource },
      ledger: this.ledger.slice(0, 80),
    };
  }
}

export const feePocketStore = new FeePocketStore();
