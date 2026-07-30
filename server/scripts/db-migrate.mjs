#!/usr/bin/env node
/**
 * Apply server/src/db/schema.sql when DATABASE_URL is set.
 * Usage: npm run db:migrate
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "..", "src", "db", "schema.sql");
const url = String(process.env.DATABASE_URL ?? "").trim();

if (!url) {
  console.log("[db:migrate] DATABASE_URL unset — skip (JSON mode).");
  process.exit(0);
}

if (!existsSync(schemaPath)) {
  console.error("[db:migrate] missing schema.sql");
  process.exit(1);
}

const sql = readFileSync(schemaPath, "utf8");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  await pool.query(
    `INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING`,
    ["001_core_100x"],
  );
  console.log("[db:migrate] applied 001_core_100x");
} catch (e) {
  console.error("[db:migrate] failed:", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
