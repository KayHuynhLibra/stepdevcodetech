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
  | "set_balance"
  | "coupon_mint"
  | "admin_adjust";

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
const LEDGER_CAP = 200;
const START_BALANCE = 500_000;

export class VaultStore {
  private balance = START_BALANCE;
  private totalStakeIn = 0;
  private totalPayoutOut = 0;
  private totalMinted = 0;
  private totalBurned = 0;
  private ledger: VaultLedgerEntry[] = [];
  private readonly filePath: string;
  private readonly tmpPath: string;
  private readonly label: string;

  constructor(fileName = "vault.json", label = "Kho Tarot") {
    this.filePath = join(DATA_DIR, fileName);
    this.tmpPath = join(DATA_DIR, `${fileName}.tmp`);
    this.label = label;
    this.load();
  }

  private load() {
    try {
      if (!existsSync(this.filePath)) {
        this.save();
        return;
      }
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as VaultFile;
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
      console.log(
        `[vault:${this.label}] Loaded · balance ${Math.round(this.balance)}`,
      );
    } catch (err) {
      console.warn(`[vault:${this.label}] Failed to load:`, err);
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
      writeFileSync(this.tmpPath, JSON.stringify(payload, null, 2), "utf8");
      renameSync(this.tmpPath, this.filePath);
    } catch (err) {
      console.warn(`[vault:${this.label}] Failed to save:`, err);
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
      label: this.label,
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
        `[vault:${this.label}] Kho âm ${this.balance} sau trả ${amt} cho ${username}`,
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
    this.push(
      d > 0 ? "mint" : "burn",
      d,
      byUsername,
      note || (d > 0 ? "Bơm kho" : "Rút kho"),
    );
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

  /**
   * Coupon redeem: trừ kho (cho phép âm — nợ nạp xu).
   * Xu user lấy từ kho nhà cái.
   */
  recordCouponMint(
    amount: number,
    userId: string,
    username: string,
    code: string,
  ) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance -= amt;
    this.totalMinted += amt;
    this.push("coupon_mint", -amt, "system", `Coupon ${code}`, {
      userId,
      username,
    });
  }

  /**
   * Admin chỉnh số dư user: +delta trừ kho, -delta cộng kho.
   * Cho phép kho âm khi cấp nhiều.
   */
  recordAdminAdjust(
    delta: number,
    byUsername: string,
    userId: string,
    username: string,
  ) {
    const d = Math.floor(delta);
    if (!Number.isFinite(d) || d === 0) return;
    this.balance -= d;
    if (d > 0) this.totalMinted += d;
    else this.totalBurned += -d;
    this.push(
      "admin_adjust",
      -d,
      byUsername,
      d > 0 ? "Admin cộng xu" : "Admin trừ xu",
      { userId, username },
    );
  }
}

/** Kho bàn Tarot + vận hành ví (coupon/grant/seize) */
export const vaultTarot = new VaultStore("vault.json", "Kho Tarot");
/** Alias cũ — game.ts / coupon vẫn import vaultStore */
export const vaultStore = vaultTarot;
/** Kho bàn Bánh xe Arcana — độc lập */
export const vaultArcana = new VaultStore("vault-arcana.json", "Kho Arcana");
