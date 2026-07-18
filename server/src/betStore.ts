import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

export interface BetEntry {
  id: string;
  at: number;
  userId: string;
  username: string;
  round: number;
  cardId: number;
  amount: number;
  /** win = đúng lá thắng; lose = đặt nhưng không trúng; void = không áp dụng */
  result: "win" | "lose";
  payout: number;
  profit: number;
  winningCardId: number;
}

interface BetsFile {
  version: 1;
  entries: BetEntry[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const BETS_PATH = join(DATA_DIR, "bets.json");
const BETS_TMP = join(DATA_DIR, "bets.json.tmp");
const GLOBAL_CAP = 2000;
const PER_USER_CAP = 80;

export class BetStore {
  private entries: BetEntry[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(BETS_PATH)) return;
      const parsed = JSON.parse(readFileSync(BETS_PATH, "utf8")) as BetsFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) return;
      this.entries = parsed.entries.filter(
        (e) =>
          e &&
          typeof e.userId === "string" &&
          typeof e.round === "number" &&
          typeof e.cardId === "number" &&
          typeof e.amount === "number",
      );
      console.log(`[bets] Loaded ${this.entries.length} bet rows`);
    } catch (err) {
      console.warn("[bets] Failed to load bets.json:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: BetsFile = {
        version: 1,
        entries: this.entries.slice(0, GLOBAL_CAP),
      };
      writeFileSync(BETS_TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(BETS_TMP, BETS_PATH);
    } catch (err) {
      console.warn("[bets] Failed to save bets.json:", err);
    }
  }

  /** Ghi toàn bộ cược của user trong 1 ván (sau khi biết lá thắng). */
  recordRoundBets(
    rows: Omit<BetEntry, "id" | "at">[],
  ) {
    const at = Date.now();
    for (const row of rows) {
      this.entries.unshift({
        ...row,
        id: randomBytes(6).toString("hex"),
        at,
      });
    }
    if (this.entries.length > GLOBAL_CAP) {
      this.entries.length = GLOBAL_CAP;
    }
    this.save();
  }

  getByUser(userId: string, limit = 30): BetEntry[] {
    const out: BetEntry[] = [];
    for (const e of this.entries) {
      if (e.userId !== userId) continue;
      out.push(e);
      if (out.length >= Math.min(limit, PER_USER_CAP)) break;
    }
    return out;
  }

  getRecent(limit = 50): BetEntry[] {
    return this.entries.slice(0, Math.min(limit, 100));
  }

  /** Tổng lưu lượng cược đã ghi (toàn bộ bản ghi trong store). */
  getTrafficStats() {
    let stakeTotal = 0;
    let payoutTotal = 0;
    let profitTotal = 0;
    let winCount = 0;
    let loseCount = 0;
    const users = new Set<string>();
    const rounds = new Set<number>();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let stakeToday = 0;
    let betsToday = 0;
    let stakeHour = 0;
    let betsHour = 0;

    for (const e of this.entries) {
      stakeTotal += e.amount;
      payoutTotal += e.payout;
      profitTotal += e.profit;
      if (e.result === "win") winCount += 1;
      else loseCount += 1;
      users.add(e.userId);
      rounds.add(e.round);
      if (now - e.at < dayMs) {
        stakeToday += e.amount;
        betsToday += 1;
      }
      if (now - e.at < 60 * 60 * 1000) {
        stakeHour += e.amount;
        betsHour += 1;
      }
    }

    return {
      betRows: this.entries.length,
      uniqueUsers: users.size,
      uniqueRounds: rounds.size,
      stakeTotal,
      payoutTotal,
      profitTotal,
      winCount,
      loseCount,
      stakeToday,
      betsToday,
      stakeHour,
      betsHour,
    };
  }
}

export const betStore = new BetStore();
