/**
 * One-shot: scale monetary fields ÷10 on server/data (Railway volume).
 * Safe to re-run only once — checks marker file migrate-scale-div10.done
 *
 * Usage (from repo root / container):
 *   node server/scripts/migrate-scale-div10.mjs
 *   node server/scripts/migrate-scale-div10.mjs --force
 */
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");
const MARKER = join(DATA, "migrate-scale-div10.done");
const force = process.argv.includes("--force");

function scale(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return n;
  return Math.round(n / 10);
}

function writeJson(path, obj) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  renameSync(tmp, path);
}

if (!existsSync(DATA)) {
  console.error("[migrate] No data dir:", DATA);
  process.exit(1);
}
if (existsSync(MARKER) && !force) {
  console.log("[migrate] Already done (marker present). Use --force to re-run.");
  process.exit(0);
}

mkdirSync(DATA, { recursive: true });

const usersPath = join(DATA, "users.json");
if (existsSync(usersPath)) {
  const raw = JSON.parse(readFileSync(usersPath, "utf8"));
  for (const u of raw.users || []) {
    u.balance = scale(u.balance);
    u.winToday = scale(u.winToday);
    if (typeof u.stakeWeek === "number") u.stakeWeek = scale(u.stakeWeek);
  }
  writeJson(usersPath, raw);
  console.log(`[migrate] users.json · ${raw.users?.length ?? 0} accounts`);
}

const vaultPath = join(DATA, "vault.json");
if (existsSync(vaultPath)) {
  const raw = JSON.parse(readFileSync(vaultPath, "utf8"));
  if (typeof raw.balance === "number") raw.balance = scale(raw.balance);
  for (const e of raw.ledger || []) {
    if (typeof e.amount === "number") e.amount = scale(e.amount);
    if (typeof e.balanceAfter === "number") e.balanceAfter = scale(e.balanceAfter);
  }
  writeJson(vaultPath, raw);
  console.log("[migrate] vault.json");
}

const couponsPath = join(DATA, "coupons.json");
if (existsSync(couponsPath)) {
  const raw = JSON.parse(readFileSync(couponsPath, "utf8"));
  for (const c of raw.coupons || []) {
    if (typeof c.amount === "number") c.amount = scale(c.amount);
  }
  for (const r of raw.redemptions || []) {
    if (typeof r.amount === "number") r.amount = scale(r.amount);
  }
  writeJson(couponsPath, raw);
  console.log("[migrate] coupons.json");
}

const betsPath = join(DATA, "bets.json");
if (existsSync(betsPath)) {
  const raw = JSON.parse(readFileSync(betsPath, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.bets || [];
  for (const b of rows) {
    if (typeof b.amount === "number") b.amount = scale(b.amount);
    if (typeof b.payout === "number") b.payout = scale(b.payout);
    if (typeof b.profit === "number") b.profit = scale(b.profit);
  }
  writeJson(betsPath, Array.isArray(raw) ? rows : { ...raw, bets: rows });
  console.log(`[migrate] bets.json · ${rows.length} rows`);
}

writeFileSync(
  MARKER,
  JSON.stringify({ at: Date.now(), note: "monetary fields ÷10" }, null, 2),
  "utf8",
);
console.log("[migrate] Done. Marker:", MARKER);
