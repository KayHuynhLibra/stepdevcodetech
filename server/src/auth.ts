import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_AVATAR,
  isAllowedAvatar,
  normalizeAvatar,
} from "./avatars.js";
import { STARTING_BALANCE, weekKey, MIN_STAKE } from "./types.js";

import { ITEM_XU_MAX, ACCOUNT_BALANCE_MAX } from "./types.js";
/** Trần tặng xu / vật phẩm mỗi lần — 12 chữ số */
export const GIFT_XU_MAX = ITEM_XU_MAX;
import {
  demoteRank,
  isCultivationRank,
  periodMs,
  type CultivationRank,
} from "./cultivationRanks.js";
import { cultivationStore } from "./cultivationStore.js";
import { vaultStore } from "./vaultStore.js";
import { ringStore } from "./ringStore.js";
import {
  normalizeNameColor,
  normalizeNameEffect,
  type NameColorId,
  type NameEffectId,
} from "./nameColors.js";
import {
  normalizeAvatarFrame,
  normalizeProfileTheme,
  normalizeNameFrame,
  normalizeIdFrame,
  type AvatarFrameId,
  type ProfileThemeId,
  type NameFrameId,
  type IdFrameId,
} from "./profileStyles.js";
import {
  canControlVoiceRoomLock as grantsCanControlVoiceRoomLock,
  clampStaffGrantLevel,
  hasCapability,
  normalizeVoiceRoomGrants,
  STAFF_GRANT_LEVEL_MAX,
  STAFF_GRANT_LEVEL_MIN,
  userHasAnyRole,
  userHasRole,
} from "./grants.js";

export {
  effectiveRoles,
  effectiveStaffGrantLevel,
  GRANT_LEVEL_LABELS,
  hasCapability,
  ROLE_DEFAULT_LEVEL,
  STAFF_GRANT_LEVEL_MAX,
  STAFF_GRANT_LEVEL_MIN,
  userHasAnyRole,
  userHasRole,
  type GrantCapability,
} from "./grants.js";

export type { CultivationRank } from "./cultivationRanks.js";
export {
  CULTIVATION_LABELS,
  CULTIVATION_RANKS,
  isCultivationRank,
} from "./cultivationRanks.js";

export type UserRole =
  | "user"
  | "admin"
  | "mainadmin"
  | "deal"
  | "onl"
  | "tutien"
  | "mod"
  | "eco"
  | "audit"
  | "sgift"
  | "ring";

/** Đủ số ván lifetime → VIP tự động */
export const VIP_ROUNDS_REQUIRED = 10_000;

/** Tối đa số lần đổi username / tài khoản (lifetime). */
export const USERNAME_RENAME_MAX = 5;

export interface UserRecord {
  id: string;
  /** Mã user công khai, duy nhất (vd U7K2M9AB) — dùng trong URL */
  code: string;
  username: string;
  /** Tên hiển thị trong game (nickname); login vẫn dùng username */
  nickname?: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  /**
   * Roles phụ — cộng dồn capability (không gồm mainadmin; không trùng primary).
   * Thiếu khi load → migrate `[]`.
   */
  extraRoles?: UserRole[];
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
  /**
   * Khi mode=win: xác suất ép thắng mỗi ván (80–100). 100 = luôn thắng như cũ.
   */
  outcomeWinPct?: number;
  /** Số ván đã chơi (lifetime — có đặt xu khi settle) */
  roundsPlayed?: number;
  /** Admin cấp VIP thủ công */
  vipGranted?: boolean;
  /** Legacy — migrate sang vipGranted khi load */
  isVip?: boolean;
  /** Tài khoản bị khóa — không login / join */
  banned?: boolean;
  banReason?: string;
  bannedAt?: number;
  /** Chat mute đến timestamp; 0/undefined = không mute. Number.MAX_SAFE_INTEGER ≈ vĩnh viễn */
  mutedUntil?: number;
  /** Tarot — chuỗi thua/thắng liên tiếp (có đặt xu khi settle) */
  tarotLossStreak?: number;
  tarotWinStreak?: number;
  /** Mã khôi phục mật khẩu (hiển thị 1 lần khi tạo / reset) */
  recoveryCode?: string;
  /** IP gần nhất (chỉ staff/mainadmin đọc qua API riêng — không vào toPublic) */
  lastIp?: string;
  lastIpAt?: number;
  ipHistory?: IpHistoryEntry[];
  /** Mainadmin: không hiện trên BXH Tarot (ngày/tuần/top ván/ace/streak) */
  hideFromLeaderboard?: boolean;
  /** Ẩn nick công khai — bàn/profile hiện "Ẩn danh" */
  hideNickname?: boolean;
  /** Số lần đã đổi username (tối đa USERNAME_RENAME_MAX) */
  usernameRenames?: number;
  /** Cảnh giới Tu Tiên (công khai) */
  cultivationRank?: CultivationRank;
  /** Hết hạn kỳ phí duy trì đã trả */
  cultivationPaidUntil?: number;
  cultivationLastChargeAt?: number;
  /**
   * Room voice được mainadmin/admin cấp — số phòng 1…5.
   * Chỉ người có đúng Room# mới đóng phòng / đặt mật khẩu.
   */
  voiceRoomGrants?: number[];
  /**
   * Override bậc staff L0–L6 (grants.ts). Thiếu → suy từ role.
   */
  staffGrantLevel?: number;
  /** Màu nick công khai — RoleAD gán (nameColors.ts) */
  nameColor?: string;
  /** Hiệu ứng chữ nick — RoleAD */
  nameEffect?: string;
  /** Khung avatar role — RoleAD */
  avatarFrame?: string;
  /** Nền hồ sơ chiêm tinh — RoleAD */
  profileTheme?: string;
  /** Khung bao nickname — RoleAD */
  nameFrame?: string;
  /** Khung bao ID badge — RoleAD */
  idFrame?: string;
}

/** Lịch sử IP theo user — không lộ ra PublicUser / client player */
export interface IpHistoryEntry {
  ip: string;
  firstAt: number;
  lastAt: number;
  hits: number;
}

const IP_HISTORY_CAP = 20;

export type UserOutcomeMode = "normal" | "win" | "lose";

export const OUTCOME_WIN_PCT_MIN = 80;
export const OUTCOME_WIN_PCT_MAX = 100;
export const OUTCOME_WIN_PCT_DEFAULT = 100;

export function clampOutcomeWinPct(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return OUTCOME_WIN_PCT_DEFAULT;
  return Math.max(OUTCOME_WIN_PCT_MIN, Math.min(OUTCOME_WIN_PCT_MAX, v));
}

export interface PublicUser {
  id: string;
  code: string;
  username: string;
  nickname?: string;
  /** Tên chính trên bàn / BXH — nickname hợp lệ hoặc username */
  displayName: string;
  role: UserRole;
  /** Roles phụ cộng dồn capability */
  extraRoles?: UserRole[];
  avatar: string;
  balance: number;
  winToday: number;
  guessesToday: number;
  stakeWeek: number;
  weekKey: string;
  mustChangePassword?: boolean;
  outcomeMode: UserOutcomeMode;
  /** Chỉ meaningful khi outcomeMode=win — 80…100 */
  outcomeWinPct?: number;
  roundsPlayed: number;
  vipGranted: boolean;
  /** vipGranted || roundsPlayed >= VIP_ROUNDS_REQUIRED */
  isVip: boolean;
  banned: boolean;
  banReason?: string;
  /** ms còn mute; 0 = không mute */
  mutedUntil: number;
  muted: boolean;
  /** Chỉ trả khi vừa tạo / vừa hiện recovery — không lộ hash */
  recoveryCode?: string;
  /** Chỉ admin list — mainadmin bật ẩn BXH */
  hideFromLeaderboard?: boolean;
  /** Ẩn nick công khai */
  hideNickname?: boolean;
  usernameRenamesUsed: number;
  usernameRenamesLeft: number;
  cultivationRank?: CultivationRank;
  cultivationPaidUntil?: number;
  /** Room# được cấp để đóng phòng / đặt MK (1…5) */
  voiceRoomGrants?: number[];
  /** Override bậc staff 0–6; thiếu → theo role */
  staffGrantLevel?: number;
  /** Màu nick công khai (RoleAD) */
  nameColor?: string;
  /** Hiệu ứng chữ nick (RoleAD) */
  nameEffect?: string;
  /** Khung avatar role (RoleAD) */
  avatarFrame?: string;
  /** Nền hồ sơ chiêm tinh (RoleAD) */
  profileTheme?: string;
  /** Khung bao nickname (RoleAD) */
  nameFrame?: string;
  /** Khung bao ID badge (RoleAD) */
  idFrame?: string;
  /** Cặp đôi / nhẫn — active công khai; pending chỉ self */
  bond?: {
    partnerId: string;
    partnerCode: string;
    partnerName: string;
    partnerAvatar: string;
    ringKey: string;
    ringNameVi: string;
    ringImage: string;
    ringEffect?: string;
    ringSharpness?: number;
    coupleFrame?: string;
    coupleBorder?: string;
    coupleScale?: string;
    coupleMotion?: string;
    coupleGap?: string;
    coupleLayout?: string;
    ringFrame?: string;
    ringFrameScale?: string;
    since: number;
    status: "pending" | "active";
  };
}

/** Trần xu mang từ guest → account */
export const GUEST_MERGE_BALANCE_CAP = 500_000;

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

/** Fallback chỉ dùng khi seed local — production không tạo bằng các giá trị này. */
const STAFF_SEED_FALLBACKS: Record<string, string> = {
  mainadmin: "mainadmin123",
  admin: "admin123",
};

interface TokenEntry {
  userId: string;
  exp: number;
}

function passwordMatches(user: UserRecord, password: string): boolean {
  const hash = hashPassword(password, user.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function validateUsername(
  raw: string,
): { ok: true; username: string } | { ok: false; reason: string } {
  const name = String(raw ?? "").trim();
  if (name.length < 3 || name.length > 20) {
    return { ok: false, reason: "Username 3–20 ký tự" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return { ok: false, reason: "Chỉ chữ, số, gạch dưới" };
  }
  return { ok: true, username: name };
}

export const NICKNAME_MAX_LEN = 12;
export const NICKNAME_MIN_LEN = 2;

export function normalizeNicknameInput(raw: string): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, NICKNAME_MAX_LEN);
}

export function validateNickname(
  raw: string,
): { ok: true; nickname: string } | { ok: false; reason: string } {
  const next = normalizeNicknameInput(raw);
  if (next.length === 0) return { ok: true, nickname: "" };
  if (next.length < NICKNAME_MIN_LEN) {
    return { ok: false, reason: `Nickname ${NICKNAME_MIN_LEN}–${NICKNAME_MAX_LEN} ký tự` };
  }
  return { ok: true, nickname: next };
}

export function userDisplayName(u: {
  username: string;
  nickname?: string | null;
  hideNickname?: boolean;
}): string {
  if (u.hideNickname) return "Ẩn danh";
  const nick = normalizeNicknameInput(String(u.nickname ?? ""));
  if (nick.length >= 2) return nick;
  return String(u.username ?? "").slice(0, 20);
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

function makeRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function toPublic(
  u: UserRecord,
  opts?: { includeRecovery?: boolean; includePendingBond?: boolean },
): PublicUser {
  ensureDay(u);
  u.avatar = normalizeAvatar(u.avatar);
  const roundsPlayed = Math.max(0, Math.floor(u.roundsPlayed ?? 0));
  const vipGranted = !!u.vipGranted;
  const mutedUntil = Math.max(0, Math.floor(u.mutedUntil ?? 0));
  const muted = mutedUntil > Date.now();
  const renamesUsed = Math.max(
    0,
    Math.min(USERNAME_RENAME_MAX, Math.floor(u.usernameRenames ?? 0)),
  );
  const pub: PublicUser = {
    id: u.id,
    code: u.code,
    username: u.username,
    nickname:
      u.nickname?.trim() ? u.nickname.trim() : undefined,
    displayName: userDisplayName(u),
    role: u.role,
    extraRoles: normalizeExtraRoles(u.extraRoles, u.role),
    avatar: u.avatar,
    balance: u.balance,
    winToday: u.winToday,
    guessesToday: u.guessesToday,
    stakeWeek: u.stakeWeek,
    weekKey: u.weekKey,
    mustChangePassword: !!u.mustChangePassword,
    outcomeMode: normalizeOutcomeMode(u.outcomeMode),
    outcomeWinPct: clampOutcomeWinPct(u.outcomeWinPct),
    roundsPlayed,
    vipGranted,
    isVip: computeIsVip(u),
    banned: !!u.banned,
    banReason: u.banReason,
    mutedUntil,
    muted,
    hideFromLeaderboard: !!u.hideFromLeaderboard,
    hideNickname: !!u.hideNickname,
    usernameRenamesUsed: renamesUsed,
    usernameRenamesLeft: Math.max(0, USERNAME_RENAME_MAX - renamesUsed),
  };
  // Persist normalized extras on record (migrate missing → [])
  u.extraRoles = pub.extraRoles;
  if (u.cultivationRank && isCultivationRank(u.cultivationRank)) {
    pub.cultivationRank = u.cultivationRank;
  }
  if (u.cultivationPaidUntil && u.cultivationPaidUntil > 0) {
    pub.cultivationPaidUntil = u.cultivationPaidUntil;
  }
  const grants = normalizeVoiceRoomGrants(u.voiceRoomGrants);
  if (grants.length) pub.voiceRoomGrants = grants;
  if (u.staffGrantLevel != null) {
    pub.staffGrantLevel = clampStaffGrantLevel(u.staffGrantLevel);
  }
  const nc = normalizeNameColor(u.nameColor);
  if (nc !== "default") pub.nameColor = nc;
  const ne = normalizeNameEffect(u.nameEffect);
  if (ne !== "none") pub.nameEffect = ne;
  const af = normalizeAvatarFrame(u.avatarFrame);
  if (af !== "none") pub.avatarFrame = af;
  const pt = normalizeProfileTheme(u.profileTheme);
  if (pt !== "cosmic") pub.profileTheme = pt;
  const nf = normalizeNameFrame(u.nameFrame);
  if (nf !== "none") pub.nameFrame = nf;
  const idf = normalizeIdFrame(u.idFrame);
  if (idf !== "classic") pub.idFrame = idf;
  if (opts?.includeRecovery && u.recoveryCode) {
    pub.recoveryCode = u.recoveryCode;
  }
  // Bond snippet — lazy resolver set sau khi authStore khởi tạo
  if (bondPartnerResolver) {
    const snippet = bondPartnerResolver(u.id, !!opts?.includePendingBond);
    if (snippet) pub.bond = snippet;
  }
  return pub;
}

/** Gắn bởi authStore sau init — tránh circular import ringStore ↔ auth. */
type BondSnippetFn = (
  userId: string,
  includePending: boolean,
) => PublicUser["bond"] | undefined;
let bondPartnerResolver: BondSnippetFn | null = null;

export function setBondPartnerResolver(fn: BondSnippetFn | null) {
  bondPartnerResolver = fn;
}

export { normalizeVoiceRoomGrants };

/** Đóng phòng / đặt MK — mainadmin/L6 hoặc đúng Room# đã cấp. */
export function canControlVoiceRoomLock(
  user:
    | {
        role: UserRole;
        voiceRoomGrants?: number[];
        staffGrantLevel?: number;
      }
    | null
    | undefined,
  roomId: number,
): boolean {
  return grantsCanControlVoiceRoomLock(user, roomId);
}

/** Mainadmin hoặc admin (hoặc L5+ override) cấp Room#. */
export function canGrantVoiceRooms(
  user: { role: UserRole; staffGrantLevel?: number } | null | undefined,
): boolean {
  return hasCapability(user, "grant_rooms");
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

function isAssignableStaffRole(role: string): role is UserRole {
  return (
    role === "user" ||
    role === "deal" ||
    role === "admin" ||
    role === "onl" ||
    role === "tutien" ||
    role === "mod" ||
    role === "eco" ||
    role === "audit" ||
    role === "sgift" ||
    role === "ring"
  );
}

/** Roles được phép gắn làm extra (không mainadmin). */
export const EXTRA_ROLE_ALLOWED: UserRole[] = [
  "user",
  "deal",
  "admin",
  "onl",
  "tutien",
  "mod",
  "eco",
  "audit",
  "sgift",
  "ring",
];

/** Chuẩn hóa extraRoles: bỏ mainadmin, bỏ trùng primary, unique. */
export function normalizeExtraRoles(
  raw: unknown,
  primary: UserRole,
): UserRole[] {
  if (!Array.isArray(raw)) return [];
  const out: UserRole[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const r = String(x ?? "").trim();
    if (!r || r === "mainadmin" || r === primary) continue;
    if (!isAssignableStaffRole(r)) continue;
    if (seen.has(r)) continue;
    seen.add(r);
    out.push(r);
  }
  return out;
}

function isUserRecord(u: unknown): u is UserRecord {
  if (!u || typeof u !== "object") return false;
  const r = u as UserRecord;
  const roleOk =
    r.role === "user" ||
    r.role === "admin" ||
    r.role === "mainadmin" ||
    r.role === "deal" ||
    r.role === "onl" ||
    r.role === "tutien" ||
    r.role === "mod" ||
    r.role === "eco" ||
    r.role === "audit" ||
    r.role === "sgift" ||
    r.role === "ring";
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
    this.ensureStaffDefaultPasswordGuard();
    this.ensureRecoveryCodes();
    this.saveNow();
  }

  private ensureRecoveryCodes() {
    let n = 0;
    for (const u of this.byId.values()) {
      if (!u.recoveryCode) {
        u.recoveryCode = makeRecoveryCode();
        n += 1;
      }
    }
    if (n) console.log(`[auth] Assigned recovery codes to ${n} users`);
  }

  /**
   * Staff còn mật khẩu seed mặc định (hoặc mainadmin chưa từng set flag)
   * → bắt đổi MK. Production không tạo seed bằng fallback.
   */
  private ensureStaffDefaultPasswordGuard() {
    let changed = false;
    for (const u of this.byId.values()) {
      if (u.role === "mainadmin" && u.mustChangePassword === undefined) {
        u.mustChangePassword = true;
        changed = true;
      }
      if (!isStaffRole(u.role)) continue;
      const fallback = STAFF_SEED_FALLBACKS[u.username.toLowerCase()];
      if (!fallback) continue;
      if (!passwordMatches(u, fallback)) continue;
      if (!u.mustChangePassword) {
        u.mustChangePassword = true;
        changed = true;
      }
      if (IS_PROD) {
        console.warn(
          `[auth] ${u.username} vẫn dùng mật khẩu seed mặc định — bắt đổi MK`,
        );
      }
    }
    if (changed) this.scheduleSave();
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
        if (rec.cultivationRank && !isCultivationRank(rec.cultivationRank)) {
          delete rec.cultivationRank;
        }
        rec.extraRoles = normalizeExtraRoles(rec.extraRoles, rec.role);
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
          fallback: STAFF_SEED_FALLBACKS.mainadmin!,
          role: "mainadmin",
        },
        {
          user: "admin",
          env: "SEED_ADMIN_PASSWORD",
          fallback: STAFF_SEED_FALLBACKS.admin!,
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
      if (IS_PROD && STAFF_SEED_FALLBACKS[s.user] === password) {
        console.warn(
          `[auth] Skip seed ${s.user}: ${s.env} trùng mật khẩu mặc định — đặt mật khẩu mạnh`,
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
      mustChangePassword: isStaffRole(role),
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
    const v = validateUsername(username);
    if (!v.ok) return v;
    const name = v.username;
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
      recoveryCode: makeRecoveryCode(),
    };
    this.indexUser(user);
    this.scheduleSave();
    const token = this.issueToken(user.id);
    return { ok: true, user: toPublic(user, { includeRecovery: true, includePendingBond: true }), token };
  }

  login(
    username: string,
    password: string,
  ): { ok: true; user: PublicUser; token: string } | { ok: false; reason: string } {
    const user = this.users.get(username.trim().toLowerCase());
    if (!user) return { ok: false, reason: "Sai tài khoản hoặc mật khẩu" };
    if (!passwordMatches(user, password)) {
      return { ok: false, reason: "Sai tài khoản hoặc mật khẩu" };
    }
    if (user.banned) {
      return {
        ok: false,
        reason: user.banReason
          ? `Tài khoản bị khóa: ${user.banReason}`
          : "Tài khoản bị khóa",
      };
    }
    if (
      isStaffRole(user.role) &&
      STAFF_SEED_FALLBACKS[user.username.toLowerCase()] === password
    ) {
      user.mustChangePassword = true;
      this.scheduleSave();
    }
    ensureDay(user);
    return {
      ok: true,
      user: toPublic(user, { includePendingBond: true }),
      token: this.issueToken(user.id),
    };
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
    if (user.banned) {
      this.tokens.delete(token);
      this.scheduleTokenSave();
      return null;
    }
    return toPublic(user, { includePendingBond: true });
  }

  /** Xem userId của token (kể cả khi banned) — không thu hồi. */
  peekTokenUserId(token?: string | null): string | null {
    if (!token) return null;
    const entry = this.tokens.get(token);
    if (!entry) return null;
    if (Date.now() > entry.exp) return null;
    return entry.userId;
  }

  isBanned(userId: string): boolean {
    return !!this.byId.get(userId)?.banned;
  }

  isMuted(userId: string): boolean {
    const u = this.byId.get(userId);
    if (!u) return false;
    return (u.mutedUntil ?? 0) > Date.now();
  }

  getMuteRemainingMs(userId: string): number {
    const u = this.byId.get(userId);
    if (!u) return 0;
    return Math.max(0, (u.mutedUntil ?? 0) - Date.now());
  }

  setBanned(
    userId: string,
    banned: boolean,
    reason?: string,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.role === "mainadmin") {
      return { ok: false, reason: "Không khóa mainadmin" };
    }
    user.banned = !!banned;
    if (banned) {
      user.banReason = String(reason ?? "").trim().slice(0, 120) || "Vi phạm";
      user.bannedAt = Date.now();
      for (const [tok, entry] of this.tokens) {
        if (entry.userId === userId) this.tokens.delete(tok);
      }
      this.scheduleTokenSave();
    } else {
      delete user.banReason;
      delete user.bannedAt;
    }
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /**
   * Mainadmin: xóa hẳn tài khoản (không thể hoàn tác).
   * Phải gõ đúng username để xác nhận — không xóa mainadmin.
   */
  deleteUser(
    userId: string,
    confirmUsername: string,
  ):
    | { ok: true; username: string; code: string }
    | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.role === "mainadmin") {
      return { ok: false, reason: "Không xóa mainadmin" };
    }
    const confirm = String(confirmUsername ?? "").trim().toLowerCase();
    if (!confirm || confirm !== user.username.toLowerCase()) {
      return { ok: false, reason: "Username xác nhận không khớp" };
    }
    for (const [tok, entry] of this.tokens) {
      if (entry.userId === userId) this.tokens.delete(tok);
    }
    this.scheduleTokenSave();
    this.users.delete(user.username.toLowerCase());
    this.byId.delete(user.id);
    this.byCode.delete(user.code.toUpperCase());
    this.scheduleSave();
    return { ok: true, username: user.username, code: user.code };
  }

  /** Mainadmin: đổi role primary (không đụng mainadmin). Xóa role đó khỏi extras nếu có. */
  setUserRole(
    userId: string,
    role:
      | "user"
      | "deal"
      | "admin"
      | "onl"
      | "tutien"
      | "mod"
      | "eco"
      | "audit"
      | "sgift"
      | "ring",
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.role === "mainadmin") {
      return { ok: false, reason: "Không đổi role mainadmin" };
    }
    if (!isAssignableStaffRole(role)) {
      return { ok: false, reason: "Role không hợp lệ" };
    }
    user.role = role;
    user.extraRoles = normalizeExtraRoles(user.extraRoles, role);
    if (
      role === "admin" ||
      role === "eco" ||
      role === "audit" ||
      role === "sgift" ||
      role === "ring"
    ) {
      user.mustChangePassword = user.mustChangePassword ?? true;
    }
    this.revokeAllTokens(userId);
    this.scheduleSave();
    this.scheduleTokenSave();
    return { ok: true, user: toPublic(user) };
  }

  /**
   * Mainadmin: thay danh sách roles phụ (cộng dồn).
   * Không gắn mainadmin; không trùng primary; mainadmin account → chỉ `[]`.
   */
  setUserExtraRoles(
    userId: string,
    roles: unknown,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.role === "mainadmin") {
      const list = Array.isArray(roles) ? roles : [];
      if (list.length > 0) {
        return {
          ok: false,
          reason: "Mainadmin không gắn roles phụ",
        };
      }
      user.extraRoles = [];
      this.scheduleSave();
      return { ok: true, user: toPublic(user) };
    }
    if (!Array.isArray(roles)) {
      return { ok: false, reason: "extraRoles phải là mảng" };
    }
    for (const x of roles) {
      const r = String(x ?? "").trim();
      if (!r) continue;
      if (r === "mainadmin") {
        return { ok: false, reason: "Không gắn mainadmin làm role phụ" };
      }
      if (!isAssignableStaffRole(r)) {
        return { ok: false, reason: `Role phụ không hợp lệ: ${r}` };
      }
    }
    user.extraRoles = normalizeExtraRoles(roles, user.role);
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /** Mainadmin/admin: cấp Room# (1…5) để đóng phòng / đặt mật khẩu. */
  setVoiceRoomGrants(
    userId: string,
    rooms: unknown,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    const grants = normalizeVoiceRoomGrants(rooms);
    if (grants.length) user.voiceRoomGrants = grants;
    else delete user.voiceRoomGrants;
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /** Mainadmin: gán / xóa override bậc staff L0–L6. null = theo role. */
  setStaffGrantLevel(
    userId: string,
    level: unknown,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.role === "mainadmin") {
      return { ok: false, reason: "Không override bậc mainadmin" };
    }
    if (level === null || level === undefined || level === "") {
      delete user.staffGrantLevel;
    } else {
      const n = clampStaffGrantLevel(level);
      if (n < STAFF_GRANT_LEVEL_MIN || n > STAFF_GRANT_LEVEL_MAX) {
        return { ok: false, reason: "Bậc phải 0…6" };
      }
      user.staffGrantLevel = n;
    }
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /** Tu Tiên / mainadmin: gán hoặc xóa cảnh giới công khai. */
  setCultivationRank(
    userId: string,
    rank: CultivationRank | null,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.role === "mainadmin") {
      return { ok: false, reason: "Không gán cảnh giới cho mainadmin" };
    }
    if (rank === null) {
      delete user.cultivationRank;
      delete user.cultivationPaidUntil;
      delete user.cultivationLastChargeAt;
    } else if (!isCultivationRank(rank)) {
      return { ok: false, reason: "Cảnh giới không hợp lệ" };
    } else {
      user.cultivationRank = rank;
      const maint = cultivationStore.getMaintenanceFor(rank);
      user.cultivationPaidUntil = Date.now() + periodMs(maint.period);
    }
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /**
   * Thu phí duy trì đến hạn. Trả về số user đã charge / demote.
   * Gọi định kỳ từ index.ts.
   */
  processCultivationFees(): {
    charged: number;
    demoted: number;
  } {
    const now = Date.now();
    let charged = 0;
    let demoted = 0;
    for (const user of this.byId.values()) {
      if (!user.cultivationRank || !isCultivationRank(user.cultivationRank)) {
        continue;
      }
      const rank = user.cultivationRank;
      const paidUntil = user.cultivationPaidUntil ?? 0;
      if (paidUntil > now) continue;

      const maint = cultivationStore.getMaintenanceFor(rank);
      const fee = Math.max(0, Math.floor(maint.feeXu));
      const period = periodMs(maint.period);

      if (fee <= 0) {
        user.cultivationPaidUntil = now + period;
        user.cultivationLastChargeAt = now;
        charged += 1;
        continue;
      }

      if (user.balance >= fee) {
        user.balance -= fee;
        user.cultivationPaidUntil = now + period;
        user.cultivationLastChargeAt = now;
        vaultStore.recordCultivationFee(fee, user.id, user.username, rank);
        charged += 1;
      } else {
        const next = demoteRank(rank);
        if (next) {
          user.cultivationRank = next;
          const nextMaint = cultivationStore.getMaintenanceFor(next);
          user.cultivationPaidUntil = now + periodMs(nextMaint.period);
        } else {
          delete user.cultivationRank;
          delete user.cultivationPaidUntil;
          delete user.cultivationLastChargeAt;
        }
        demoted += 1;
      }
    }
    if (charged > 0 || demoted > 0) this.scheduleSave();
    return { charged, demoted };
  }

  getCultivationRank(userId: string): CultivationRank | null {
    const u = this.byId.get(userId);
    if (!u?.cultivationRank || !isCultivationRank(u.cultivationRank)) {
      return null;
    }
    return u.cultivationRank;
  }

  setMuted(
    userId: string,
    mutedUntil: number,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    const until = Math.max(0, Math.floor(mutedUntil));
    if (until <= Date.now()) {
      delete user.mutedUntil;
    } else {
      user.mutedUntil = until;
    }
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /** Quên MK: username + recovery code → đặt MK mới. */
  recoverPassword(
    username: string,
    recoveryCode: string,
    nextPassword: string,
  ): { ok: true } | { ok: false; reason: string } {
    const user = this.users.get(username.trim().toLowerCase());
    if (!user) return { ok: false, reason: "Sai tài khoản hoặc mã khôi phục" };
    if (user.banned) return { ok: false, reason: "Tài khoản bị khóa" };
    const code = String(recoveryCode ?? "")
      .trim()
      .toUpperCase();
    if (!user.recoveryCode || user.recoveryCode !== code) {
      return { ok: false, reason: "Sai tài khoản hoặc mã khôi phục" };
    }
    if (nextPassword.length < 6) {
      return { ok: false, reason: "Mật khẩu mới tối thiểu 6 ký tự" };
    }
    user.salt = randomBytes(16).toString("hex");
    user.passwordHash = hashPassword(nextPassword, user.salt);
    user.mustChangePassword = false;
    user.recoveryCode = makeRecoveryCode();
    this.scheduleSave();
    for (const [tok, entry] of this.tokens) {
      if (entry.userId === user.id) this.tokens.delete(tok);
    }
    this.scheduleTokenSave();
    return { ok: true };
  }

  /** Admin đặt MK tạm + bắt đổi; trả recoveryCode mới. */
  adminResetPassword(
    userId: string,
    nextPassword: string,
  ):
    | { ok: true; user: PublicUser; tempPassword: string }
    | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    const pw =
      String(nextPassword ?? "").trim() ||
      `Tmp${randomBytes(3).toString("hex")}`;
    if (pw.length < 6) {
      return { ok: false, reason: "Mật khẩu tối thiểu 6 ký tự" };
    }
    user.salt = randomBytes(16).toString("hex");
    user.passwordHash = hashPassword(pw, user.salt);
    user.mustChangePassword = true;
    user.recoveryCode = makeRecoveryCode();
    this.scheduleSave();
    for (const [tok, entry] of this.tokens) {
      if (entry.userId === userId) this.tokens.delete(tok);
    }
    this.scheduleTokenSave();
    return {
      ok: true,
      user: toPublic(user, { includeRecovery: true }),
      tempPassword: pw,
    };
  }

  /** Hiện lại mã khôi phục (user đã login). */
  revealRecoveryCode(
    userId: string,
  ): { ok: true; recoveryCode: string } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (!user.recoveryCode) {
      user.recoveryCode = makeRecoveryCode();
      this.scheduleSave();
    }
    return { ok: true, recoveryCode: user.recoveryCode };
  }

  /**
   * Mang xu/avatar từ phiên khách vào account.
   * Register: set balance (cap). Login: chỉ nâng nếu guestBalance > balance hiện tại.
   */
  mergeGuestIntoUser(
    userId: string,
    opts: { balance?: number; avatar?: string },
  ): { ok: true; user: PublicUser; mergedBalance: number } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    let mergedBalance = user.balance;
    if (opts.balance != null && Number.isFinite(opts.balance)) {
      const guestBal = Math.max(
        0,
        Math.min(GUEST_MERGE_BALANCE_CAP, Math.floor(opts.balance)),
      );
      if (guestBal > user.balance) {
        user.balance = guestBal;
        mergedBalance = guestBal;
      }
    }
    if (opts.avatar && isAllowedAvatar(opts.avatar)) {
      user.avatar = opts.avatar;
    }
    this.scheduleSave();
    return { ok: true, user: toPublic(user), mergedBalance };
  }

  private revokeAllTokens(userId: string) {
    for (const [tok, entry] of this.tokens) {
      if (entry.userId === userId) this.tokens.delete(tok);
    }
    this.scheduleTokenSave();
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
    winPct?: number,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (!isUserOutcomeMode(mode)) {
      return { ok: false, reason: "Mode không hợp lệ (normal|win|lose)" };
    }
    user.outcomeMode = mode;
    if (mode === "win") {
      user.outcomeWinPct =
        winPct != null
          ? clampOutcomeWinPct(winPct)
          : clampOutcomeWinPct(user.outcomeWinPct);
    }
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /** Cập nhật % ép thắng (80–100); tự bật mode win. */
  setOutcomeWinPct(
    userId: string,
    winPct: number,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    user.outcomeMode = "win";
    user.outcomeWinPct = clampOutcomeWinPct(winPct);
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  getOutcomeMode(userId: string): UserOutcomeMode {
    const user = this.byId.get(userId);
    return normalizeOutcomeMode(user?.outcomeMode);
  }

  getOutcomeWinPct(userId: string): number {
    const user = this.byId.get(userId);
    return clampOutcomeWinPct(user?.outcomeWinPct);
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

  isHiddenFromLeaderboard(userId?: string | null): boolean {
    if (!userId) return false;
    return !!this.byId.get(userId)?.hideFromLeaderboard;
  }

  setHideFromLeaderboard(
    userId: string,
    hidden: boolean,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    user.hideFromLeaderboard = !!hidden;
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  setHideNickname(
    userId: string,
    hidden: boolean,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    user.hideNickname = !!hidden;
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

  /** +1 ván lifetime khi user có đặt xu và round settle. */
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

  getTarotStreaks(userId: string): { loss: number; win: number } {
    const user = this.byId.get(userId);
    return {
      loss: Math.max(0, Math.floor(user?.tarotLossStreak ?? 0)),
      win: Math.max(0, Math.floor(user?.tarotWinStreak ?? 0)),
    };
  }

  setTarotStreaks(userId: string, loss: number, win: number) {
    const user = this.byId.get(userId);
    if (!user) return;
    user.tarotLossStreak = Math.max(0, Math.floor(loss));
    user.tarotWinStreak = Math.max(0, Math.floor(win));
    this.scheduleSave();
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
    this.revokeAllTokens(userId);
    return { ok: true };
  }

  getById(id: string): UserRecord | undefined {
    return this.byId.get(id);
  }

  /** Thẻ công khai (avatar, ID, VIP) — popup profile / tra cứu nhẹ. */
  getPublicCard(opts: {
    userId?: string;
    code?: string;
  }):
    | {
        userId: string;
        username: string;
        displayName: string;
        code: string;
        avatar: string;
        isVip: boolean;
        vipGranted: boolean;
        roundsPlayed: number;
        cultivationRank?: CultivationRank;
        nameColor?: string;
        nameEffect?: string;
        avatarFrame?: string;
        profileTheme?: string;
        nameFrame?: string;
        idFrame?: string;
      }
    | null {
    const id = String(opts.userId ?? "").trim();
    const code = String(opts.code ?? "")
      .trim()
      .toUpperCase();
    const user = id
      ? this.byId.get(id)
      : code
        ? this.getByCode(code)
        : undefined;
    if (!user) return null;
    ensureDay(user);
    const card: {
      userId: string;
      username: string;
      displayName: string;
      code: string;
      avatar: string;
      isVip: boolean;
      vipGranted: boolean;
      roundsPlayed: number;
      cultivationRank?: CultivationRank;
      nameColor?: string;
      nameEffect?: string;
      avatarFrame?: string;
      profileTheme?: string;
      nameFrame?: string;
      idFrame?: string;
    } = {
      userId: user.id,
      username: user.username,
      displayName: userDisplayName(user),
      code: user.code,
      avatar: normalizeAvatar(user.avatar),
      isVip: computeIsVip(user),
      vipGranted: !!user.vipGranted,
      roundsPlayed: Math.max(0, Math.floor(user.roundsPlayed ?? 0)),
    };
    if (user.cultivationRank && isCultivationRank(user.cultivationRank)) {
      card.cultivationRank = user.cultivationRank;
    }
    const nc = normalizeNameColor(user.nameColor);
    if (nc !== "default") card.nameColor = nc;
    const ne = normalizeNameEffect(user.nameEffect);
    if (ne !== "none") card.nameEffect = ne;
    const af = normalizeAvatarFrame(user.avatarFrame);
    if (af !== "none") card.avatarFrame = af;
    const pt = normalizeProfileTheme(user.profileTheme);
    if (pt !== "cosmic") card.profileTheme = pt;
    const nf = normalizeNameFrame(user.nameFrame);
    if (nf !== "none") card.nameFrame = nf;
    const idf = normalizeIdFrame(user.idFrame);
    if (idf !== "classic") card.idFrame = idf;
    return card;
  }

  /**
   * Ghi IP vào account (login / join). Không đưa vào toPublic — chỉ API mainadmin.
   */
  recordIp(userId: string, ipRaw: string): void {
    const ip = String(ipRaw ?? "").trim();
    if (!ip || ip === "unknown") return;
    const user = this.byId.get(userId);
    if (!user) return;
    const now = Date.now();
    user.lastIp = ip;
    user.lastIpAt = now;
    if (!Array.isArray(user.ipHistory)) user.ipHistory = [];
    const hit = user.ipHistory.find((x) => x.ip === ip);
    if (hit) {
      hit.lastAt = now;
      hit.hits += 1;
      user.ipHistory = [hit, ...user.ipHistory.filter((x) => x.ip !== ip)];
    } else {
      user.ipHistory.unshift({ ip, firstAt: now, lastAt: now, hits: 1 });
    }
    if (user.ipHistory.length > IP_HISTORY_CAP) {
      user.ipHistory.length = IP_HISTORY_CAP;
    }
    this.scheduleSave();
  }

  /** Snapshot lịch sử IP cho mainadmin (không qua toPublic). */
  getIpIntel(userId: string): {
    lastIp?: string;
    lastIpAt?: number;
    ipHistory: IpHistoryEntry[];
  } | null {
    const user = this.byId.get(userId);
    if (!user) return null;
    return {
      lastIp: user.lastIp,
      lastIpAt: user.lastIpAt,
      ipHistory: Array.isArray(user.ipHistory)
        ? user.ipHistory.map((x) => ({ ...x }))
        : [],
    };
  }

  getByCode(code: string): UserRecord | undefined {
    return this.byCode.get(String(code ?? "").trim().toUpperCase());
  }

  getByUsername(username: string): UserRecord | undefined {
    return this.users.get(String(username ?? "").trim().toLowerCase());
  }

  /** Tìm user theo username / code / id (partial, không phân biệt hoa thường). */
  searchUsers(query: string, limit = 30): PublicUser[] {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) return [];
    const out: PublicUser[] = [];
    for (const u of this.byId.values()) {
      const hay = `${u.username} ${u.code} ${u.id}`.toLowerCase();
      if (!hay.includes(q)) continue;
      out.push(toPublic(u));
      if (out.length >= limit) break;
    }
    return out;
  }

  listUsers(): PublicUser[] {
    return [...this.byId.values()].map((u) => toPublic(u));
  }

  getAccountStats() {
    let users = 0;
    let deals = 0;
    let admins = 0;
    let mainadmins = 0;
    let ecos = 0;
    let audits = 0;
    let balanceTotal = 0;
    for (const u of this.byId.values()) {
      balanceTotal += u.balance;
      if (u.role === "mainadmin") mainadmins += 1;
      else if (u.role === "admin") admins += 1;
      else if (u.role === "eco") ecos += 1;
      else if (u.role === "audit") audits += 1;
      else if (u.role === "deal") deals += 1;
      else users += 1;
    }
    return {
      totalAccounts: this.byId.size,
      playerAccounts: users,
      dealAccounts: deals,
      adminAccounts: admins,
      mainadminAccounts: mainadmins,
      ecoAccounts: ecos,
      auditAccounts: audits,
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

  /** Đổi username — login bằng tên mới; mã ID không đổi. */
  renameUsername(
    userId: string,
    newUsername: string,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.banned) {
      return { ok: false, reason: "Tài khoản bị khóa" };
    }
    const v = validateUsername(newUsername);
    if (!v.ok) return v;
    if (user.username.toLowerCase() === v.username.toLowerCase()) {
      return { ok: true, user: toPublic(user) };
    }
    const renamesUsed = Math.max(0, Math.floor(user.usernameRenames ?? 0));
    if (renamesUsed >= USERNAME_RENAME_MAX) {
      return {
        ok: false,
        reason: `Đã đổi username tối đa ${USERNAME_RENAME_MAX} lần`,
      };
    }
    if (this.users.has(v.username.toLowerCase())) {
      return { ok: false, reason: "Username đã tồn tại" };
    }
    this.users.delete(user.username.toLowerCase());
    user.username = v.username;
    user.usernameRenames = renamesUsed + 1;
    this.users.set(v.username.toLowerCase(), user);
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /** Đổi nickname hiển thị trong game — để trống = dùng username. */
  setNickname(
    userId: string,
    raw: string,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.banned) {
      return { ok: false, reason: "Tài khoản bị khóa" };
    }
    const v = validateNickname(raw);
    if (!v.ok) return v;
    if (v.nickname) user.nickname = v.nickname;
    else delete user.nickname;
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /** RoleAD: gán màu / hiệu ứng nick + khung avatar + nền hồ sơ. */
  setUserCosmetics(
    userId: string,
    opts: {
      color?: unknown;
      effect?: unknown;
      avatarFrame?: unknown;
      profileTheme?: unknown;
      nameFrame?: unknown;
      idFrame?: unknown;
    },
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };

    if (opts.color !== undefined) {
      const color = normalizeNameColor(opts.color) as NameColorId;
      if (color === "default") delete user.nameColor;
      else user.nameColor = color;
    }
    if (opts.effect !== undefined) {
      const effect = normalizeNameEffect(opts.effect) as NameEffectId;
      if (effect === "none") delete user.nameEffect;
      else user.nameEffect = effect;
    }
    if (opts.avatarFrame !== undefined) {
      const frame = normalizeAvatarFrame(opts.avatarFrame) as AvatarFrameId;
      if (frame === "none") delete user.avatarFrame;
      else user.avatarFrame = frame;
    }
    if (opts.profileTheme !== undefined) {
      const theme = normalizeProfileTheme(opts.profileTheme) as ProfileThemeId;
      if (theme === "cosmic") delete user.profileTheme;
      else user.profileTheme = theme;
    }
    if (opts.nameFrame !== undefined) {
      const nf = normalizeNameFrame(opts.nameFrame) as NameFrameId;
      if (nf === "none") delete user.nameFrame;
      else user.nameFrame = nf;
    }
    if (opts.idFrame !== undefined) {
      const idf = normalizeIdFrame(opts.idFrame) as IdFrameId;
      if (idf === "classic") delete user.idFrame;
      else user.idFrame = idf;
    }

    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /** RoleAD: gán màu nick công khai. */
  setNameColor(
    userId: string,
    colorRaw: unknown,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    return this.setUserCosmetics(userId, { color: colorRaw });
  }

  adjustBalance(
    userId: string,
    delta: number,
  ): { ok: true; user: PublicUser } | { ok: false; reason: string } {
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    const next = user.balance + Math.floor(delta);
    if (next < 0) return { ok: false, reason: "Số dư không đủ để trừ" };
    if (next > ACCOUNT_BALANCE_MAX) {
      return {
        ok: false,
        reason: `Số dư tối đa ${ACCOUNT_BALANCE_MAX.toLocaleString("vi-VN")} xu`,
      };
    }
    user.balance = next;
    this.scheduleSave();
    return { ok: true, user: toPublic(user) };
  }

  /**
   * Trừ xu giải trí (nhẫn…) — không chuyển cho ai.
   */
  spendXu(
    userId: string,
    amountRaw: unknown,
  ):
    | { ok: true; user: PublicUser; amount: number }
    | { ok: false; reason: string } {
    const amount = Math.floor(Number(amountRaw));
    if (!Number.isFinite(amount) || amount < MIN_STAKE) {
      return { ok: false, reason: `Tối thiểu ${MIN_STAKE} xu` };
    }
    if (amount > GIFT_XU_MAX) {
      return {
        ok: false,
        reason: `Tối đa ${GIFT_XU_MAX.toLocaleString("vi-VN")} xu / lần`,
      };
    }
    const user = this.byId.get(userId);
    if (!user) return { ok: false, reason: "Không tìm thấy user" };
    if (user.banned) return { ok: false, reason: "Tài khoản bị khóa" };
    if (user.balance < amount) {
      return { ok: false, reason: "Số dư không đủ" };
    }
    user.balance -= amount;
    this.scheduleSave();
    return { ok: true, user: toPublic(user, { includePendingBond: true }), amount };
  }

  /** Resolve user by id / code / username. */
  resolveUserRef(ref: {
    userId?: string;
    code?: string;
    username?: string;
  }): UserRecord | undefined {
    const tid = String(ref.userId ?? "").trim();
    const code = String(ref.code ?? "").trim();
    const username = String(ref.username ?? "").trim().toLowerCase();
    if (tid) return this.byId.get(tid);
    if (code) return this.getByCode(code);
    if (username) return this.users.get(username);
    return undefined;
  }

  /**
   * Tặng xu P2P — zero-sum, không đụng vault.
   * amount ≥ MIN_STAKE, ≤ GIFT_XU_MAX.
   */
  giftXu(
    fromId: string,
    toRef: { userId?: string; code?: string; username?: string },
    amountRaw: unknown,
  ):
    | {
        ok: true;
        from: PublicUser;
        to: PublicUser;
        amount: number;
      }
    | { ok: false; reason: string } {
    const amount = Math.floor(Number(amountRaw));
    if (!Number.isFinite(amount) || amount < MIN_STAKE) {
      return { ok: false, reason: `Tối thiểu ${MIN_STAKE} xu` };
    }
    if (amount > GIFT_XU_MAX) {
      return {
        ok: false,
        reason: `Tối đa ${GIFT_XU_MAX.toLocaleString("vi-VN")} xu / lần`,
      };
    }
    const from = this.byId.get(fromId);
    if (!from) return { ok: false, reason: "Không tìm thấy người gửi" };
    if (from.banned) return { ok: false, reason: "Tài khoản bị khóa" };

    let to: UserRecord | undefined;
    const tid = String(toRef.userId ?? "").trim();
    const code = String(toRef.code ?? "").trim();
    const username = String(toRef.username ?? "").trim().toLowerCase();
    if (tid) to = this.byId.get(tid);
    else if (code) to = this.getByCode(code);
    else if (username) to = this.users.get(username);
    if (!to) return { ok: false, reason: "Không tìm thấy người nhận" };
    if (to.banned) return { ok: false, reason: "Người nhận bị khóa" };
    if (to.id === from.id) {
      return { ok: false, reason: "Không thể tự tặng xu" };
    }
    if (from.balance < amount) {
      return { ok: false, reason: "Số dư không đủ" };
    }
    if (to.balance + amount > ACCOUNT_BALANCE_MAX) {
      return {
        ok: false,
        reason: `Người nhận đã gần trần ${ACCOUNT_BALANCE_MAX.toLocaleString("vi-VN")} xu`,
      };
    }

    from.balance -= amount;
    to.balance += amount;
    this.scheduleSave();
    return {
      ok: true,
      from: toPublic(from),
      to: toPublic(to),
      amount,
    };
  }

  /**
   * BXH xu đang cầm — top balance, tôn trọng hideFromLeaderboard.
   */
  listBalanceLeaders(
    limit = 20,
    viewerUserId?: string,
  ): {
    rank: number;
    name: string;
    avatar: string;
    balance: number;
    isYou?: boolean;
    userId?: string;
    code?: string;
  }[] {
    const cap = Math.max(1, Math.min(50, Math.floor(limit) || 20));
    const rows: {
      id: string;
      name: string;
      avatar: string;
      balance: number;
      code: string;
    }[] = [];
    for (const u of this.byId.values()) {
      if (u.hideFromLeaderboard) continue;
      if (u.banned) continue;
      if (u.balance <= 0) continue;
      rows.push({
        id: u.id,
        name: userDisplayName(u),
        avatar: normalizeAvatar(u.avatar),
        balance: u.balance,
        code: u.code,
      });
    }
    rows.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
    return rows.slice(0, cap).map((r, i) => ({
      rank: i + 1,
      name: r.name,
      avatar: r.avatar,
      balance: r.balance,
      userId: r.id,
      code: r.code,
      isYou: !!viewerUserId && r.id === viewerUserId,
    }));
  }

  setBalance(userId: string, balance: number) {
    const user = this.byId.get(userId);
    if (!user) return;
    user.balance = Math.max(
      0,
      Math.min(ACCOUNT_BALANCE_MAX, Math.floor(balance)),
    );
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
    user.balance = Math.max(
      0,
      Math.min(ACCOUNT_BALANCE_MAX, Math.floor(balance)),
    );
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
        username: userDisplayName(u),
        avatar: normalizeAvatar(u.avatar),
        stakeWeek: u.stakeWeek,
      });
    }
    return out;
  }
}

export const authStore = new AuthStore();

setBondPartnerResolver((userId, includePending) => {
  return ringStore.bondSnippetFor(
    userId,
    (partnerId) => {
      const u = authStore.getById(partnerId);
      if (!u) return null;
      return {
        id: u.id,
        code: u.code,
        username: u.username,
        displayName: userDisplayName(u),
        avatar: normalizeAvatar(u.avatar),
      };
    },
    { includePending },
  );
});

/** admin|mainadmin primary hoặc extra admin. */
export function isStaff(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  if (!user) return false;
  return userHasAnyRole(user, ["admin", "mainadmin"]);
}

export function isMod(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  return userHasRole(user, "mod");
}

/**
 * Điều hành khu vực Room voice: mainadmin, mod, hoặc admin.
 * (Host phòng vẫn có quyền riêng khi đang ngồi ghế.)
 */
export function canModerateVoiceRoom(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "voice_mod");
}

/** Tab Room trên dashboard — mainadmin hoặc mod (hoặc L3+ override). */
export function canAccessRoomAdmin(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "room_admin_tab");
}

/** Xem số online + danh sách người chơi (không gồm công cụ admin). */
export function canSeeOnline(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "see_online");
}

export function isOnlineViewer(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  return userHasRole(user, "onl");
}

export function isTutien(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  return userHasRole(user, "tutien");
}

/** Gán cảnh giới / sửa bảng màu — Tu Tiên hoặc mainadmin. */
export function canManageCultivation(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "cultivation_manage");
}

/** Chỉ primary mainadmin. */
export function isMainAdmin(
  user: { role: UserRole } | null | undefined,
): boolean {
  return user?.role === "mainadmin";
}

export function isEco(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  return userHasRole(user, "eco");
}

export function isAudit(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  return userHasRole(user, "audit");
}

export function isSGift(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  return userHasRole(user, "sgift");
}

/** Dashboard staff (admin/main/eco/audit/sgift) — không gồm deal/mod/tutien. */
export function canAccessStaffDashboard(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "staff_dashboard");
}

export function isBalanceOperator(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "balance_ops");
}
