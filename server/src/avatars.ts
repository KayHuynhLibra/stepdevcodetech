export const DEFAULT_AVATAR = "/assets/ui/avatar-default.png";

/** Danh sách avatar hợp lệ (allowlist). */
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

export function normalizeAvatar(path?: string | null): string {
  if (path && AVATARS.includes(path)) return path;
  return DEFAULT_AVATAR;
}
