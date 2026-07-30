import { Redis as RedisClient } from "ioredis";

let client: RedisClient | null = null;
let initAttempted = false;
/** In-memory fallback locks / rate counters when Redis off. */
const memCounters = new Map<string, { n: number; resetAt: number }>();
const memLocks = new Map<string, number>();

export function redisUrl(): string | null {
  const u = String(process.env.REDIS_URL ?? "").trim();
  return u || null;
}

export function isRedisEnabled(): boolean {
  return Boolean(redisUrl());
}

export function getRedis(): RedisClient | null {
  if (!isRedisEnabled()) return null;
  if (client) return client;
  if (initAttempted) return client;
  initAttempted = true;
  try {
    client = new RedisClient(redisUrl()!, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on("error", (err: Error) => {
      console.warn("[redis] error:", err.message);
    });
    void client.connect().catch((e: unknown) => {
      console.warn(
        "[redis] connect failed:",
        e instanceof Error ? e.message : e,
      );
    });
  } catch (e) {
    console.warn("[redis] init failed:", e);
    client = null;
  }
  return client;
}

export async function redisHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  reason?: string;
}> {
  if (!isRedisEnabled()) {
    return { configured: false, ok: true, reason: "REDIS_URL unset (memory mode)" };
  }
  const r = getRedis();
  if (!r) {
    return { configured: true, ok: false, reason: "client init failed" };
  }
  const t0 = Date.now();
  try {
    if (r.status !== "ready") {
      await r.connect().catch(() => {});
    }
    const pong = await r.ping();
    return {
      configured: true,
      ok: pong === "PONG",
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - t0,
      reason: e instanceof Error ? e.message : "ping failed",
    };
  }
}

/** Sliding window counter — Redis INCR+EXPIRE or memory. */
export async function redisRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const r = getRedis();
  if (r) {
    try {
      const k = `rl:${key}`;
      const n = await r.incr(k);
      if (n === 1) await r.pexpire(k, windowMs);
      return n <= max;
    } catch {
      /* fall through */
    }
  }
  const now = Date.now();
  const cur = memCounters.get(key);
  if (!cur || cur.resetAt <= now) {
    memCounters.set(key, { n: 1, resetAt: now + windowMs });
    return true;
  }
  cur.n += 1;
  return cur.n <= max;
}

/** Short lock for settle — returns true if acquired. */
export async function redisTryLock(
  key: string,
  ttlMs: number,
): Promise<boolean> {
  const r = getRedis();
  if (r) {
    try {
      const ok = await r.set(`lock:${key}`, "1", "PX", ttlMs, "NX");
      return ok === "OK";
    } catch {
      /* fall through */
    }
  }
  const now = Date.now();
  const until = memLocks.get(key) ?? 0;
  if (until > now) return false;
  memLocks.set(key, now + ttlMs);
  return true;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
    initAttempted = false;
  }
}
