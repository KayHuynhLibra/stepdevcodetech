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

/** Đủ số ván lifetime → VIP tự động */
export const VIP_ROUNDS_REQUIRED = 10_000;

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
  /**
   * Điều khiển kết quả riêng (admin):
   * normal = theo Inter phòng · win = ưu tiên thắng · lose = ưu tiên thua
   */
  outcomeMode?: UserOutcomeMode;
  /** Số ván đã chơi (lifetime — có đặt cược khi settle) */
  roundsPlayed?: number;
  /** Admin cấp VIP thủ công */
  vipGranted?: boolean;
  /** Legacy — migrate sang vipGranted khi load */
  isVip?: boolean;
}

export type UserOutcomeMode = "normal" | "win" | "lose";

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
  outcomeMode: UserOutcomeMode;
  roundsPlayed: number;
  vipGranted: boolean;
  /** vipGranted || roundsPlayed >= VIP_ROUNDS_REQUIRED */
  isVip: boolean;
}

interface UsersFile {
  version: 1;
  users: UserRecord[];
}

interface TokensFile {
  version: 1;
  tokens: { token: string; userId: string; exp: number }[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const USERS_PATH = join(DATA_DIR, "users.json");
const USERS_TMP = join(DATA_DIR, "users.json.tmp");
const TOKENS_PATH = join(DATA_DIR, "tokens.json");
const TOKENS_TMP = join(DATA_DIR, "tokens.json.tmp");
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
  if (typeof u.roundsPlayed !== "number" || !Number.isFinite(u.roundsPlayed)) {
    u.roundsPlayed = 0;
  }
  // Legacy isVip → vipGranted (một lần)
  if (u.isVip && !u.vipGranted) {
    u.vipGranted = true;
  }
  if (u.isVip) delete u.isVip;
}

function computeIsVip(u: UserRecord): boolean {
  const rounds = Math.max(0, Math.floor(u.roundsPlayed ?? 0));
  return !!u.vipGranted || rounds >= VIP_ROUNDS_REQUIRED;
}

function toPublic(u: UserRecord): PublicUser {
  ensureDay(u);
  u.avatar = normalizeAvatar(u.avatar);
  const roundsPlayed = Math.max(0, Math.floor(u.roundsPlayed ?? 0));
  const vipGranted = !!u.vipGranted;
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
    outcomeMode: normalizeOutcomeMode(u.outcomeMode),
    roundsPlayed,
    vipGranted,
    isVip: computeIsVip(u),
  };
}

export function isUserOutcomeMode(v: unknown): v is UserOutcomeMode {
  return v === "normal" || v === "win" || v === "lose";
}

function normalizeOutcomeMode(v: unknown): UserOutcomeMode {
  return isUserOutcomeMode(v) ? v : "normal";
}

/** Mã ID 5 số (10000–99999). */
function makeUserCode(): string {
  const n = 10000 + (randomBytes(2).readUInt16BE(0) % 90000);
  return String(n);
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
  private tokenSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadFromDisk();
    this.loadTokensFromDisk();
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
    for (let i = 0; i < 80; i++) {
      const code = makeUserCode();
      if (!this.byCode.has(code)) return code;
    }
    // fallback tuần tự từ 10000
    for (let n = 10000; n <= 99999; n++) {
      const code = String(n);
      if (!this.byCode.has(code)) return code;
    }
    return String(10000 + (Date.now() % 90000));
  }

  private indexUser(u: UserRecord) {
    this.users.set(u.username.toLowerCase(), u);
    this.byId.set(u.id, u);
    this.byCode.set(u.code.toUpperCase(), u);
  }

  /** Gán / migrate mã ID cho mọi user (3–8 ký tự A–Z0–9; cũ 5 số vẫn hợp lệ). */
  private ensureUserCodes() {
    this.byCode.clear();
    let changed = false;
    for (const u of this.byId.values()) {
      if (typeof u.code === "string" && /^[A-Z0-9]{3,8}$/i.test(u.code)) {
        u.code = u.code.toUpperCase();
        this.byCode.set(u.code, u);
        continue;
      }
      u.code = this.allocateCode();
      this.byCode.set(u.code, u);
      changed = true;
    }
    if (changed) {
      console.log(`[auth] Migrated/assigned IDs for users`);
    }
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
        const rec = u as UserRecord;
        if (typeof rec.roundsPlayed !== "number" || !Number.isFinite(rec.roundsPlayed)) {
          rec.roundsPlayed = 0;
        }
        if (rec.isVip && !rec.vipGranted) {
          rec.vipGranted = true;
        }
        if (rec.isVip) delete rec.isVip;
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
      roundsPlayed: 0,
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

  private scheduleTokenSave() {
    if (this.tokenSaveTimer) clearTimeout(this.tokenSaveTimer);
    this.tokenSaveTimer = setTimeout(() => {
      this.tokenSaveTimer = null;
      this.saveTokensNow();
    }, SAVE_DEBOUNCE_MS);
  }

  private loadTokensFromDisk() {
    try {
      if (!existsSync(TOKENS_PATH)) return;
      const parsed = JSON.parse(readFileSync(TOKENS_PATH, "utf8")) as TokensFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.tokens)) return;
      const now = Date.now();
      let n = 0;
      for (const t of parsed.tokens) {
        if (!t?.token || !t.userId || typeof t.exp !== "number") continue;
        if (t.exp <= now) continue;
        if (!this.byId.has(t.userId)) continue;
        this.tokens.set(t.token, { userId: t.userId, exp: t.exp });
        n += 1;
      }
      console.log(`[auth] Loaded ${n} session tokens from disk`);
    } catch (err) {
      console.warn("[auth] Failed to load tokens.json:", err);
    }
  }

  private saveTokensNow() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const now = Date.now();
      const tokens: TokensFile["tokens"] = [];
      for (const [token, entry] of this.tokens) {
        if (entry.exp <= now) {
          this.tokens.delete(token);
          continue;
        }
        tokens.push({ token, userId: entry.userId, exp: entry.exp });
      }
      const payload: TokensFile = { version: 1, tokens };
      writeFileSync(TOKENS_TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TOKENS_TMP, TOKENS_PATH);
    } catch (err) {
      console.warn("[auth] Failed to save tokens.json:", err);
    }
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
      roundsPlayed: 0,
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
    this.scheduleTokenSave();
    return token;
  }

  resolveToken(token?: string | null): PublicUser | null {
    if (!token) return null;
    const entry = this.tokens.get(token);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this.tokens.delete(token);
      this.scheduleTokenSave();
      return null;
    }
    const user = this.byId.get(entry.userId);
    if (!user) return null;
    return toPublic(user);
  }

  revokeToken(token?: string | null): boolean {
    if (!token) return false;
    const ok = this.tokens.delete(token);
    if (ok) this.scheduleTokenSave();
    return ok;
  }

  setOutcomeMode(
    userId: string,
    mode: UserOutcomeMode,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (!isUserOutcomeMode(mode)) {
      return { ok: false, reason: "Mode không hợp lệ (normal|win|lose)" };
    }
    user.outcomeMode = mode;
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  getOutcomeMode(userId: string): UserOutcomeMode {
    const user = this.byId.get(userId);
    return normalizeOutcomeMode(user?.outcomeMode);
  }

  setVip(
    userId: string,
    isVip: boolean,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    user.vipGranted = !!isVip;
    if (user.isVip) delete user.isVip;
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /**
   * Admin gán ID riêng (3–8 ký tự A–Z / 0–9).
   * Phải unique; cập nhật index byCode.
   */
  setUserCode(
    userId: string,
    rawCode: string,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    const code = String(rawCode ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (code.length < 3 || code.length > 8) {
      return { ok: false, reason: "ID gồm 3–8 ký tự chữ/số" };
    }
    const existing = this.byCode.get(code);
    if (existing && existing.id !== userId) {
      return { ok: false, reason: `ID ${code} đã được dùng` };
    }
    const prev = user.code?.toUpperCase();
    if (prev && prev !== code) {
      this.byCode.delete(prev);
    }
    user.code = code;
    this.byCode.set(code, user);
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  isVipUser(userId: string): boolean {
    const user = this.byId.get(userId);
    if (!user) return false;
    return computeIsVip(user);
  }

  /** +1 ván lifetime khi user có đặt cược và round settle. */
  recordRoundPlayed(userId: string): PublicUser | null {
    const user = this.byId.get(userId);
    if (!user) return null;
    ensureDay(user);
    user.roundsPlayed = Math.max(0, Math.floor(user.roundsPlayed ?? 0)) + 1;
    this.scheduleSave();
    return toPublic(user);
  }

  getRoundsPlayed(userId: string): number {
    const user = this.byId.get(userId);
    return Math.max(0, Math.floor(user?.roundsPlayed ?? 0));
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
    this.scheduleTokenSave();
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
