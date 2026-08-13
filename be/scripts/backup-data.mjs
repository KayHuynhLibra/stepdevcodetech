#!/usr/bin/env node
/**
 * Sao lưu server/data/*.json (+ uploads) vào server/data/backups/YYYYMMDD-HHMMSS/
 * Chạy: npm run backup:data
 * Railway: gắn cron hoặc chạy thủ công trước deploy rủi ro.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  statSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const BACKUPS_DIR = join(DATA_DIR, "backups");

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function copyJsonFiles(srcDir, destDir) {
  if (!existsSync(srcDir)) {
    console.error(`[backup] Missing data dir: ${srcDir}`);
    process.exit(1);
  }
  mkdirSync(destDir, { recursive: true });
  let n = 0;
  for (const name of readdirSync(srcDir)) {
    if (name === "backups") continue;
    const from = join(srcDir, name);
    const st = statSync(from);
    if (st.isFile() && name.endsWith(".json")) {
      copyFileSync(from, join(destDir, name));
      n += 1;
    }
  }
  return n;
}

const dest = join(BACKUPS_DIR, stamp());
const count = copyJsonFiles(DATA_DIR, dest);
console.log(`[backup] Copied ${count} JSON files → ${dest}`);
