export type UserRole = "user" | "admin" | "mainadmin" | "deal";

export interface AuthUser {
  id: string;
  /** Mã user duy nhất (vd U7K2M9AB) */
  code: string;
  username: string;
  role: UserRole;
  avatar: string;
  balance: number;
  winToday: number;
  guessesToday: number;
  stakeWeek?: number;
  weekKey?: string;
  mustChangePassword?: boolean;
  /** Admin: lose | normal | win */
  outcomeMode?: "normal" | "win" | "lose";
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
}

/** Ngưỡng VIP tự động — đồng bộ server */
export const VIP_ROUNDS_REQUIRED = 10_000;

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

export function isStaff(user: { role: UserRole } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "mainadmin";
}

export function isBalanceOperator(
  user: { role: UserRole } | null | undefined,
): boolean {
  if (!user) return false;
  return (
    user.role === "admin" ||
    user.role === "mainadmin" ||
    user.role === "deal"
  );
}

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
  if (user.role === "deal") return `/deal/${code}`;
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
