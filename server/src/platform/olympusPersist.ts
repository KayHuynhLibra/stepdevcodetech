/**
 * Thin persist for Olympus — memory + optional JSON jackpot.
 * No Postgres/Redis/MinIO required (pocketcursor stubs).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const JP_PATH = join(DATA_DIR, "olympus-jackpot.json");
const JP_TMP = join(DATA_DIR, "olympus-jackpot.json.tmp");

const mem = new Map<string, string>();

export function dbReady(): boolean {
  return false;
}

export function kvReady(): boolean {
  return true;
}

export async function query(_sql: string, _params?: unknown[]): Promise<unknown> {
  return { rows: [] };
}

export async function appendLedger(_row: unknown): Promise<void> {
  /* no-op */
}

export async function upsertUserMirror(_row: unknown): Promise<void> {
  /* no-op */
}

export async function getKv(key: string): Promise<string | null> {
  if (key === "olympus:jackpot") {
    try {
      if (existsSync(JP_PATH)) {
        const raw = JSON.parse(readFileSync(JP_PATH, "utf8")) as {
          pool?: number;
        };
        if (typeof raw.pool === "number") return String(Math.round(raw.pool));
      }
    } catch {
      /* ignore */
    }
  }
  return mem.has(key) ? mem.get(key)! : null;
}

export async function setKv(
  key: string,
  value: string,
  _ttlSec?: number,
): Promise<void> {
  mem.set(key, value);
  if (key === "olympus:jackpot") {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(
        JP_TMP,
        JSON.stringify({ pool: Number(value) || 0, at: Date.now() }, null, 2),
        "utf8",
      );
      renameSync(JP_TMP, JP_PATH);
    } catch (err) {
      console.warn("[olympus] jackpot save failed:", err);
    }
  }
}

export function loadPlatformConfig() {
  return {
    minioEndpoint: "",
    livekitUrl: "",
  };
}

/** No-op — rateLimit.ts does not export clearRateBuckets. */
export function clearRateBuckets(_prefix?: string): number {
  return 0;
}
