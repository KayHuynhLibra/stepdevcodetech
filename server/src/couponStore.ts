import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

export interface CouponDef {
  code: string;
  amount: number;
  /** Ẩn với user — chỉ admin biết mã */
  secret: boolean;
  label: string;
  enabled: boolean;
  /** Mỗi user chỉ đổi 1 lần */
  oncePerUser: boolean;
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

const SEED: CouponDef[] = [
  {
    code: "SangNhung",
    amount: 1_000_000,
    secret: true,
    label: "Nạp cố định 1.000.000 xu",
    enabled: true,
    oncePerUser: true,
  },
  {
    code: "TEPTHEMSOFIA",
    amount: 2_000_000,
    secret: true,
    label: "Nạp 2.000.000 xu — dùng nhiều lần",
    enabled: true,
    oncePerUser: false,
  },
];

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
      if (Array.isArray(parsed.coupons)) this.coupons = parsed.coupons;
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
    for (const seed of SEED) {
      const key = seed.code.toLowerCase();
      const idx = this.coupons.findIndex((c) => c.code.toLowerCase() === key);
      if (idx < 0) {
        this.coupons.push({ ...seed });
        continue;
      }
      // Đồng bộ mệnh giá / oncePerUser từ seed (không ghi đè enabled nếu admin đã tắt)
      const cur = this.coupons[idx]!;
      cur.amount = seed.amount;
      cur.oncePerUser = seed.oncePerUser;
      cur.secret = seed.secret;
      cur.label = seed.label;
      if (cur.enabled === undefined) cur.enabled = seed.enabled;
    }
  }

  private find(code: string): CouponDef | undefined {
    const key = code.trim().toLowerCase();
    return this.coupons.find((c) => c.code.toLowerCase() === key);
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
      const used = this.redemptions.filter(
        (r) => r.code.toLowerCase() === c.code.toLowerCase(),
      ).length;
      return { ...c, redeemCount: used };
    });
  }

  recentRedemptions(limit = 40): CouponRedeem[] {
    return this.redemptions.slice(0, Math.min(limit, 100));
  }
}

export const couponStore = new CouponStore();
