import { api, getToken, type AuthUser } from "./auth";
import { fileToAvatarDataUrl } from "./avatars";

/** Upload ảnh từ máy → URL avatar trên server. */
export async function uploadAvatarFromFile(
  file: File,
  opts?: { guestCode?: string | null },
): Promise<{ avatar: string; user?: AuthUser }> {
  const dataUrl = await fileToAvatarDataUrl(file);
  const body: { dataUrl: string; guestCode?: string } = { dataUrl };
  if (!getToken() && opts?.guestCode) {
    body.guestCode = opts.guestCode.toUpperCase();
  }

  const r = await api<{
    ok: true;
    avatar: string;
    user?: AuthUser;
  }>("/api/avatar/upload", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return { avatar: r.avatar, user: r.user };
}
