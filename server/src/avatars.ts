import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const DEFAULT_AVATAR = "/assets/ui/avatar-default.png";

/** Danh sách avatar mặc định (allowlist). */
export const AVATARS: string[] = [
  DEFAULT_AVATAR,
  "/assets/avatars/avatar-01.svg",
  "/assets/avatars/avatar-02.svg",
  "/assets/avatars/avatar-03.svg",
  "/assets/avatars/avatar-04.svg",
  "/assets/avatars/avatar-05.svg",
  "/assets/avatars/avatar-06.svg",
  "/assets/avatars/avatar-07.svg",
  "/assets/avatars/avatar-08.svg",
];

/** Avatar upload: /uploads/avatars/{id}.jpg|png|webp */
const CUSTOM_AVATAR_RE =
  /^\/uploads\/avatars\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i;

const MAX_UPLOAD_BYTES = 800_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = join(__dirname, "..", "data", "uploads", "avatars");

export function avatarPathOnly(path: string): string {
  return path.split("?")[0] || path;
}

export function isCustomAvatar(path?: string | null): boolean {
  if (!path) return false;
  return CUSTOM_AVATAR_RE.test(avatarPathOnly(path));
}

export function isAllowedAvatar(path?: string | null): boolean {
  if (!path) return false;
  const p = avatarPathOnly(path);
  return AVATARS.includes(p) || CUSTOM_AVATAR_RE.test(p);
}

export function normalizeAvatar(path?: string | null): string {
  if (path && isAllowedAvatar(path)) return path;
  return DEFAULT_AVATAR;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safeKey(raw: string): string | null {
  const key = raw.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  return key.length >= 2 ? key : null;
}

/** Lưu data-URL ảnh → /uploads/avatars/{key}.{ext} */
export function saveUploadedAvatar(
  ownerKey: string,
  dataUrl: string,
): { ok: true; avatar: string } | { ok: false; reason: string } {
  const key = safeKey(ownerKey);
  if (!key) return { ok: false, reason: "Mã lưu avatar không hợp lệ" };

  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl.trim(),
  );
  if (!m) {
    return { ok: false, reason: "Ảnh phải là JPG, PNG hoặc WebP" };
  }

  const mime = m[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
  const ext = MIME_EXT[mime];
  if (!ext) return { ok: false, reason: "Định dạng ảnh không hỗ trợ" };

  let buf: Buffer;
  try {
    buf = Buffer.from(m[2]!.replace(/\s/g, ""), "base64");
  } catch {
    return { ok: false, reason: "Không đọc được ảnh" };
  }
  if (buf.length < 32) return { ok: false, reason: "Ảnh quá nhỏ" };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "Ảnh tối đa ~800KB (hãy chọn ảnh nhỏ hơn)" };
  }

  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `${key}.${ext}`;
  writeFileSync(join(UPLOADS_DIR, filename), buf);

  const avatar = `/uploads/avatars/${filename}?v=${Date.now()}`;
  return { ok: true, avatar };
}
