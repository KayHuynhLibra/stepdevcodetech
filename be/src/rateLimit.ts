import type { NextFunction, Request, Response } from "express";

/** Simple sliding-window rate limit (in-memory, single Node). */
const rateBuckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + windowMs };
    rateBuckets.set(key, b);
  }
  b.n += 1;
  return b.n <= max;
}

/** Drop expired buckets — tránh Map phình khi bị flood nhiều key. */
export function pruneRateBuckets(now = Date.now()): number {
  let removed = 0;
  for (const [k, b] of rateBuckets) {
    if (now > b.reset) {
      rateBuckets.delete(k);
      removed += 1;
    }
  }
  return removed;
}

let pruneTimer: ReturnType<typeof setInterval> | null = null;

export function startRateLimitPrune(intervalMs = 60_000) {
  if (pruneTimer) return;
  pruneTimer = setInterval(() => {
    pruneRateBuckets();
  }, intervalMs);
  if (typeof pruneTimer === "object" && "unref" in pruneTimer) {
    pruneTimer.unref();
  }
}

export function clientIp(req: Request): string {
  // Với app.set("trust proxy", …) Express đã resolve IP đúng (không tin XFF thô).
  const fromExpress = typeof req.ip === "string" ? req.ip.trim() : "";
  if (fromExpress) {
    return fromExpress.replace(/^::ffff:/i, "") || "unknown";
  }
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) {
    // Fallback khi chưa bật trust proxy — lấy IP đầu chuỗi (client gần nhất theo proxy chuẩn).
    return xf.split(",")[0]!.trim().replace(/^::ffff:/i, "") || "unknown";
  }
  return (req.socket.remoteAddress || "unknown").replace(/^::ffff:/i, "");
}

export function socketIp(socket: {
  handshake: { address?: string; headers: Record<string, unknown> };
}): string {
  const xf = socket.handshake.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) {
    return xf.split(",")[0]!.trim().replace(/^::ffff:/i, "") || "unknown";
  }
  return (socket.handshake.address || "unknown").replace(/^::ffff:/i, "");
}

/** Global HTTP — whitelist /health để Railway probe không bị chặn. */
export function globalHttpRateLimit(opts?: {
  max?: number;
  windowMs?: number;
  skipPaths?: string[];
  /** Prefixes skipped (e.g. /api/auth/ so login still works when polls flood the bucket). */
  skipPrefixes?: string[];
  /** GET-only prefixes skipped (poll loops: Ludo room state, …). */
  skipGetPrefixes?: string[];
}) {
  const max = opts?.max ?? 160;
  const windowMs = opts?.windowMs ?? 60_000;
  const skip = new Set(opts?.skipPaths ?? ["/health"]);
  const skipPrefixes = opts?.skipPrefixes ?? [];
  const skipGetPrefixes = opts?.skipGetPrefixes ?? [];
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || "/";
    if (skip.has(path)) return next();
    if (
      skipPrefixes.some(
        (p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`),
      )
    ) {
      return next();
    }
    if (
      req.method === "GET" &&
      skipGetPrefixes.some(
        (p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`),
      )
    ) {
      return next();
    }
    const ip = clientIp(req);
    if (!rateLimit(`http:${ip}`, max, windowMs)) {
      return res.status(429).json({
        ok: false,
        reason: "Quá nhiều yêu cầu — đợi ~1 phút rồi thử lại",
      });
    }
    next();
  };
}

/** Đếm socket đang mở theo IP (chống connect flood). */
const socketsByIp = new Map<string, Set<string>>();

export function trackSocketConnect(
  ip: string,
  socketId: string,
  maxPerIp: number,
): { ok: true } | { ok: false; reason: string } {
  let set = socketsByIp.get(ip);
  if (!set) {
    set = new Set();
    socketsByIp.set(ip, set);
  }
  if (set.size >= maxPerIp && !set.has(socketId)) {
    return { ok: false, reason: "Quá nhiều kết nối từ IP này" };
  }
  set.add(socketId);
  return { ok: true };
}

export function trackSocketDisconnect(ip: string, socketId: string) {
  const set = socketsByIp.get(ip);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) socketsByIp.delete(ip);
}

export function rateBucketStats() {
  return {
    bucketCount: rateBuckets.size,
    ipSocketGroups: socketsByIp.size,
  };
}
