export type UserRole = "user" | "admin" | "mainadmin";

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
}

/** Ngưỡng VIP tự động — đồng bộ server */
export const VIP_ROUNDS_REQUIRED = 10_000;

const TOKEN_KEY = "tarot_token";
const USER_KEY = "tarot_user";

export function isStaff(user: { role: UserRole } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "mainadmin";
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
  return `/player/${code}`;
}

/** Bàn chơi theo role + mã user (guest → /play). */
export function playPath(
  user: { role: UserRole; code?: string; id: string } | null | undefined,
): string {
  if (!user) return "/play";
  return `${homePath(user)}/play`;
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

  const res = await fetch(path, { ...opts, headers });
  const data = (await res.json()) as T & { ok?: boolean; reason?: string };
  if (!res.ok) {
    throw new Error(
      (data as { reason?: string }).reason || `HTTP ${res.status}`,
    );
  }
  return data;
}
