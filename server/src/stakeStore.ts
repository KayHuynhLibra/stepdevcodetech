import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { todayKey, weekKey } from "./types.js";
import { trafficRollupStore } from "./trafficRollupStore.js";

export interface StakeEntry {
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

interface StakesFile {
  version: 1;
  entries: StakeEntry[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STAKES_PATH = join(DATA_DIR, "stakes.json");
const STAKES_TMP = join(DATA_DIR, "stakes.json.tmp");
const GLOBAL_CAP = 2000;
/** Max rows returned / kept per user — used by API clamp */
export const PER_USER_STAKE_CAP = 80;
const PER_USER_CAP = PER_USER_STAKE_CAP;

function periodFromEntries(
  entries: StakeEntry[],
  predicate: (e: StakeEntry) => boolean,
) {
  let stake = 0;
  let payout = 0;
  let profit = 0;
  let stakes = 0;
  let wins = 0;
  let loses = 0;
  const users = new Set<string>();
  const rounds = new Set<number>();
  for (const e of entries) {
    if (!predicate(e)) continue;
    stake += e.amount;
    payout += e.payout;
    profit += e.profit;
    stakes += 1;
    if (e.result === "win") wins += 1;
    else loses += 1;
    users.add(e.userId);
    rounds.add(e.round);
  }
  return {
    stake,
    payout,
    profit,
    stakes,
    wins,
    loses,
    uniqueUsers: users.size,
    uniqueRounds: rounds.size,
    houseEdge: stake - payout,
  };
}

export class StakeStore {
  private entries: StakeEntry[] = [];

  constructor() {
    this.load();
    trafficRollupStore.seedFromStakes(this.entries);
  }

  private load() {
    try {
      const betsLegacy = join(DATA_DIR, "bets.json");
      let path = STAKES_PATH;
      if (!existsSync(STAKES_PATH) && existsSync(betsLegacy)) {
        path = betsLegacy;
        console.log("[stakes] Migrating bets.json → stakes.json");
      }
      if (!existsSync(path)) return;
      const parsed = JSON.parse(readFileSync(path, "utf8")) as StakesFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) return;
      this.entries = parsed.entries.filter(
        (e) =>
          e &&
          typeof e.userId === "string" &&
          typeof e.round === "number" &&
          typeof e.cardId === "number" &&
          typeof e.amount === "number",
      );
      console.log(`[stakes] Loaded ${this.entries.length} stake rows`);
      if (path !== STAKES_PATH) this.save();
    } catch (err) {
      console.warn("[stakes] Failed to load stakes.json:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: StakesFile = {
        version: 1,
        entries: this.entries.slice(0, GLOBAL_CAP),
      };
      writeFileSync(STAKES_TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(STAKES_TMP, STAKES_PATH);
    } catch (err) {
      console.warn("[stakes] Failed to save stakes.json:", err);
    }
  }

  /** Ghi toàn bộ xu đặt của user trong 1 ván (sau khi biết lá thắng). */
  recordRoundStakes(rows: Omit<StakeEntry, "id" | "at">[]) {
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
    trafficRollupStore.recordStakes(rows, at);
  }

  getByUser(userId: string, limit = 30): StakeEntry[] {
    const out: StakeEntry[] = [];
    for (const e of this.entries) {
      if (e.userId !== userId) continue;
      out.push(e);
      if (out.length >= Math.min(limit, PER_USER_CAP)) break;
    }
    return out;
  }

  getRecent(limit = 50): StakeEntry[] {
    return this.entries.slice(0, Math.min(limit, 100));
  }

  /** Thống kê xu 24h theo userId. */
  getUserStats24h(userId: string): {
    xu24h: number;
    stakes24h: number;
    profit24h: number;
  } {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    let xu24h = 0;
    let stakes24h = 0;
    let profit24h = 0;
    for (const e of this.entries) {
      if (e.userId !== userId) continue;
      if (e.at < since) continue;
      xu24h += e.amount;
      stakes24h += 1;
      profit24h += e.profit;
    }
    return { xu24h, stakes24h, profit24h };
  }

  /**
   * Tổng lưu lượng xu đã ghi + cửa sổ rolling + lịch UTC.
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
    let stakesToday = 0;
    let stakeHour = 0;
    let stakesHour = 0;

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
        stakesToday += 1;
      }
      if (now - e.at < 60 * 60 * 1000) {
        stakeHour += e.amount;
        stakesHour += 1;
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
      stakeRows: this.entries.length,
      uniqueUsers: users.size,
      uniqueRounds: rounds.size,
      stakeTotal,
      payoutTotal,
      profitTotal,
      winCount,
      loseCount,
      /** rolling 24h — giữ tương thích UI cũ */
      stakeToday,
      stakesToday,
      stakeHour,
      stakesHour,
      rolling,
      periods: rollup,
    };
  }
}

export const stakeStore = new StakeStore();
