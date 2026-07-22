/**
 * Rollup lưu lượng theo ngày (UTC YYYY-MM-DD) — giữ lịch sử khi bets.json bị cap.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { todayKey, weekKey } from "./types.js";

export interface TrafficDayBucket {
  day: string;
  stake: number;
  payout: number;
  profit: number;
  bets: number;
  wins: number;
  loses: number;
  uniqueUsers: number;
  uniqueRounds: number;
}

interface RollupFile {
  version: 1;
  days: TrafficDayBucket[];
}

export interface TrafficPeriodStats {
  stake: number;
  payout: number;
  profit: number;
  bets: number;
  wins: number;
  loses: number;
  uniqueUsers: number;
  uniqueRounds: number;
  houseEdge: number;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "traffic-rollup.json");
const TMP = join(DATA_DIR, "traffic-rollup.json.tmp");
/** Giữ ~2 năm ngày */
const DAY_CAP = 800;

function emptyPeriod(): TrafficPeriodStats {
  return {
    stake: 0,
    payout: 0,
    profit: 0,
    bets: 0,
    wins: 0,
    loses: 0,
    uniqueUsers: 0,
    uniqueRounds: 0,
    houseEdge: 0,
  };
}

function sumBuckets(list: TrafficDayBucket[]): TrafficPeriodStats {
  const out = emptyPeriod();
  const usersApprox = new Set<string>();
  for (const d of list) {
    out.stake += d.stake;
    out.payout += d.payout;
    out.profit += d.profit;
    out.bets += d.bets;
    out.wins += d.wins;
    out.loses += d.loses;
    out.uniqueRounds += d.uniqueRounds;
    // uniqueUsers: cộng xấp xỉ (có thể đếm trùng giữa ngày)
    out.uniqueUsers += d.uniqueUsers;
    usersApprox.add(d.day);
  }
  out.houseEdge = out.stake - out.payout;
  // uniqueUsers trên nhiều ngày chỉ là tổng mỗi ngày — gắn note phía UI
  void usersApprox;
  return out;
}

function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export class TrafficRollupStore {
  private days = new Map<string, TrafficDayBucket>();
  /** userIds / roundIds trong ngày hiện tại (để unique chính xác hơn khi ghi) */
  private dayUsers = new Map<string, Set<string>>();
  private dayRounds = new Map<string, Set<number>>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as RollupFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.days)) return;
      for (const row of parsed.days) {
        if (!row?.day || typeof row.stake !== "number") continue;
        this.days.set(row.day, {
          day: row.day,
          stake: row.stake || 0,
          payout: row.payout || 0,
          profit: row.profit || 0,
          bets: row.bets || 0,
          wins: row.wins || 0,
          loses: row.loses || 0,
          uniqueUsers: row.uniqueUsers || 0,
          uniqueRounds: row.uniqueRounds || 0,
        });
      }
      console.log(`[traffic-rollup] Loaded ${this.days.size} day buckets`);
    } catch (err) {
      console.warn("[traffic-rollup] Failed to load:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const days = [...this.days.values()]
        .sort((a, b) => (a.day < b.day ? 1 : -1))
        .slice(0, DAY_CAP);
      const payload: RollupFile = { version: 1, days };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[traffic-rollup] Failed to save:", err);
    }
  }

  /** Rebuild từ bets nếu rollup trống (một lần). */
  seedFromBets(
    entries: {
      at: number;
      userId: string;
      amount: number;
      payout: number;
      profit: number;
      result: "win" | "lose";
      round: number;
    }[],
  ) {
    if (this.days.size > 0 || entries.length === 0) return;
    const usersByDay = new Map<string, Set<string>>();
    const roundsByDay = new Map<string, Set<number>>();
    for (const e of entries) {
      const day = todayKey(new Date(e.at));
      let bucket = this.days.get(day);
      if (!bucket) {
        bucket = {
          day,
          stake: 0,
          payout: 0,
          profit: 0,
          bets: 0,
          wins: 0,
          loses: 0,
          uniqueUsers: 0,
          uniqueRounds: 0,
        };
        this.days.set(day, bucket);
      }
      bucket.stake += e.amount;
      bucket.payout += e.payout;
      bucket.profit += e.profit;
      bucket.bets += 1;
      if (e.result === "win") bucket.wins += 1;
      else bucket.loses += 1;
      let us = usersByDay.get(day);
      if (!us) {
        us = new Set();
        usersByDay.set(day, us);
      }
      us.add(e.userId);
      let rs = roundsByDay.get(day);
      if (!rs) {
        rs = new Set();
        roundsByDay.set(day, rs);
      }
      rs.add(e.round);
    }
    for (const [day, us] of usersByDay) {
      const b = this.days.get(day);
      if (b) b.uniqueUsers = us.size;
    }
    for (const [day, rs] of roundsByDay) {
      const b = this.days.get(day);
      if (b) b.uniqueRounds = rs.size;
    }
    this.save();
    console.log(
      `[traffic-rollup] Seeded ${this.days.size} days from ${entries.length} bets`,
    );
  }

  recordBets(
    rows: {
      userId: string;
      amount: number;
      payout: number;
      profit: number;
      result: "win" | "lose";
      round: number;
    }[],
    at = Date.now(),
  ) {
    if (!rows.length) return;
    const day = todayKey(new Date(at));
    let bucket = this.days.get(day);
    if (!bucket) {
      bucket = {
        day,
        stake: 0,
        payout: 0,
        profit: 0,
        bets: 0,
        wins: 0,
        loses: 0,
        uniqueUsers: 0,
        uniqueRounds: 0,
      };
      this.days.set(day, bucket);
    }
    let us = this.dayUsers.get(day);
    if (!us) {
      us = new Set();
      this.dayUsers.set(day, us);
    }
    let rs = this.dayRounds.get(day);
    if (!rs) {
      rs = new Set();
      this.dayRounds.set(day, rs);
    }
    for (const row of rows) {
      bucket.stake += row.amount;
      bucket.payout += row.payout;
      bucket.profit += row.profit;
      bucket.bets += 1;
      if (row.result === "win") bucket.wins += 1;
      else bucket.loses += 1;
      us.add(row.userId);
      rs.add(row.round);
    }
    bucket.uniqueUsers = Math.max(bucket.uniqueUsers, us.size);
    bucket.uniqueRounds = Math.max(bucket.uniqueRounds, rs.size);
    this.save();
  }

  getDay(day: string): TrafficDayBucket | null {
    return this.days.get(day) ?? null;
  }

  /** Chuỗi ngày mới → cũ */
  getDaySeries(limit = 14): TrafficDayBucket[] {
    return [...this.days.values()]
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, limit);
  }

  getWeekSeries(limit = 8): { week: string; stats: TrafficPeriodStats }[] {
    const byWeek = new Map<string, TrafficDayBucket[]>();
    for (const d of this.days.values()) {
      const wk = weekKey(new Date(`${d.day}T12:00:00.000Z`));
      const list = byWeek.get(wk) ?? [];
      list.push(d);
      byWeek.set(wk, list);
    }
    return [...byWeek.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, limit)
      .map(([week, list]) => ({ week, stats: sumBuckets(list) }));
  }

  getMonthSeries(limit = 6): { month: string; stats: TrafficPeriodStats }[] {
    const byMonth = new Map<string, TrafficDayBucket[]>();
    for (const d of this.days.values()) {
      const mk = d.day.slice(0, 7);
      const list = byMonth.get(mk) ?? [];
      list.push(d);
      byMonth.set(mk, list);
    }
    return [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, limit)
      .map(([month, list]) => ({ month, stats: sumBuckets(list) }));
  }

  getPeriods(now = new Date()) {
    const today = todayKey(now);
    const thisWeek = weekKey(now);
    const thisMonth = monthKey(now);

    const dayBuckets = [...this.days.values()];
    const todayBucket = this.days.get(today);
    const weekList = dayBuckets.filter(
      (d) => weekKey(new Date(`${d.day}T12:00:00.000Z`)) === thisWeek,
    );
    const monthList = dayBuckets.filter((d) => d.day.startsWith(thisMonth));

    return {
      timezoneNote: "UTC calendar (todayKey / weekKey ISO)",
      todayKey: today,
      weekKey: thisWeek,
      monthKey: thisMonth,
      day: todayBucket
        ? {
            ...emptyPeriod(),
            stake: todayBucket.stake,
            payout: todayBucket.payout,
            profit: todayBucket.profit,
            bets: todayBucket.bets,
            wins: todayBucket.wins,
            loses: todayBucket.loses,
            uniqueUsers: todayBucket.uniqueUsers,
            uniqueRounds: todayBucket.uniqueRounds,
            houseEdge: todayBucket.stake - todayBucket.payout,
          }
        : emptyPeriod(),
      week: sumBuckets(weekList),
      month: sumBuckets(monthList),
      daySeries: this.getDaySeries(14),
      weekSeries: this.getWeekSeries(8),
      monthSeries: this.getMonthSeries(6),
    };
  }
}

export const trafficRollupStore = new TrafficRollupStore();
