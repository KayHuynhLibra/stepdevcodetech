/**
 * Điểm rủi ro chống gian (0–100) từ IP / device / coupon velocity.
 * Không chặn cứng mặc định — soft-gate coupon khi admin bật.
 */
import { couponStore } from "./couponStore.js";
import { deviceStore } from "./deviceStore.js";
import { guestIpStore } from "./guestIpStore.js";

export type RiskFactor = {
  key: string;
  label: string;
  points: number;
};

export type RiskScoreResult = {
  userId: string;
  username?: string;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
};

function levelOf(score: number): RiskScoreResult["level"] {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Đếm user cùng IP với userId (từ guestIpStore admin rows). */
function sharedIpUserCount(userId: string): { count: number; ips: string[] } {
  const ips: string[] = [];
  let maxUsers = 0;
  for (const row of guestIpStore.listForAdmin()) {
    const hit = row.userIds?.includes(userId) || row.seenUsers?.some((s) => s.userId === userId);
    if (!hit) continue;
    ips.push(row.ip);
    const n = Math.max(row.userIds?.length ?? 0, row.seenUsers?.length ?? 0);
    if (n > maxUsers) maxUsers = n;
  }
  return { count: maxUsers, ips: ips.slice(0, 8) };
}

function sharedDeviceUserCount(userId: string): { count: number; devices: number } {
  let maxUsers = 0;
  let devices = 0;
  for (const row of deviceStore.listForAdmin(500)) {
    const hit = row.seenUsers?.some((s) => s.userId === userId);
    if (!hit) continue;
    devices += 1;
    const n = row.seenUsers?.length ?? 0;
    if (n > maxUsers) maxUsers = n;
  }
  return { count: maxUsers, devices };
}

function couponVelocity(userId: string): {
  redeemCount: number;
  totalXu: number;
  codes: number;
  recent1h: number;
} {
  const recent1hCut = Date.now() - 60 * 60 * 1000;
  let redeemCount = 0;
  let totalXu = 0;
  let codes = 0;
  let recent1h = 0;
  const seen = new Set<string>();
  for (const c of couponStore.listForAdmin(8)) {
    for (const u of c.byUser ?? []) {
      if (u.userId !== userId) continue;
      redeemCount += u.redeemCount ?? 0;
      totalXu += u.totalAmount ?? 0;
      if (!seen.has(c.code)) {
        seen.add(c.code);
        codes += 1;
      }
    }
    for (const r of c.recentRedemptions ?? []) {
      if (r.userId === userId && r.at >= recent1hCut) recent1h += 1;
    }
  }
  // Fallback recent from global log
  if (recent1h === 0) {
    for (const r of couponStore.recentRedemptions(80)) {
      if (r.userId === userId && r.at >= recent1hCut) recent1h += 1;
    }
  }
  return { redeemCount, totalXu, codes, recent1h };
}

export function scoreUserRisk(
  userId: string,
  username?: string,
): RiskScoreResult {
  const factors: RiskFactor[] = [];
  let score = 0;

  const ip = sharedIpUserCount(userId);
  if (ip.count >= 5) {
    factors.push({
      key: "ip_crowd",
      label: `IP dùng chung ≥${ip.count} tài khoản`,
      points: 35,
    });
    score += 35;
  } else if (ip.count >= 3) {
    factors.push({
      key: "ip_multi",
      label: `IP dùng chung ${ip.count} tài khoản`,
      points: 22,
    });
    score += 22;
  } else if (ip.count === 2) {
    factors.push({
      key: "ip_pair",
      label: "IP có 2 tài khoản",
      points: 10,
    });
    score += 10;
  }

  const dev = sharedDeviceUserCount(userId);
  if (dev.count >= 4) {
    factors.push({
      key: "device_crowd",
      label: `Thiết bị gắn ≥${dev.count} tài khoản`,
      points: 30,
    });
    score += 30;
  } else if (dev.count >= 2) {
    factors.push({
      key: "device_multi",
      label: `Thiết bị gắn ${dev.count} tài khoản`,
      points: 18,
    });
    score += 18;
  }
  if (dev.devices >= 4) {
    factors.push({
      key: "many_devices",
      label: `${dev.devices} thiết bị đã đăng nhập`,
      points: 12,
    });
    score += 12;
  }

  const coup = couponVelocity(userId);
  if (coup.recent1h >= 4) {
    factors.push({
      key: "coupon_burst",
      label: `${coup.recent1h} lần đổi mã trong 1h`,
      points: 28,
    });
    score += 28;
  } else if (coup.recent1h >= 2) {
    factors.push({
      key: "coupon_fast",
      label: `${coup.recent1h} lần đổi mã trong 1h`,
      points: 14,
    });
    score += 14;
  }
  if (coup.codes >= 5) {
    factors.push({
      key: "coupon_many_codes",
      label: `Đã dùng ${coup.codes} mã khác nhau`,
      points: 16,
    });
    score += 16;
  } else if (coup.codes >= 3) {
    factors.push({
      key: "coupon_codes",
      label: `Đã dùng ${coup.codes} mã`,
      points: 8,
    });
    score += 8;
  }
  if (coup.totalXu >= 500_000) {
    factors.push({
      key: "coupon_xu",
      label: `Tổng coupon ≥${coup.totalXu.toLocaleString("vi-VN")} xu`,
      points: 12,
    });
    score += 12;
  }

  const final = clampScore(score);
  return {
    userId,
    username,
    score: final,
    level: levelOf(final),
    factors,
  };
}

/** Top users theo điểm rủi ro (quét từ IP/device/coupon gần đây). */
export function listTopRiskUsers(limit = 40): RiskScoreResult[] {
  const ids = new Map<string, string>();
  for (const row of guestIpStore.listForAdmin()) {
    for (const s of row.seenUsers ?? []) {
      if (s.userId) ids.set(s.userId, s.username || ids.get(s.userId) || "");
    }
  }
  for (const row of deviceStore.listForAdmin(400)) {
    for (const s of row.seenUsers ?? []) {
      if (s.userId) ids.set(s.userId, s.username || ids.get(s.userId) || "");
    }
  }
  for (const r of couponStore.recentRedemptions(120)) {
    if (r.userId) ids.set(r.userId, r.username || ids.get(r.userId) || "");
  }

  const scored: RiskScoreResult[] = [];
  for (const [userId, username] of ids) {
    const r = scoreUserRisk(userId, username);
    if (r.score <= 0) continue;
    scored.push(r);
  }
  scored.sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
  const lim = Math.min(100, Math.max(1, Math.floor(limit) || 40));
  return scored.slice(0, lim);
}

export function softGateCouponReason(
  userId: string,
  amount: number,
  opts: { enabled: boolean; minScore: number; cultivationOnly?: boolean },
): string | null {
  if (!opts.enabled) return null;
  const risk = scoreUserRisk(userId);
  if (risk.score < opts.minScore) return null;
  // Gate: mã lớn hoặc mã tu tiên khi risk cao
  const large = amount >= 50_000;
  if (!large && !opts.cultivationOnly) {
    if (risk.score < opts.minScore + 15) return null;
  }
  const top = risk.factors
    .slice(0, 2)
    .map((f) => f.label)
    .join("; ");
  return (
    `Tạm khóa mã (điểm rủi ro ${risk.score}/100` +
    (top ? ` — ${top}` : "") +
    "). Liên hệ admin nếu cần."
  );
}
