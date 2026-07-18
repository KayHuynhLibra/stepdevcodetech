import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { STARTING_BALANCE } from "./types.js";

export type UserRole = "user" | "admin";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  balance: number;
  winToday: number;
  guessesToday: number;
  dayKey: string;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  role: UserRole;
  balance: number;
  winToday: number;
  guessesToday: number;
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
}

function toPublic(u: UserRecord): PublicUser {
  ensureDay(u);
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    balance: u.balance,
    winToday: u.winToday,
    guessesToday: u.guessesToday,
  };
}

function isUserRecord(u: unknown): u is UserRecord {
  if (!u || typeof u !== "object") return false;
  const r = u as UserRecord;
  return (
    typeof r.id === "string" &&
    typeof r.username === "string" &&
    typeof r.passwordHash === "string" &&
    typeof r.salt === "string" &&
    (r.role === "user" || r.role === "admin") &&
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
  private tokens = new Map<string, string>(); // token -> userId
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadFromDisk();
    this.ensureSeedAccounts();
    this.saveNow();
  }

  private loadFromDisk() {
    try {
      if (!existsSync(USERS_PATH)) return;
      const raw = readFileSync(USERS_PATH, "utf8");
      const parsed = JSON.parse(raw) as UsersFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.users)) return;
      for (const u of parsed.users) {
        if (!isUserRecord(u)) continue;
        this.users.set(u.username.toLowerCase(), u);
        this.byId.set(u.id, u);
      }
      console.log(`[auth] Loaded ${this.byId.size} users from disk`);
    } catch (err) {
      console.warn("[auth] Failed to load users.json:", err);
    }
  }

  private ensureSeedAccounts() {
    if (!this.users.has("admin")) {
      this.seed("admin", "admin123", "admin");
    }
    if (!this.users.has("demo")) {
      this.seed("demo", "demo123", "user");
    }
  }

  private seed(username: string, password: string, role: UserRole) {
    const salt = randomBytes(16).toString("hex");
    const id = createHash("sha1").update(username).digest("hex").slice(0, 12);
    const user: UserRecord = {
      id,
      username,
      passwordHash: hashPassword(password, salt),
      salt,
      role,
      balance: role === "admin" ? 1_000_000 : STARTING_BALANCE,
      winToday: 0,
      guessesToday: 0,
      dayKey: todayKey(),
      createdAt: Date.now(),
    };
    this.users.set(username.toLowerCase(), user);
    this.byId.set(id, user);
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
    if (password.length < 4) {
      return { ok: false, reason: "Mật khẩu tối thiểu 4 ký tự" };
    }
    if (this.users.has(name.toLowerCase())) {
      return { ok: false, reason: "Username đã tồn tại" };
    }

    const salt = randomBytes(16).toString("hex");
    const id = randomBytes(8).toString("hex");
    const user: UserRecord = {
      id,
      username: name,
      passwordHash: hashPassword(password, salt),
      salt,
      role: "user",
      balance: STARTING_BALANCE,
      winToday: 0,
      guessesToday: 0,
      dayKey: todayKey(),
      createdAt: Date.now(),
    };
    this.users.set(name.toLowerCase(), user);
    this.byId.set(id, user);
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
    this.tokens.set(token, userId);
    return token;
  }

  resolveToken(token?: string | null): PublicUser | null {
    if (!token) return null;
    const userId = this.tokens.get(token);
    if (!userId) return null;
    const user = this.byId.get(userId);
    if (!user) return null;
    return toPublic(user);
  }

  getById(id: string): UserRecord | undefined {
    return this.byId.get(id);
  }

  listUsers(): PublicUser[] {
    return [...this.byId.values()].map(toPublic);
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
  ) {
    const user = this.byId.get(userId);
    if (!user) return;
    ensureDay(user);
    user.balance = Math.max(0, Math.floor(balance));
    user.winToday = Math.max(0, Math.floor(winToday));
    user.guessesToday = Math.max(0, Math.floor(guessesToday));
    this.scheduleSave();
  }
}

export const authStore = new AuthStore();
