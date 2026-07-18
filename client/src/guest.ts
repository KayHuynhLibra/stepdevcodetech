/** Phiên khách (chơi nhanh) — mỗi thiết bị/trình duyệt có mã riêng. */

const GUEST_CODE_KEY = "tarot_guest_code";
const GUEST_NAME_KEY = "tarot_guest_name";

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
