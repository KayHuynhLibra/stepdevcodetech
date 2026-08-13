/**
 * One-shot: scale monetary fields ÷10 on server/data (Railway volume).
 *
 * Usage:
 *   node server/scripts/migrate-scale-div10.mjs           # only if no marker
 *   node server/scripts/migrate-scale-div10.mjs --force   # ignore marker
 *   node server/scripts/migrate-scale-div10.mjs --auto    # only if no marker AND looks like old scale
 */
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");
const MARKER = join(DATA, "migrate-scale-div10.done");
const force = process.argv.includes("--force");
const auto = process.argv.includes("--auto");

function scale(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return n;
  return Math.round(n / 10);
}

function writeJson(path, obj) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  renameSync(tmp, path);
}

function looksLikeOldScale() {
  const usersPath = join(DATA, "users.json");
  const vaultPath = join(DATA, "vault.json");
  let maxBal = 0;
  if (existsSync(usersPath)) {
    try {
      const raw = JSON.parse(readFileSync(usersPath, "utf8"));
      for (const u of raw.users || []) {
        if (typeof u.balance === "number" && u.balance > maxBal) maxBal = u.balance;
      }
    } catch {
      /* ignore */
    }
  }
  let vaultBal = 0;
  if (existsSync(vaultPath)) {
    try {
      const raw = JSON.parse(readFileSync(vaultPath, "utf8"));
      if (typeof raw.balance === "number") vaultBal = raw.balance;
    } catch {
      /* ignore */
    }
  }
  // New scale: start 20k, max bet 100k, vault seed ~500k.
  // Old scale: start 200k, vault often |balance| ≥2M (có thể âm sau payout).
  return maxBal >= 150_000 || Math.abs(vaultBal) >= 2_000_000;
}

if (!existsSync(DATA)) {
  console.log("[migrate] No data dir yet — skip");
  process.exit(0);
}
if (existsSync(MARKER) && !force) {
  console.log("[migrate] Already done (marker present).");
  process.exit(0);
}
if (auto && !force && !looksLikeOldScale()) {
  console.log("[migrate] Auto: balances look post-÷10 — skip");
  process.exit(0);
}
if (!force && !auto && !existsSync(MARKER) === false) {
  /* fall through */
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
  if (typeof raw.totalStakeIn === "number") raw.totalStakeIn = scale(raw.totalStakeIn);
  if (typeof raw.totalPayoutOut === "number") {
    raw.totalPayoutOut = scale(raw.totalPayoutOut);
  }
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
