export const DEFAULT_AVATAR = "/assets/ui/avatar-default.png";

/** Đồng bộ allowlist với server/src/avatars.ts */
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
  "/assets/avatars/ludo-p1.svg",
  "/assets/avatars/ludo-p2.svg",
  "/assets/avatars/ludo-p3.svg",
  "/assets/avatars/ludo-p4.svg",
];

const CUSTOM_AVATAR_RE =
  /^\/uploads\/avatars\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i;

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

/** Nén ảnh từ máy → data-URL JPEG (vuông ~256px). */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Chỉ chọn file ảnh"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Ảnh gốc tối đa 8MB"));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Không xử lý được ảnh"));
        return;
      }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        reject(new Error("Không xuất được ảnh"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không mở được ảnh"));
    };
    img.src = url;
  });
}
