import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { todayKey, weekKey } from "./types.js";
import { trafficRollupStore } from "./trafficRollupStore.js";

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
/** Max rows returned / kept per user — used by API clamp */
export const PER_USER_BET_CAP = 80;
const PER_USER_CAP = PER_USER_BET_CAP;

function periodFromEntries(
  entries: BetEntry[],
  predicate: (e: BetEntry) => boolean,
) {
  let stake = 0;
  let payout = 0;
  let profit = 0;
  let bets = 0;
  let wins = 0;
  let loses = 0;
  const users = new Set<string>();
  const rounds = new Set<number>();
  for (const e of entries) {
    if (!predicate(e)) continue;
    stake += e.amount;
    payout += e.payout;
    profit += e.profit;
    bets += 1;
    if (e.result === "win") wins += 1;
    else loses += 1;
    users.add(e.userId);
    rounds.add(e.round);
  }
  return {
    stake,
    payout,
    profit,
    bets,
    wins,
    loses,
    uniqueUsers: users.size,
    uniqueRounds: rounds.size,
    houseEdge: stake - payout,
  };
}

export class BetStore {
  private entries: BetEntry[] = [];

  constructor() {
    this.load();
    trafficRollupStore.seedFromBets(this.entries);
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
  recordRoundBets(rows: Omit<BetEntry, "id" | "at">[]) {
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
    trafficRollupStore.recordBets(rows, at);
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

  /** Thống kê cược 24h theo userId. */
  getUserStats24h(userId: string): {
    stake24h: number;
    bets24h: number;
    profit24h: number;
  } {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    let stake24h = 0;
    let bets24h = 0;
    let profit24h = 0;
    for (const e of this.entries) {
      if (e.userId !== userId) continue;
      if (e.at < since) continue;
      stake24h += e.amount;
      bets24h += 1;
      profit24h += e.profit;
    }
    return { stake24h, bets24h, profit24h };
  }

  /**
   * Tổng lưu lượng cược đã ghi + cửa sổ rolling + lịch UTC.
   * `periods` ưu tiên rollup (bền); live window từ bản ghi còn trong store.
   */
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

    const nowDate = new Date();
    const calDay = todayKey(nowDate);
    const calWeek = weekKey(nowDate);
    const calMonth = nowDate.toISOString().slice(0, 7);

    const rolling = {
      hour: periodFromEntries(this.entries, (e) => now - e.at < 60 * 60 * 1000),
      rolling24h: periodFromEntries(this.entries, (e) => now - e.at < dayMs),
      calendarDay: periodFromEntries(
        this.entries,
        (e) => todayKey(new Date(e.at)) === calDay,
      ),
      calendarWeek: periodFromEntries(
        this.entries,
        (e) => weekKey(new Date(e.at)) === calWeek,
      ),
      calendarMonth: periodFromEntries(
        this.entries,
        (e) => new Date(e.at).toISOString().slice(0, 7) === calMonth,
      ),
    };

    const rollup = trafficRollupStore.getPeriods(nowDate);

    return {
      betRows: this.entries.length,
      uniqueUsers: users.size,
      uniqueRounds: rounds.size,
      stakeTotal,
      payoutTotal,
      profitTotal,
      winCount,
      loseCount,
      /** rolling 24h — giữ tương thích UI cũ */
      stakeToday,
      betsToday,
      stakeHour,
      betsHour,
      rolling,
      periods: rollup,
    };
  }
}

export const betStore = new BetStore();
