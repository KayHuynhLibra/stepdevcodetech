import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { ITEM_XU_MAX } from "./types.js";

export interface CouponDef {
  code: string;
  amount: number;
  /** Ẩn với user — chỉ admin biết mã */
  secret: boolean;
  label: string;
  enabled: boolean;
  /** Mỗi user chỉ đổi 1 lần */
  oncePerUser: boolean;
  /** 0 = không giới hạn tổng lượt đổi toàn hệ thống */
  maxUses: number;
}

export interface CouponRedeem {
  id: string;
  at: number;
  code: string;
  userId: string;
  username: string;
  amount: number;
}

interface CouponsFile {
  version: 1;
  coupons: CouponDef[];
  redemptions: CouponRedeem[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "coupons.json");
const TMP = join(DATA_DIR, "coupons.json.tmp");
const REDEEM_CAP = 500;
const MAX_USES_CAP = 10_000_000;

const IS_PROD = process.env.NODE_ENV === "production";

function clampMaxUses(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(MAX_USES_CAP, v);
}

function normalizeCoupon(raw: unknown): CouponDef | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<CouponDef>;
  const code = String(c.code ?? "").trim();
  if (!code) return null;
  const amount = Math.floor(Number(c.amount));
  if (!Number.isFinite(amount) || amount < 10) return null;
  return {
    code,
    amount: Math.min(ITEM_XU_MAX, amount),
    secret: c.secret !== false,
    label: String(c.label ?? "").trim().slice(0, 80) || `Nạp ${amount} xu`,
    enabled: c.enabled !== false,
    oncePerUser: !!c.oncePerUser,
    maxUses: clampMaxUses(c.maxUses ?? 0),
  };
}

function buildSeedCoupons(): CouponDef[] {
  const seeds: CouponDef[] = [];
  // Dev: seed cố định. Prod: chỉ thêm khi có env (không hardcode mã public).
  const tvCode =
    process.env.SEED_COUPON_TRUEVIBE?.trim() ||
    (IS_PROD ? "" : "TrueVibe");
  if (tvCode) {
    seeds.push({
      code: tvCode,
      amount: Number(process.env.SEED_COUPON_TRUEVIBE_AMOUNT) || 50_000,
      secret: true,
      label: "Nạp xu — không giới hạn",
      enabled: true,
      oncePerUser: false,
      maxUses: 0,
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
        maxUses: 0,
      },
      {
        code: "TEPTHEMSOFIA",
        amount: 200_000,
        secret: true,
        label: "Nạp 200.000 xu — dùng nhiều lần",
        enabled: true,
        oncePerUser: false,
        maxUses: 0,
      },
    );
  }
  return seeds;
}

export class CouponStore {
  private coupons: CouponDef[] = [];
  private redemptions: CouponRedeem[] = [];

  constructor() {
    this.load();
    this.ensureSeed();
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
      console.log(
        `[coupon] Loaded ${this.coupons.length} coupons · ${this.redemptions.length} redemptions`,
      );
    } catch (err) {
      console.warn("[coupon] Failed to load coupons.json:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: CouponsFile = {
        version: 1,
        coupons: this.coupons,
        redemptions: this.redemptions.slice(0, REDEEM_CAP),
      };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[coupon] Failed to save coupons.json:", err);
    }
  }

  private ensureSeed() {
    // Chỉ thêm mã seed lần đầu — không ghi đè cấu hình admin đã chỉnh
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
    return this.redemptions.filter((r) => r.code.toLowerCase() === key).length;
  }

  hasRedeemed(userId: string, code: string): boolean {
    const key = code.trim().toLowerCase();
    return this.redemptions.some(
      (r) => r.userId === userId && r.code.toLowerCase() === key,
    );
  }

  /** Kiểm tra mã (chưa ghi nhận). Không lộ danh sách coupon. */
  previewRedeem(
    code: string,
    userId: string,
  ):
    | { ok: true; amount: number; code: string }
    | { ok: false; reason: string } {
    const raw = code.trim();
    if (!raw) return { ok: false, reason: "Nhập mã nạp xu" };

    const coupon = this.find(raw);
    if (!coupon || !coupon.enabled) {
      return { ok: false, reason: "Mã không hợp lệ hoặc đã hết hạn" };
    }
    if (coupon.oncePerUser && this.hasRedeemed(userId, coupon.code)) {
      return { ok: false, reason: "Bạn đã dùng mã này rồi" };
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
    this.redemptions.unshift({
      id: randomBytes(6).toString("hex"),
      at: Date.now(),
      code,
      userId,
      username,
      amount,
    });
    if (this.redemptions.length > REDEEM_CAP) {
      this.redemptions.length = REDEEM_CAP;
    }
    this.save();
  }

  /** Admin xem đầy đủ (kể cả mã secret). */
  listForAdmin() {
    return this.coupons.map((c) => {
      const used = this.redeemCountFor(c.code);
      return { ...c, redeemCount: used };
    });
  }

  recentRedemptions(limit = 40): CouponRedeem[] {
    return this.redemptions.slice(0, Math.min(limit, 100));
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
    secret?: boolean;
    maxUses?: number;
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
    const key = code.toLowerCase();
    const existing = this.coupons.find((c) => c.code.toLowerCase() === key);
    if (existing) {
      existing.amount = amount;
      if (typeof input.label === "string") {
        existing.label = input.label.trim().slice(0, 80) || existing.label;
      }
      if (typeof input.enabled === "boolean") existing.enabled = input.enabled;
      if (typeof input.oncePerUser === "boolean") {
        existing.oncePerUser = input.oncePerUser;
      }
      if (typeof input.secret === "boolean") existing.secret = input.secret;
      if (maxUses !== undefined) existing.maxUses = maxUses;
      this.save();
      return { ok: true, coupon: { ...existing } };
    }
    const coupon: CouponDef = {
      code,
      amount,
      secret: input.secret !== false,
      label: (input.label ?? "").trim().slice(0, 80) || `Nạp ${amount} xu`,
      enabled: input.enabled !== false,
      oncePerUser: !!input.oncePerUser,
      maxUses: maxUses ?? 0,
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
