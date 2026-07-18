import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

export type VaultLedgerType =
  | "stake_in"
  | "stake_refund"
  | "payout_out"
  | "mint"
  | "burn"
  | "grant_user"
  | "seize_user"
  | "set_balance";

export interface VaultLedgerEntry {
  id: string;
  at: number;
  type: VaultLedgerType;
  amount: number;
  balanceAfter: number;
  note: string;
  byUsername: string;
  userId?: string;
  username?: string;
}

interface VaultFile {
  version: 1;
  balance: number;
  totalStakeIn: number;
  totalPayoutOut: number;
  totalMinted: number;
  totalBurned: number;
  ledger: VaultLedgerEntry[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const VAULT_PATH = join(DATA_DIR, "vault.json");
const VAULT_TMP = join(DATA_DIR, "vault.json.tmp");
const LEDGER_CAP = 200;
const START_BALANCE = 500_000;

export class VaultStore {
  private balance = START_BALANCE;
  private totalStakeIn = 0;
  private totalPayoutOut = 0;
  private totalMinted = 0;
  private totalBurned = 0;
  private ledger: VaultLedgerEntry[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(VAULT_PATH)) {
        this.save();
        return;
      }
      const parsed = JSON.parse(readFileSync(VAULT_PATH, "utf8")) as VaultFile;
      if (parsed?.version !== 1) return;
      if (typeof parsed.balance === "number") this.balance = parsed.balance;
      if (typeof parsed.totalStakeIn === "number")
        this.totalStakeIn = parsed.totalStakeIn;
      if (typeof parsed.totalPayoutOut === "number")
        this.totalPayoutOut = parsed.totalPayoutOut;
      if (typeof parsed.totalMinted === "number")
        this.totalMinted = parsed.totalMinted;
      if (typeof parsed.totalBurned === "number")
        this.totalBurned = parsed.totalBurned;
      if (Array.isArray(parsed.ledger)) {
        this.ledger = parsed.ledger.slice(0, LEDGER_CAP);
      }
      console.log(`[vault] Loaded kho xu · balance ${Math.round(this.balance)}`);
    } catch (err) {
      console.warn("[vault] Failed to load vault.json:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: VaultFile = {
        version: 1,
        balance: this.balance,
        totalStakeIn: this.totalStakeIn,
        totalPayoutOut: this.totalPayoutOut,
        totalMinted: this.totalMinted,
        totalBurned: this.totalBurned,
        ledger: this.ledger.slice(0, LEDGER_CAP),
      };
      writeFileSync(VAULT_TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(VAULT_TMP, VAULT_PATH);
    } catch (err) {
      console.warn("[vault] Failed to save vault.json:", err);
    }
  }

  private push(
    type: VaultLedgerType,
    amount: number,
    byUsername: string,
    note: string,
    extra?: { userId?: string; username?: string },
  ) {
    this.ledger.unshift({
      id: randomBytes(6).toString("hex"),
      at: Date.now(),
      type,
      amount,
      balanceAfter: this.balance,
      note,
      byUsername,
      userId: extra?.userId,
      username: extra?.username,
    });
    if (this.ledger.length > LEDGER_CAP) this.ledger.length = LEDGER_CAP;
    this.save();
  }

  getSnapshot() {
    return {
      balance: this.balance,
      totalStakeIn: this.totalStakeIn,
      totalPayoutOut: this.totalPayoutOut,
      totalMinted: this.totalMinted,
      totalBurned: this.totalBurned,
      netHouse:
        this.totalStakeIn -
        this.totalPayoutOut +
        this.totalMinted -
        this.totalBurned,
      ledger: this.ledger.slice(0, 50),
    };
  }

  /** User thật đặt cược → xu vào kho */
  recordStakeIn(amount: number, username: string, userId: string) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance += amt;
    this.totalStakeIn += amt;
    this.push("stake_in", amt, "system", `Cược vào kho`, {
      userId,
      username,
    });
  }

  /** Hoàn cược (disconnect lúc betting) — trừ lại stake_in. */
  recordStakeRefund(amount: number, username: string, userId: string) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance -= amt;
    this.totalStakeIn = Math.max(0, this.totalStakeIn - amt);
    this.push("stake_refund", -amt, "system", `Hoàn cược (thoát bàn)`, {
      userId,
      username,
    });
  }

  /** Trả thưởng user thật → trừ kho (cho phép âm — nợ nhà cái). */
  recordPayoutOut(amount: number, username: string, userId: string) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance -= amt;
    this.totalPayoutOut += amt;
    if (this.balance < 0) {
      console.warn(
        `[vault] Kho âm ${this.balance} sau trả ${amt} cho ${username}`,
      );
    }
    this.push("payout_out", -amt, "system", `Trả thưởng từ kho`, {
      userId,
      username,
    });
  }

  adjust(
    delta: number,
    byUsername: string,
    note: string,
  ): { ok: true; balance: number } | { ok: false; reason: string } {
    const d = Math.floor(delta);
    if (!Number.isFinite(d) || d === 0) {
      return { ok: false, reason: "Delta không hợp lệ" };
    }
    const next = this.balance + d;
    if (next < 0) return { ok: false, reason: "Kho xu không đủ" };
    this.balance = next;
    if (d > 0) this.totalMinted += d;
    else this.totalBurned += -d;
    this.push(d > 0 ? "mint" : "burn", d, byUsername, note || (d > 0 ? "Bơm kho" : "Rút kho"));
    return { ok: true, balance: this.balance };
  }

  setBalance(
    balance: number,
    byUsername: string,
    note: string,
  ): { ok: true; balance: number } | { ok: false; reason: string } {
    const next = Math.floor(balance);
    if (!Number.isFinite(next) || next < 0) {
      return { ok: false, reason: "Số dư kho không hợp lệ" };
    }
    const delta = next - this.balance;
    this.balance = next;
    if (delta > 0) this.totalMinted += delta;
    else if (delta < 0) this.totalBurned += -delta;
    this.push("set_balance", delta, byUsername, note || `Đặt kho = ${next}`);
    return { ok: true, balance: this.balance };
  }

  /** Cấp xu cho user từ kho (trừ kho) */
  prepareGrant(
    amount: number,
  ): { ok: true; amount: number } | { ok: false; reason: string } {
    const amt = Math.floor(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { ok: false, reason: "Số xu không hợp lệ" };
    }
    if (this.balance < amt) return { ok: false, reason: "Kho xu không đủ" };
    return { ok: true, amount: amt };
  }

  commitGrant(
    amount: number,
    byUsername: string,
    userId: string,
    username: string,
    note: string,
  ) {
    this.balance -= amount;
    this.push("grant_user", -amount, byUsername, note || "Cấp xu từ kho", {
      userId,
      username,
    });
  }

  commitSeize(
    amount: number,
    byUsername: string,
    userId: string,
    username: string,
    note: string,
  ) {
    this.balance += amount;
    this.push("seize_user", amount, byUsername, note || "Thu xu về kho", {
      userId,
      username,
    });
  }
}

export const vaultStore = new VaultStore();
