#!/usr/bin/env node
/**
 * Baseline metrics for 100x roadmap — sizes of server/data JSON.
 * Usage: node server/scripts/baseline-100x.mjs
 */
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
const outDir = join(__dirname, "..", "..", "studying");
const outFile = join(outDir, "100x-baseline-snapshot.json");

const rows = [];
let total = 0;
if (existsSync(dataDir)) {
  for (const name of readdirSync(dataDir)) {
    const p = join(dataDir, name);
    try {
      const st = statSync(p);
      if (!st.isFile()) continue;
      total += st.size;
      rows.push({ name, bytes: st.size, kb: Math.round((st.size / 1024) * 10) / 10 });
    } catch {
      /* skip */
    }
  }
}
rows.sort((a, b) => b.bytes - a.bytes);

const snap = {
  at: new Date().toISOString(),
  dataDir,
  fileCount: rows.length,
  totalBytes: total,
  totalKb: Math.round((total / 1024) * 10) / 10,
  top: rows.slice(0, 25),
  env: {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasRedisUrl: Boolean(process.env.REDIS_URL),
  },
};

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(snap, null, 2), "utf8");
console.log(JSON.stringify(snap, null, 2));
console.log(`\nWrote ${outFile}`);
