import {
  canControlVoiceRoomLock as grantsCanControlVoiceRoomLock,
  hasCapability,
  userHasAnyRole,
  userHasRole,
} from "./grants";

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

export interface AuthUser {
  id: string;
  /** Mã user duy nhất (vd U7K2M9AB) */
  code: string;
  username: string;
  nickname?: string;
  /** Tên hiển thị chính trong game */
  displayName?: string;
  role: UserRole;
  /** Roles phụ — cộng dồn capability */
  extraRoles?: UserRole[];
  avatar: string;
  balance: number;
  winToday: number;
  guessesToday: number;
  stakeWeek?: number;
  weekKey?: string;
  mustChangePassword?: boolean;
  /** Admin: lose | normal | win */
  outcomeMode?: "normal" | "win" | "lose";
  /** Khi win: xác suất ép thắng 80–100 (mặc định 100) */
  outcomeWinPct?: number;
  /** Số ván lifetime */
  roundsPlayed?: number;
  /** Admin cấp VIP */
  vipGranted?: boolean;
  /** VIP hiệu lực (admin hoặc đủ 10k ván) */
  isVip?: boolean;
  banned?: boolean;
  banReason?: string;
  muted?: boolean;
  mutedUntil?: number;
  recoveryCode?: string;
  /** Mainadmin: ẩn khỏi BXH (chỉ trong admin list) */
  hideFromLeaderboard?: boolean;
  hideNickname?: boolean;
  usernameRenamesUsed?: number;
  usernameRenamesLeft?: number;
  /** Cảnh giới Tu Tiên (công khai) */
  cultivationRank?: string | null;
  /** Room# được cấp để đóng phòng / đặt MK (1…5) */
  voiceRoomGrants?: number[];
  /** Override bậc staff 0–6; thiếu → theo role */
  staffGrantLevel?: number;
  /** Cặp đôi / nhẫn */
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
    since: number;
    status: "pending" | "active";
  };
}

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
} from "./grants";

/** Ngưỡng VIP tự động — đồng bộ server */
export const VIP_ROUNDS_REQUIRED = 10_000;

export const USERNAME_RENAME_MAX = 5;

const TOKEN_KEY = "tarot_token";
const USER_KEY = "tarot_user";

/** Route auth — tách URL để tránh lẫn session login vs đổi MK bắt buộc */
export const AUTH_LOGIN = "/login";
export const AUTH_REGISTER = "/register";
export const AUTH_RECOVER = "/recover";
export const AUTH_CHANGE_PASSWORD = "/change-password";

/** Sau khi có session: dashboard hoặc bước đổi MK bắt buộc */
export function postAuthPath(
  user: { role: UserRole; code?: string; id: string; mustChangePassword?: boolean } | null,
): string {
  if (!user) return AUTH_LOGIN;
  if (user.mustChangePassword) return AUTH_CHANGE_PASSWORD;
  return homePath(user);
}

export function userShowsVip(
  user:
    | Pick<AuthUser, "isVip" | "vipGranted" | "roundsPlayed">
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (user.isVip) return true;
  if (user.vipGranted) return true;
  return (user.roundsPlayed ?? 0) >= VIP_ROUNDS_REQUIRED;
}

/** Tên chính trên bàn — nickname hoặc username. */
export function userDisplayName(
  user:
    | Pick<AuthUser, "username" | "nickname" | "displayName">
    | null
    | undefined,
): string {
  if (!user) return "";
  if (user.displayName?.trim()) return user.displayName.trim();
  const nick = String(user.nickname ?? "").trim();
  if (nick.length >= 2) return nick.slice(0, 12);
  return user.username;
}

export function isStaff(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  if (!user) return false;
  return userHasAnyRole(user, ["admin", "mainadmin"]);
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

export function isRing(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  return userHasRole(user, "ring");
}

/** Dashboard admin/main/eco/audit/sgift/ring — không gồm deal/mod/tutien. */
export function canAccessStaffDashboard(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "staff_dashboard");
}

export function isMod(
  user: { role: UserRole; extraRoles?: UserRole[] } | null | undefined,
): boolean {
  return userHasRole(user, "mod");
}

/** Điều hành Room voice (trong hub / API). */
export function canModerateVoiceRoom(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "voice_mod");
}

/** Tab Room trên dashboard — mainadmin hoặc mod. */
export function canAccessRoomAdmin(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "room_admin_tab");
}

/** Mainadmin (L6) hoặc đã được cấp đúng Room#. */
export function canControlVoiceRoomLock(
  user:
    | {
        role: UserRole;
        extraRoles?: UserRole[];
        voiceRoomGrants?: number[];
        staffGrantLevel?: number;
      }
    | null
    | undefined,
  roomId: number,
): boolean {
  return grantsCanControlVoiceRoomLock(user, roomId);
}

export function canGrantVoiceRooms(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "grant_rooms");
}

/** Staff hoặc role Onl — thấy số người online trên bàn. */
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

export function canManageCultivation(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "cultivation_manage");
}

export function isBalanceOperator(
  user:
    | { role: UserRole; extraRoles?: UserRole[]; staffGrantLevel?: number }
    | null
    | undefined,
): boolean {
  return hasCapability(user, "balance_ops");
}

/** Chỉ primary mainadmin. */
export function isMainAdmin(user: { role: UserRole } | null | undefined): boolean {
  return user?.role === "mainadmin";
}

function userCode(user: { code?: string; id: string }): string {
  return (user.code || user.id).toUpperCase();
}

/** Trang chủ theo role + mã user riêng. */
export function homePath(
  user: { role: UserRole; code?: string; id: string } | null | undefined,
): string {
  if (!user) return "/login";
  const code = userCode(user);
  if (user.role === "mainadmin") return `/mainadmin/${code}`;
  if (user.role === "admin") return `/admin/${code}`;
  if (user.role === "eco") return `/eco/${code}`;
  if (user.role === "audit") return `/audit/${code}`;
  if (user.role === "sgift") return `/sgift/${code}`;
  if (user.role === "ring") return `/ring/${code}`;
  if (user.role === "deal") return `/deal/${code}`;
  if (user.role === "tutien") return `/tutien/${code}`;
  if (user.role === "mod") return `/mod/${code}`;
  return `/player/${code}`;
}

/** Bàn chơi theo role + mã user (guest → /play). */
export function playPath(
  user: { role: UserRole; code?: string; id: string } | null | undefined,
): string {
  if (!user) return "/play";
  return `${homePath(user)}/play`;
}

/** Bàn Bánh xe Arcana theo role + mã user. */
export function arcanaPath(
  user: { role: UserRole; code?: string; id: string } | null | undefined,
): string {
  if (!user) return "/login";
  return `${homePath(user)}/arcana`;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as AuthUser;
    if (!u.code && u.id) u.code = u.id.toUpperCase();
    return u;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  const token = getToken();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (token) {
    void fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

export async function changePassword(
  currentPassword: string,
  nextPassword: string,
): Promise<{ ok: boolean; reason?: string }> {
  return api("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, nextPassword }),
  });
}

export async function recoverPassword(
  username: string,
  recoveryCode: string,
  nextPassword: string,
): Promise<{ ok: boolean; reason?: string; message?: string }> {
  return api("/api/auth/recover-password", {
    method: "POST",
    body: JSON.stringify({ username, recoveryCode, nextPassword }),
  });
}

export async function fetchRecoveryCode(): Promise<{
  ok: boolean;
  recoveryCode?: string;
  reason?: string;
}> {
  return api("/api/auth/recovery-code", { method: "POST" });
}

/** Payload mang từ phiên khách khi đăng nhập / đăng ký. */
export function guestMergeFields(extra?: {
  balance?: number;
  avatar?: string;
}): { guestBalance?: number; guestAvatar?: string } {
  const out: { guestBalance?: number; guestAvatar?: string } = {};
  if (extra?.balance != null && Number.isFinite(extra.balance)) {
    out.guestBalance = Math.max(0, Math.floor(extra.balance));
  }
  if (extra?.avatar) out.guestAvatar = extra.avatar;
  return out;
}

export async function api<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && opts.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(path, { ...opts, headers });
  } catch {
    throw new Error(
      "Không kết nối được API — hãy chạy server (port 3001) hoặc kiểm tra mạng.",
    );
  }

  const text = await res.text();
  let data: T & { ok?: boolean; reason?: string };
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Server trả về rỗng — kiểm tra server có đang chạy không."
        : `Lỗi HTTP ${res.status} — server có thể chưa bật (port 3001).`,
    );
  }
  try {
    data = JSON.parse(text) as T & { ok?: boolean; reason?: string };
  } catch {
    throw new Error(
      "Phản hồi không phải JSON — thường do API chưa chạy hoặc proxy sai.",
    );
  }
  if (!res.ok) {
    throw new Error(
      (data as { reason?: string }).reason || `HTTP ${res.status}`,
    );
  }
  return data;
}
