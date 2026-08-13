/** Mã thiết bị ổn định (trình duyệt) — gửi server để staff khóa nếu cần. */

const DEVICE_ID_KEY = "tarot_device_id";

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ensureDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[a-f0-9]{16,64}$/i.test(existing)) {
      return existing.toLowerCase();
    }
  } catch {
    /* ignore */
  }
  const id = randomHex(16);
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

export function getDeviceMeta(): {
  platform: string;
  screen: string;
  timezone: string;
  language: string;
  ua: string;
} {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const scr = typeof screen !== "undefined" ? screen : undefined;
  return {
    platform: nav?.platform ?? "",
    screen: scr ? `${scr.width}x${scr.height}` : "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    language: nav?.language ?? "",
    ua: nav?.userAgent?.slice(0, 120) ?? "",
  };
}

/** Payload gửi kèm login / socket join. */
export function getDevicePayload(): {
  deviceId: string;
  device: ReturnType<typeof getDeviceMeta>;
} {
  return {
    deviceId: ensureDeviceId(),
    device: getDeviceMeta(),
  };
}
