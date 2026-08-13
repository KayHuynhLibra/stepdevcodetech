import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import {
  CULTIVATION_RANKS,
  isCultivationRank,
  type CultivationRank,
} from "./cultivationRanks.js";
import { ITEM_XU_MAX } from "./types.js";

export interface CouponDef {
  code: string;
  amount: number;
  /** Ẩn với user — chỉ admin biết mã */
  secret: boolean;
  label: string;
  enabled: boolean;
  /**
   * Legacy: mỗi user 1 lần.
   * Đồng bộ từ usesPerUser === 1 khi lưu; vẫn đọc khi migrate file cũ.
   */
  oncePerUser: boolean;
  /**
   * Số lần mỗi user được đổi mã này.
   * 0 = không giới hạn theo user · 1 = như oncePerUser.
   */
  usesPerUser: number;
  /** 0 = không giới hạn tổng lượt đổi toàn hệ thống */
  maxUses: number;
  /**
   * Flag Tu tiên hệ — chỉ user có cảnh giới Trúc Cơ → Độ Kiếp mới dùng được.
   * (Luyện Khí / chưa có cảnh giới → chặn.)
   */
  cultivationOnly: boolean;
  /**
   * Hết hạn sau thời điểm này (ms epoch, cuối ngày đã chọn).
   * 0 / null = không giới hạn thời gian.
   */
  expiresAt: number;
}

export interface CouponRedeem {
  id: string;
  at: number;
  code: string;
  userId: string;
  username: string;
  amount: number;
}

/** Tổng hợp bền theo user / mã — không mất khi cắt log gần đây. */
export interface CouponUserUse {
  userId: string;
  username: string;
  redeemCount: number;
  totalAmount: number;
  lastAt: number;
}

interface CouponsFile {
  version: 1;
  coupons: CouponDef[];
  redemptions: CouponRedeem[];
  /** key = coupon code lower-case → list users */
  userUses?: Record<string, CouponUserUse[]>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "coupons.json");
const TMP = join(DATA_DIR, "coupons.json.tmp");
/** Log chi tiết gần đây (vẫn cắt); tổng theo user nằm ở userUses. */
const REDEEM_CAP = 5_000;
const MAX_USES_CAP = 10_000_000;
const USES_PER_USER_CAP = 10_000;

/** Index Trúc Cơ trong CULTIVATION_RANKS — Luyện Khí = 0 bị loại. */
const TRUC_CO_INDEX = CULTIVATION_RANKS.indexOf("truc_co");

const IS_PROD = process.env.NODE_ENV === "production";

function clampMaxUses(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(MAX_USES_CAP, v);
}

function clampUsesPerUser(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(USES_PER_USER_CAP, v);
}

/** Parse expiresAt: 0 = không hạn · số ms · hoặc YYYY-MM-DD (cuối ngày UTC+7 gần đúng bằng local parse). */
export function normalizeExpiresAt(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "" || raw === false) return 0;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    const [y, m, d] = raw.trim().split("-").map(Number);
    if (!y || !m || !d) return 0;
    // Cuối ngày theo giờ máy chủ (Railway UTC) — admin nên chọn ngày kết thúc rõ.
    return Date.UTC(y, m - 1, d, 16, 59, 59, 999); // 23:59:59 VN (UTC+7)
  }
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

export function couponIsExpired(coupon: { expiresAt?: number | null }): boolean {
  const t = Number(coupon.expiresAt) || 0;
  return t > 0 && Date.now() > t;
}

/** Cảnh giới đủ điều kiện coupon Tu tiên hệ: Trúc Cơ … Độ Kiếp. */
export function cultivationRankAllowsCoupon(
  rank: unknown,
): rank is CultivationRank {
  if (!isCultivationRank(rank)) return false;
  return CULTIVATION_RANKS.indexOf(rank) >= TRUC_CO_INDEX;
}

function normalizeCoupon(raw: unknown): CouponDef | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<CouponDef> & { usesPerUser?: unknown };
  const code = String(c.code ?? "").trim();
  if (!code) return null;
  const amount = Math.floor(Number(c.amount));
  if (!Number.isFinite(amount) || amount < 10) return null;

  let usesPerUser: number;
  if (c.usesPerUser !== undefined && c.usesPerUser !== null) {
    usesPerUser = clampUsesPerUser(c.usesPerUser);
  } else if (c.oncePerUser) {
    usesPerUser = 1;
  } else {
    usesPerUser = 0;
  }

  return {
    code,
    amount: Math.min(ITEM_XU_MAX, amount),
    secret: c.secret !== false,
    label: String(c.label ?? "").trim().slice(0, 80) || `Nạp ${amount} xu`,
    enabled: c.enabled !== false,
    usesPerUser,
    oncePerUser: usesPerUser === 1,
    maxUses: clampMaxUses(c.maxUses ?? 0),
    cultivationOnly: !!c.cultivationOnly,
    expiresAt: normalizeExpiresAt(c.expiresAt),
  };
}

function buildSeedCoupons(): CouponDef[] {
  const seeds: CouponDef[] = [];
  const tvCode =
    process.env.SEED_COUPON_TRUEVIBE?.trim() ||
    (IS_PROD ? "" : "TrueVibe");
  if (tvCode) {
    seeds.push({
      code: tvCode,
      amount: Number(process.env.SEED_COUPON_TRUEVIBE_AMOUNT) || 50_000,
      secret: true,
      label: "Cộng xu ảo — không giới hạn",
      enabled: true,
      oncePerUser: false,
      usesPerUser: 0,
      maxUses: 0,
      cultivationOnly: false,
      expiresAt: 0,
    });
  }
  if (!IS_PROD) {
    seeds.push(
      {
        code: "SangNhung",
        amount: 100_000,
        secret: true,
        label: "Nạp cố định 100.000 xu",
        enabled: true,
        oncePerUser: true,
        usesPerUser: 1,
        maxUses: 0,
        cultivationOnly: false,
        expiresAt: 0,
      },
      {
        code: "TEPTHEMSOFIA",
        amount: 200_000,
        secret: true,
        label: "Nạp 200.000 xu — dùng nhiều lần",
        enabled: true,
        oncePerUser: false,
        usesPerUser: 0,
        maxUses: 0,
        cultivationOnly: false,
        expiresAt: 0,
      },
    );
  }
  return seeds;
}

export class CouponStore {
  private coupons: CouponDef[] = [];
  private redemptions: CouponRedeem[] = [];
  /** codeLower → userId → stats */
  private userUses = new Map<string, Map<string, CouponUserUse>>();

  constructor() {
    this.load();
    this.ensureSeed();
    this.ensureUserUsesFromRedemptions();
    this.save();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as CouponsFile;
      if (parsed?.version !== 1) return;
      if (Array.isArray(parsed.coupons)) {
        this.coupons = parsed.coupons
          .map(normalizeCoupon)
          .filter((x): x is CouponDef => !!x);
      }
      if (Array.isArray(parsed.redemptions)) {
        this.redemptions = parsed.redemptions.slice(0, REDEEM_CAP);
      }
      if (parsed.userUses && typeof parsed.userUses === "object") {
        for (const [codeKey, rows] of Object.entries(parsed.userUses)) {
          if (!Array.isArray(rows)) continue;
          const map = new Map<string, CouponUserUse>();
          for (const row of rows) {
            if (!row?.userId) continue;
            map.set(String(row.userId), {
              userId: String(row.userId),
              username: String(row.username ?? "").slice(0, 40),
              redeemCount: Math.max(0, Math.floor(Number(row.redeemCount) || 0)),
              totalAmount: Math.max(0, Math.floor(Number(row.totalAmount) || 0)),
              lastAt: Math.max(0, Math.floor(Number(row.lastAt) || 0)),
            });
          }
          this.userUses.set(codeKey.toLowerCase(), map);
        }
      }
      console.log(
        `[coupon] Loaded ${this.coupons.length} coupons · ${this.redemptions.length} redemptions · ${this.userUses.size} mã có userUses`,
      );
    } catch (err) {
      console.warn("[coupon] Failed to load coupons.json:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const userUses: Record<string, CouponUserUse[]> = {};
      for (const [codeKey, map] of this.userUses) {
        userUses[codeKey] = [...map.values()].sort(
          (a, b) => b.lastAt - a.lastAt || b.redeemCount - a.redeemCount,
        );
      }
      const payload: CouponsFile = {
        version: 1,
        coupons: this.coupons,
        redemptions: this.redemptions.slice(0, REDEEM_CAP),
        userUses,
      };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[coupon] Failed to save coupons.json:", err);
    }
  }

  /** Bổ sung / đồng bộ userUses từ log nếu thiếu (migrate file cũ). */
  private ensureUserUsesFromRedemptions() {
    for (const r of this.redemptions) {
      const codeKey = r.code.toLowerCase();
      let map = this.userUses.get(codeKey);
      if (!map) {
        map = new Map();
        this.userUses.set(codeKey, map);
      }
      const cur = map.get(r.userId);
      if (!cur) {
        map.set(r.userId, {
          userId: r.userId,
          username: r.username,
          redeemCount: 1,
          totalAmount: r.amount,
          lastAt: r.at,
        });
      } else {
        // Chỉ tăng nếu log cho thấy nhiều hơn (tránh double-count khi đã có persisted)
        // Cách an toàn: rebuild count từ redemptions cho user này nếu persisted count < scan
        /* handled below via full rebuild if map was empty for this code */
      }
    }
    // Rebuild chính xác từ toàn bộ redemptions còn giữ — merge max với persisted
    const scanned = new Map<string, Map<string, CouponUserUse>>();
    for (const r of this.redemptions) {
      const codeKey = r.code.toLowerCase();
      let map = scanned.get(codeKey);
      if (!map) {
        map = new Map();
        scanned.set(codeKey, map);
      }
      const cur = map.get(r.userId);
      if (!cur) {
        map.set(r.userId, {
          userId: r.userId,
          username: r.username,
          redeemCount: 1,
          totalAmount: r.amount,
          lastAt: r.at,
        });
      } else {
        cur.redeemCount += 1;
        cur.totalAmount += r.amount;
        if (r.at > cur.lastAt) {
          cur.lastAt = r.at;
          cur.username = r.username;
        }
      }
    }
    for (const [codeKey, scanMap] of scanned) {
      let map = this.userUses.get(codeKey);
      if (!map) {
        this.userUses.set(codeKey, scanMap);
        continue;
      }
      for (const [uid, s] of scanMap) {
        const p = map.get(uid);
        if (!p) {
          map.set(uid, s);
        } else {
          // Giữ số lớn hơn (persisted có thể đã vượt log đã cắt)
          if (s.redeemCount > p.redeemCount) {
            p.redeemCount = s.redeemCount;
            p.totalAmount = Math.max(p.totalAmount, s.totalAmount);
          }
          if (s.lastAt > p.lastAt) {
            p.lastAt = s.lastAt;
            p.username = s.username;
          }
          if (s.username) p.username = s.username || p.username;
        }
      }
    }
  }

  private bumpUserUse(
    code: string,
    userId: string,
    username: string,
    amount: number,
    at: number,
  ) {
    const codeKey = code.toLowerCase();
    let map = this.userUses.get(codeKey);
    if (!map) {
      map = new Map();
      this.userUses.set(codeKey, map);
    }
    const cur = map.get(userId);
    if (!cur) {
      map.set(userId, {
        userId,
        username: username.slice(0, 40),
        redeemCount: 1,
        totalAmount: amount,
        lastAt: at,
      });
    } else {
      cur.redeemCount += 1;
      cur.totalAmount += amount;
      cur.lastAt = at;
      cur.username = username.slice(0, 40) || cur.username;
    }
  }

  private ensureSeed() {
    for (const seed of buildSeedCoupons()) {
      const key = seed.code.toLowerCase();
      const idx = this.coupons.findIndex((c) => c.code.toLowerCase() === key);
      if (idx < 0) this.coupons.push({ ...seed });
    }
  }

  private find(code: string): CouponDef | undefined {
    const key = code.trim().toLowerCase();
    return this.coupons.find((c) => c.code.toLowerCase() === key);
  }

  private redeemCountFor(code: string): number {
    const key = code.trim().toLowerCase();
    const map = this.userUses.get(key);
    if (map && map.size > 0) {
      let n = 0;
      for (const u of map.values()) n += u.redeemCount;
      return n;
    }
    return this.redemptions.filter((r) => r.code.toLowerCase() === key).length;
  }

  redeemCountForUser(userId: string, code: string): number {
    const key = code.trim().toLowerCase();
    const persisted = this.userUses.get(key)?.get(userId);
    if (persisted) return persisted.redeemCount;
    return this.redemptions.filter(
      (r) => r.userId === userId && r.code.toLowerCase() === key,
    ).length;
  }

  hasRedeemed(userId: string, code: string): boolean {
    return this.redeemCountForUser(userId, code) > 0;
  }

  /** Danh sách user đã xài 1 mã (tổng lần / xu) — bền, không cắt 30. */
  usersForCode(code: string): CouponUserUse[] {
    const key = String(code ?? "").trim().toLowerCase();
    const map = this.userUses.get(key);
    if (!map) return [];
    return [...map.values()].sort(
      (a, b) => b.redeemCount - a.redeemCount || b.lastAt - a.lastAt,
    );
  }

  /** Kiểm tra mã (chưa ghi nhận). Không lộ danh sách coupon. */
  previewRedeem(
    code: string,
    userId: string,
    opts?: { cultivationRank?: CultivationRank | string | null },
  ):
    | { ok: true; amount: number; code: string }
    | { ok: false; reason: string } {
    const raw = code.trim();
    if (!raw) return { ok: false, reason: "Nhập mã cộng xu ảo" };

    const coupon = this.find(raw);
    if (!coupon || !coupon.enabled) {
      return { ok: false, reason: "Mã không hợp lệ hoặc đã hết hạn" };
    }
    if (couponIsExpired(coupon)) {
      return { ok: false, reason: "Mã đã hết hạn sử dụng" };
    }
    if (coupon.cultivationOnly) {
      if (!cultivationRankAllowsCoupon(opts?.cultivationRank)) {
        return {
          ok: false,
          reason: "Mã Tu tiên hệ — cần cảnh giới Trúc Cơ đến Độ Kiếp",
        };
      }
    }
    const perUser = coupon.usesPerUser > 0
      ? coupon.usesPerUser
      : coupon.oncePerUser
        ? 1
        : 0;
    if (perUser > 0) {
      const used = this.redeemCountForUser(userId, coupon.code);
      if (used >= perUser) {
        return {
          ok: false,
          reason:
            perUser === 1
              ? "Bạn đã dùng mã này rồi"
              : `Bạn đã dùng hết lượt mã này (${used}/${perUser})`,
        };
      }
    }
    if (coupon.maxUses > 0 && this.redeemCountFor(coupon.code) >= coupon.maxUses) {
      return { ok: false, reason: "Mã đã hết lượt" };
    }
    return { ok: true, amount: coupon.amount, code: coupon.code };
  }

  /** Ghi nhận sau khi đã cộng xu thành công. */
  commitRedeem(
    code: string,
    amount: number,
    userId: string,
    username: string,
  ) {
    const at = Date.now();
    this.redemptions.unshift({
      id: randomBytes(6).toString("hex"),
      at,
      code,
      userId,
      username,
      amount,
    });
    if (this.redemptions.length > REDEEM_CAP) {
      this.redemptions.length = REDEEM_CAP;
    }
    this.bumpUserUse(code, userId, username, amount, at);
    this.save();
  }

  /** Admin xem đầy đủ + tổng hợp theo user (bền) + vài dòng log gần đây. */
  listForAdmin(recentLimit = 12) {
    const lim = Math.min(40, Math.max(1, Math.floor(recentLimit) || 12));
    return this.coupons.map((c) => {
      const used = this.redeemCountFor(c.code);
      const key = c.code.toLowerCase();
      const byUser = this.usersForCode(c.code);
      const recentRedemptions = this.redemptions
        .filter((r) => r.code.toLowerCase() === key)
        .slice(0, lim);
      return {
        ...c,
        redeemCount: used,
        byUser,
        userCount: byUser.length,
        recentRedemptions,
      };
    });
  }

  /** Lịch sử đổi theo 1 mã (admin). */
  redemptionsForCode(code: string, limit = 50): CouponRedeem[] {
    const key = String(code ?? "").trim().toLowerCase();
    if (!key) return [];
    const lim = Math.min(200, Math.max(1, Math.floor(limit) || 50));
    return this.redemptions
      .filter((r) => r.code.toLowerCase() === key)
      .slice(0, lim);
  }

  recentRedemptions(limit = 40): CouponRedeem[] {
    return this.redemptions.slice(0, Math.min(limit, 100));
  }

  /** Tổng xu / lượt coupon (từ userUses bền). */
  getXuSummary(): {
    totalXu: number;
    redeemCount: number;
    userCount: number;
    couponCount: number;
    enabledCount: number;
  } {
    let totalXu = 0;
    let redeemCount = 0;
    const users = new Set<string>();
    for (const map of this.userUses.values()) {
      for (const u of map.values()) {
        totalXu += u.totalAmount;
        redeemCount += u.redeemCount;
        users.add(u.userId);
      }
    }
    return {
      totalXu,
      redeemCount,
      userCount: users.size,
      couponCount: this.coupons.length,
      enabledCount: this.coupons.filter((c) => c.enabled).length,
    };
  }

  /** Tổng xu đã nạp theo user (public — không lộ mã coupon). */
  topDepositors(limit = 50): {
    userId: string;
    username: string;
    totalAmount: number;
    redeemCount: number;
    lastAt: number;
  }[] {
    const map = new Map<
      string,
      {
        userId: string;
        username: string;
        totalAmount: number;
        redeemCount: number;
        lastAt: number;
      }
    >();
    for (const r of this.redemptions) {
      const cur = map.get(r.userId);
      if (!cur) {
        map.set(r.userId, {
          userId: r.userId,
          username: r.username,
          totalAmount: r.amount,
          redeemCount: 1,
          lastAt: r.at,
        });
      } else {
        cur.totalAmount += r.amount;
        cur.redeemCount += 1;
        if (r.at > cur.lastAt) {
          cur.lastAt = r.at;
          cur.username = r.username;
        }
      }
    }
    return [...map.values()]
      .sort((a, b) => b.totalAmount - a.totalAmount || b.lastAt - a.lastAt)
      .slice(0, Math.min(limit, 100));
  }

  upsert(input: {
    code: string;
    amount: number;
    label?: string;
    enabled?: boolean;
    oncePerUser?: boolean;
    usesPerUser?: number;
    secret?: boolean;
    maxUses?: number;
    cultivationOnly?: boolean;
    /** number ms · YYYY-MM-DD · "" / null để xóa hạn */
    expiresAt?: unknown;
    clearExpiresAt?: boolean;
  }): { ok: true; coupon: CouponDef } | { ok: false; reason: string } {
    const code = String(input.code ?? "").trim();
    if (code.length < 3 || code.length > 32) {
      return { ok: false, reason: "Mã 3–32 ký tự" };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return { ok: false, reason: "Mã chỉ gồm chữ, số, _ hoặc -" };
    }
    const amount = Math.floor(Number(input.amount));
    if (!Number.isFinite(amount) || amount < 10 || amount > ITEM_XU_MAX) {
      return {
        ok: false,
        reason: `Số xu 10 – ${ITEM_XU_MAX.toLocaleString("vi-VN")}`,
      };
    }
    const maxUses =
      input.maxUses !== undefined ? clampMaxUses(input.maxUses) : undefined;
    if (
      input.maxUses !== undefined &&
      (!Number.isFinite(Number(input.maxUses)) ||
        Math.floor(Number(input.maxUses)) < 0 ||
        Math.floor(Number(input.maxUses)) > MAX_USES_CAP)
    ) {
      return {
        ok: false,
        reason: `Giới hạn lượt 0 – ${MAX_USES_CAP.toLocaleString("vi-VN")} (0 = không giới hạn)`,
      };
    }

    let usesPerUser: number | undefined;
    if (input.usesPerUser !== undefined && input.usesPerUser !== null) {
      if (
        !Number.isFinite(Number(input.usesPerUser)) ||
        Math.floor(Number(input.usesPerUser)) < 0 ||
        Math.floor(Number(input.usesPerUser)) > USES_PER_USER_CAP
      ) {
        return {
          ok: false,
          reason: `Lượt / user 0 – ${USES_PER_USER_CAP.toLocaleString("vi-VN")} (0 = không giới hạn)`,
        };
      }
      usesPerUser = clampUsesPerUser(input.usesPerUser);
    } else if (typeof input.oncePerUser === "boolean") {
      usesPerUser = input.oncePerUser ? 1 : 0;
    }

    let expiresAtPatch: number | undefined;
    if (input.clearExpiresAt === true) {
      expiresAtPatch = 0;
    } else if (input.expiresAt !== undefined) {
      expiresAtPatch = normalizeExpiresAt(input.expiresAt);
      if (
        input.expiresAt !== null &&
        input.expiresAt !== "" &&
        expiresAtPatch === 0 &&
        String(input.expiresAt).trim() !== "" &&
        Number(input.expiresAt) !== 0
      ) {
        return { ok: false, reason: "Ngày hết hạn không hợp lệ (YYYY-MM-DD)" };
      }
    }

    const key = code.toLowerCase();
    const existing = this.coupons.find((c) => c.code.toLowerCase() === key);
    if (existing) {
      existing.amount = amount;
      if (typeof input.label === "string") {
        existing.label = input.label.trim().slice(0, 80) || existing.label;
      }
      if (typeof input.enabled === "boolean") existing.enabled = input.enabled;
      if (typeof input.secret === "boolean") existing.secret = input.secret;
      if (maxUses !== undefined) existing.maxUses = maxUses;
      if (usesPerUser !== undefined) {
        existing.usesPerUser = usesPerUser;
        existing.oncePerUser = usesPerUser === 1;
      }
      if (typeof input.cultivationOnly === "boolean") {
        existing.cultivationOnly = input.cultivationOnly;
      }
      if (expiresAtPatch !== undefined) existing.expiresAt = expiresAtPatch;
      this.save();
      return { ok: true, coupon: { ...existing } };
    }
    const perUser = usesPerUser ?? 0;
    const coupon: CouponDef = {
      code,
      amount,
      secret: input.secret !== false,
      label: (input.label ?? "").trim().slice(0, 80) || `Nạp ${amount} xu`,
      enabled: input.enabled !== false,
      usesPerUser: perUser,
      oncePerUser: perUser === 1,
      maxUses: maxUses ?? 0,
      cultivationOnly: !!input.cultivationOnly,
      expiresAt: expiresAtPatch ?? 0,
    };
    this.coupons.push(coupon);
    this.save();
    return { ok: true, coupon: { ...coupon } };
  }

  setEnabled(
    code: string,
    enabled: boolean,
  ): { ok: true; coupon: CouponDef } | { ok: false; reason: string } {
    const coupon = this.find(code);
    if (!coupon) return { ok: false, reason: "Không tìm thấy mã" };
    coupon.enabled = !!enabled;
    this.save();
    return { ok: true, coupon: { ...coupon } };
  }
}

export const couponStore = new CouponStore();
