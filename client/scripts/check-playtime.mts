/**
 * Quick logic check for playtime milestones (run: npx tsx client/scripts/check-playtime.mts)
 */
import {
  addVisibleMs,
  formatDuration,
  loadPlaytime,
  markNudgeShown,
  nextNudge,
} from "../src/playtime.ts";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, v);
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
};

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(formatDuration(32 * 60_000) === "32p", "format 32p");
assert(formatDuration(65 * 60_000) === "1h05", "format 1h05");

let s = loadPlaytime();
const n1 = nextNudge(s, 30 * 60_000, 10 * 60_000);
assert(n1?.kind === "session" && n1.minutes === 30, "session 30");
s = markNudgeShown(s, "session", 30);
assert(nextNudge(s, 30 * 60_000, 10 * 60_000) === null, "no spam session 30");

s = addVisibleMs(s, 60 * 60_000);
const n2 = nextNudge(s, 5 * 60_000, s.dayMs);
assert(n2?.kind === "day" && n2.minutes === 60, "day 60");
s = markNudgeShown(s, "day", 60);
assert(nextNudge(s, 5 * 60_000, s.dayMs) === null, "no spam day 60");

const reloaded = loadPlaytime();
assert(reloaded.shownSession.includes(30), "persist session");
assert(reloaded.shownDay.includes(60), "persist day");

console.log("playtime checks OK");
