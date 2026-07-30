import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let initAttempted = false;

export function databaseUrl(): string | null {
  const u = String(process.env.DATABASE_URL ?? "").trim();
  return u || null;
}

export function isDbEnabled(): boolean {
  return Boolean(databaseUrl());
}

export function getPool(): pg.Pool | null {
  if (!isDbEnabled()) return null;
  if (pool) return pool;
  if (initAttempted) return pool;
  initAttempted = true;
  try {
    pool = new Pool({
      connectionString: databaseUrl()!,
      max: Math.min(20, Math.max(2, Number(process.env.PG_POOL_MAX) || 8)),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl:
        process.env.PG_SSL === "0"
          ? undefined
          : process.env.DATABASE_URL?.includes("localhost")
            ? undefined
            : { rejectUnauthorized: false },
    });
    pool.on("error", (err) => {
      console.warn("[db] pool error:", err.message);
    });
  } catch (e) {
    console.warn("[db] failed to init pool:", e);
    pool = null;
  }
  return pool;
}

export async function dbQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T> | null> {
  const p = getPool();
  if (!p) return null;
  return p.query<T>(text, params);
}

export async function dbHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  reason?: string;
}> {
  if (!isDbEnabled()) {
    return { configured: false, ok: true, reason: "DATABASE_URL unset (JSON mode)" };
  }
  const p = getPool();
  if (!p) {
    return { configured: true, ok: false, reason: "pool init failed" };
  }
  const t0 = Date.now();
  try {
    await p.query("SELECT 1");
    return { configured: true, ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - t0,
      reason: e instanceof Error ? e.message : "query failed",
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
    initAttempted = false;
  }
}
