import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_AVATAR,
  isAllowedAvatar,
  normalizeAvatar,
} from "./avatars.js";
import { STARTING_BALANCE, weekKey } from "./types.js";

export type UserRole = "user" | "admin" | "mainadmin";

export interface UserRecord {
  id: string;
  /** Mã user công khai, duy nhất (vd U7K2M9AB) — dùng trong URL */
  code: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  avatar: string;
  balance: number;
  winToday: number;
  guessesToday: number;
  dayKey: string;
  stakeWeek: number;
  weekKey: string;
  createdAt: number;
  /** Bắt đổi mật khẩu (seed mainadmin lần đầu) */
  mustChangePassword?: boolean;
}

export interface PublicUser {
  id: string;
  code: string;
  username: string;
  role: UserRole;
  avatar: string;
  balance: number;
  winToday: number;
  guessesToday: number;
  stakeWeek: number;
  weekKey: string;
  mustChangePassword?: boolean;
}

interface UsersFile {
  version: 1;
  users: UserRecord[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const USERS_PATH = join(DATA_DIR, "users.json");
const USERS_TMP = join(DATA_DIR, "users.json.tmp");
const SAVE_DEBOUNCE_MS = 300;
const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS) || 7 * 24 * 60 * 60 * 1000;
const IS_PROD = process.env.NODE_ENV === "production";

interface TokenEntry {
  userId: string;
  exp: number;
}

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function ensureDay(u: UserRecord) {
  const key = todayKey();
  if (u.dayKey !== key) {
    u.dayKey = key;
    u.winToday = 0;
    u.guessesToday = 0;
  }
  const wk = weekKey();
  if (u.weekKey !== wk) {
    u.weekKey = wk;
    u.stakeWeek = 0;
  }
  if (typeof u.stakeWeek !== "number") u.stakeWeek = 0;
  if (typeof u.weekKey !== "string") u.weekKey = wk;
}

function toPublic(u: UserRecord): PublicUser {
  ensureDay(u);
  u.avatar = normalizeAvatar(u.avatar);
  return {
    id: u.id,
    code: u.code,
    username: u.username,
    role: u.role,
    avatar: u.avatar,
    balance: u.balance,
    winToday: u.winToday,
    guessesToday: u.guessesToday,
    stakeWeek: u.stakeWeek,
    weekKey: u.weekKey,
    mustChangePassword: !!u.mustChangePassword,
  };
}

/** Mã user 8 ký tự (A-Z0-9), tránh nhầm I/O/0/1. */
function makeUserCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "U";
  const bytes = randomBytes(7);
  for (let i = 0; i < 7; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function isStaffRole(role: UserRole): boolean {
  return role === "admin" || role === "mainadmin";
}

function isUserRecord(u: unknown): u is UserRecord {
  if (!u || typeof u !== "object") return false;
  const r = u as UserRecord;
  const roleOk =
    r.role === "user" || r.role === "admin" || r.role === "mainadmin";
  return (
    typeof r.id === "string" &&
    typeof r.username === "string" &&
    typeof r.passwordHash === "string" &&
    typeof r.salt === "string" &&
    roleOk &&
    typeof r.balance === "number" &&
    typeof r.winToday === "number" &&
    typeof r.guessesToday === "number" &&
    typeof r.dayKey === "string" &&
    typeof r.createdAt === "number"
  );
}

export class AuthStore {
  private users = new Map<string, UserRecord>(); // username lower -> user
  private byId = new Map<string, UserRecord>();
  private byCode = new Map<string, UserRecord>(); // code upper -> user
  private tokens = new Map<string, TokenEntry>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadFromDisk();
    this.ensureUserCodes();
    this.ensureSeedAccounts();
    this.ensureMainAdminMustChangePassword();
    this.saveNow();
  }

  /** Mainadmin seed / chưa đổi MK → bắt đổi lần đầu. */
  private ensureMainAdminMustChangePassword() {
    for (const u of this.byId.values()) {
      if (u.role !== "mainadmin") continue;
      if (u.mustChangePassword === undefined) {
        u.mustChangePassword = true;
      }
    }
  }

  private allocateCode(): string {
    for (let i = 0; i < 40; i++) {
      const code = makeUserCode();
      if (!this.byCode.has(code)) return code;
    }
    return `U${randomBytes(6).toString("hex").toUpperCase()}`;
  }

  private indexUser(u: UserRecord) {
    this.users.set(u.username.toLowerCase(), u);
    this.byId.set(u.id, u);
    this.byCode.set(u.code.toUpperCase(), u);
  }

  /** Gán mã cho user cũ chưa có code. */
  private ensureUserCodes() {
    this.byCode.clear();
    let changed = false;
    for (const u of this.byId.values()) {
      if (typeof u.code === "string" && /^U[A-Z0-9]{7,}$/i.test(u.code)) {
        u.code = u.code.toUpperCase();
        this.byCode.set(u.code, u);
        continue;
      }
      u.code = this.allocateCode();
      this.byCode.set(u.code, u);
      changed = true;
    }
    if (changed) console.log(`[auth] Assigned user codes to ${this.byId.size} accounts`);
  }

  private loadFromDisk() {
    try {
      if (!existsSync(USERS_PATH)) return;
      const raw = readFileSync(USERS_PATH, "utf8");
      const parsed = JSON.parse(raw) as UsersFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.users)) return;
      for (const u of parsed.users) {
        if (!isUserRecord(u)) continue;
        u.avatar = normalizeAvatar(
          typeof (u as UserRecord).avatar === "string"
            ? (u as UserRecord).avatar
            : DEFAULT_AVATAR,
        );
        if (typeof (u as UserRecord).code !== "string") {
          (u as UserRecord).code = "";
        }
        if (typeof (u as UserRecord).stakeWeek !== "number") {
          (u as UserRecord).stakeWeek = 0;
        }
        if (typeof (u as UserRecord).weekKey !== "string") {
          (u as UserRecord).weekKey = weekKey();
        }
        this.indexUser(u);
      }
      console.log(`[auth] Loaded ${this.byId.size} users from disk`);
    } catch (err) {
      console.warn("[auth] Failed to load users.json:", err);
    }
  }

  private ensureSeedAccounts() {
    const seeds: { user: string; env: string; fallback: string; role: UserRole }[] =
      [
        {
          user: "mainadmin",
          env: "SEED_MAINADMIN_PASSWORD",
          fallback: "mainadmin123",
          role: "mainadmin",
        },
        {
          user: "admin",
          env: "SEED_ADMIN_PASSWORD",
          fallback: "admin123",
          role: "admin",
        },
        {
          user: "demo",
          env: "SEED_DEMO_PASSWORD",
          fallback: "demo123",
          role: "user",
        },
      ];
    for (const s of seeds) {
      if (this.users.has(s.user)) continue;
      const fromEnv = process.env[s.env]?.trim();
      const password = fromEnv || (IS_PROD ? "" : s.fallback);
      if (!password) {
        console.warn(
          `[auth] Skip seed ${s.user}: set ${s.env} in production`,
        );
        continue;
      }
      this.seed(s.user, password, s.role);
      if (IS_PROD && fromEnv) {
        console.log(`[auth] Seeded ${s.user} from ${s.env}`);
      }
    }
  }

  private seed(username: string, password: string, role: UserRole) {
    const salt = randomBytes(16).toString("hex");
    const id = createHash("sha1").update(username).digest("hex").slice(0, 12);
    const user: UserRecord = {
      id,
      code: this.allocateCode(),
      username,
      passwordHash: hashPassword(password, salt),
      salt,
      role,
      avatar: DEFAULT_AVATAR,
      balance: isStaffRole(role) ? 100_000 : STARTING_BALANCE,
      winToday: 0,
      guessesToday: 0,
      dayKey: todayKey(),
      stakeWeek: 0,
      weekKey: weekKey(),
      createdAt: Date.now(),
      mustChangePassword: role === "mainadmin",
    };
    this.indexUser(user);
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Flush immediately (boot / tests). */
  saveNow() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: UsersFile = {
        version: 1,
        users: [...this.byId.values()],
      };
      writeFileSync(USERS_TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(USERS_TMP, USERS_PATH);
    } catch (err) {
      console.warn("[auth] Failed to save users.json:", err);
    }
  }

  register(
    username: string,
    password: string,
  ): { ok: true; user: PublicUser; token: string } | { ok: false; reason: string } {
    const name = username.trim();
    if (name.length < 3 || name.length > 20) {
      return { ok: false, reason: "Username 3–20 ký tự" };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return { ok: false, reason: "Chỉ chữ, số, gạch dưới" };
    }
    if (password.length < 6) {
      return { ok: false, reason: "Mật khẩu tối thiểu 6 ký tự" };
    }
    if (this.users.has(name.toLowerCase())) {
      return { ok: false, reason: "Username đã tồn tại" };
    }

    const salt = randomBytes(16).toString("hex");
    const id = randomBytes(8).toString("hex");
    const user: UserRecord = {
      id,
      code: this.allocateCode(),
      username: name,
      passwordHash: hashPassword(password, salt),
      salt,
      role: "user",
      avatar: DEFAULT_AVATAR,
      balance: STARTING_BALANCE,
      winToday: 0,
      guessesToday: 0,
      dayKey: todayKey(),
      stakeWeek: 0,
      weekKey: weekKey(),
      createdAt: Date.now(),
    };
    this.indexUser(user);
    this.scheduleSave();
    const token = this.issueToken(user.id);
    return { ok: true, user: toPublic(user), token };
  }

  login(
    username: string,
    password: string,
  ): { ok: true; user: PublicUser; token: string } | { ok: false; reason: string } {
    const user = this.users.get(username.trim().toLowerCase());
    if (!user) return { ok: false, reason: "Sai tài khoản hoặc mật khẩu" };
    const hash = hashPassword(password, user.salt);
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(user.passwordHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "Sai tài khoản hoặc mật khẩu" };
    }
    ensureDay(user);
    return { ok: true, user: toPublic(user), token: this.issueToken(user.id) };
  }

  private issueToken(userId: string): string {
    const token = randomBytes(24).toString("hex");
    this.tokens.set(token, {
      userId,
      exp: Date.now() + TOKEN_TTL_MS,
    });
    return token;
  }

  resolveToken(token?: string | null): PublicUser | null {
    if (!token) return null;
    const entry = this.tokens.get(token);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this.tokens.delete(token);
      return null;
    }
    const user = this.byId.get(entry.userId);
    if (!user) return null;
    return toPublic(user);
  }

  revokeToken(token?: string | null): boolean {
    if (!token) return false;
    return this.tokens.delete(token);
  }

  /** Đổi mật khẩu (user đã login). */
  changePassword(
    userId: string,
    currentPassword: string,
    nextPassword: string,
  ): { ok: true } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (nextPassword.length < 6) {
      return { ok: false, reason: "Mật khẩu mới tối thiểu 6 ký tự" };
    }
    const hash = hashPassword(currentPassword, user.salt);
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(user.passwordHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "Mật khẩu hiện tại sai" };
    }
    user.salt = randomBytes(16).toString("hex");
    user.passwordHash = hashPassword(nextPassword, user.salt);
    user.mustChangePassword = false;
    this.scheduleSave();
    // Thu hồi mọi token của user
    for (const [tok, entry] of this.tokens) {
      if (entry.userId === userId) this.tokens.delete(tok);
    }
    return { ok: true };
  }

  getById(id: string): UserRecord | undefined {
    return this.byId.get(id);
  }

  listUsers(): PublicUser[] {
    return [...this.byId.values()].map(toPublic);
  }

  getAccountStats() {
    let users = 0;
    let admins = 0;
    let mainadmins = 0;
    let balanceTotal = 0;
    for (const u of this.byId.values()) {
      balanceTotal += u.balance;
      if (u.role === "mainadmin") mainadmins += 1;
      else if (u.role === "admin") admins += 1;
      else users += 1;
    }
    return {
      totalAccounts: this.byId.size,
      playerAccounts: users,
      adminAccounts: admins,
      mainadminAccounts: mainadmins,
      balanceTotal,
    };
  }

  setAvatar(
    userId: string,
    avatar: string,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (!isAllowedAvatar(avatar)) {
      return { ok: false, reason: "Avatar không hợp lệ" };
    }
    user.avatar = avatar;
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  adjustBalance(
    userId: string,
    delta: number,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    const next = user.balance + Math.floor(delta);
    if (next < 0) return { ok: false, reason: "Số dư không đủ để trừ" };
    user.balance = next;
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  setBalance(userId: string, balance: number) {
    const user = this.byId.get(userId);
    if (!user) return;
    user.balance = Math.max(0, Math.floor(balance));
    this.scheduleSave();
  }

  syncPlayStats(
    userId: string,
    balance: number,
    winToday: number,
    guessesToday: number,
    stakeWeek?: number,
  ) {
    const user = this.byId.get(userId);
    if (!user) return;
    ensureDay(user);
    user.balance = Math.max(0, Math.floor(balance));
    user.winToday = Math.max(0, Math.floor(winToday));
    user.guessesToday = Math.max(0, Math.floor(guessesToday));
    if (typeof stakeWeek === "number" && Number.isFinite(stakeWeek)) {
      user.stakeWeek = Math.max(0, Math.floor(stakeWeek));
      user.weekKey = weekKey();
    }
    this.scheduleSave();
  }

  /** User có stake tuần > 0 (kể cả offline) — Sao bài Tarot */
  listWeeklyStakers(): {
    id: string;
    username: string;
    avatar: string;
    stakeWeek: number;
  }[] {
    const wk = weekKey();
    const out: {
      id: string;
      username: string;
      avatar: string;
      stakeWeek: number;
    }[] = [];
    for (const u of this.byId.values()) {
      ensureDay(u);
      if (u.weekKey !== wk || u.stakeWeek <= 0) continue;
      out.push({
        id: u.id,
        username: u.username,
        avatar: normalizeAvatar(u.avatar),
        stakeWeek: u.stakeWeek,
      });
    }
    return out;
  }
}

export const authStore = new AuthStore();

export function isStaff(user: { role: UserRole }): boolean {
  return user.role === "admin" || user.role === "mainadmin";
}

export function isMainAdmin(user: { role: UserRole }): boolean {
  return user.role === "mainadmin";
}
