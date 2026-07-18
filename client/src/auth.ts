export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  balance: number;
  winToday: number;
  guessesToday: number;
}

const TOKEN_KEY = "tarot_token";
const USER_KEY = "tarot_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
