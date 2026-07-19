/** Phiên khách (chơi nhanh) — mỗi thiết bị/trình duyệt có mã riêng. */

import { DEFAULT_AVATAR, normalizeAvatar } from "./avatars";

const GUEST_CODE_KEY = "tarot_guest_code";
const GUEST_NAME_KEY = "tarot_guest_name";
const GUEST_AVATAR_KEY = "tarot_guest_avatar";
const GUEST_BALANCE_KEY = "tarot_guest_balance";
const GUEST_MERGE_FLAG = "tarot_guest_merge_pending";

function makeGuestCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  let out = "G";
  for (let i = 0; i < 7; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Lấy hoặc tạo mã khách duy nhất trên trình duyệt này. */
export function ensureGuestCode(): string {
  try {
    const existing = localStorage.getItem(GUEST_CODE_KEY);
    if (existing && /^G[A-Z0-9]{7}$/i.test(existing)) {
      return existing.toUpperCase();
    }
  } catch {
    /* ignore */
  }
  const code = makeGuestCode();
  try {
    localStorage.setItem(GUEST_CODE_KEY, code);
  } catch {
    /* ignore */
  }
  return code;
}

export function getGuestCode(): string | null {
  try {
    const c = localStorage.getItem(GUEST_CODE_KEY);
    return c && /^G[A-Z0-9]{7}$/i.test(c) ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function guestPlayPath(code?: string | null): string {
  const c = (code || ensureGuestCode()).toUpperCase();
  return `/guest/${c}/play`;
}

export function getGuestName(): string {
  try {
    return localStorage.getItem(GUEST_NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function setGuestName(name: string) {
  try {
    localStorage.setItem(GUEST_NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

export function getGuestAvatar(): string {
  try {
    return normalizeAvatar(localStorage.getItem(GUEST_AVATAR_KEY));
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function setGuestAvatar(avatar: string) {
  const next = normalizeAvatar(avatar);
  try {
    localStorage.setItem(GUEST_AVATAR_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

/** Cập nhật số dư khách (để mang sang account khi đăng ký/đăng nhập). */
export function setGuestBalanceHint(balance: number) {
  try {
    localStorage.setItem(
      GUEST_BALANCE_KEY,
      String(Math.max(0, Math.floor(balance))),
    );
    localStorage.setItem(GUEST_MERGE_FLAG, "1");
  } catch {
    /* ignore */
  }
}

export function getGuestMergePayload(): {
  guestBalance?: number;
  guestAvatar?: string;
} {
  try {
    if (localStorage.getItem(GUEST_MERGE_FLAG) !== "1") return {};
    const bal = Number(localStorage.getItem(GUEST_BALANCE_KEY));
    const avatar = getGuestAvatar();
    return {
      guestBalance: Number.isFinite(bal) ? bal : undefined,
      guestAvatar: avatar || undefined,
    };
  } catch {
    return {};
  }
}

export function clearGuestMergePending() {
  try {
    localStorage.removeItem(GUEST_MERGE_FLAG);
    localStorage.removeItem(GUEST_BALANCE_KEY);
  } catch {
    /* ignore */
  }
}
