/** Hồ sơ MXH / chat — ẩn tin local (client), không phải mute admin. */

export type SocialIgnoreTarget = {
  userId?: string;
  code?: string;
  name?: string;
};

const STORAGE_KEY = "sofiaore_chat_ignore_v1";

function norm(s: string | undefined | null): string {
  return String(s ?? "").trim().toLowerCase();
}

export function socialTargetKey(t: SocialIgnoreTarget): string {
  if (t.userId) return `u:${norm(t.userId)}`;
  if (t.code) return `c:${norm(t.code)}`;
  if (t.name) return `n:${norm(t.name)}`;
  return "";
}

export function loadIgnoredPlayers(): SocialIgnoreTarget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SocialIgnoreTarget[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        userId: x.userId ? String(x.userId) : undefined,
        code: x.code ? String(x.code) : undefined,
        name: x.name ? String(x.name) : undefined,
      }))
      .filter((x) => socialTargetKey(x));
  } catch {
    return [];
  }
}

export function saveIgnoredPlayers(list: SocialIgnoreTarget[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* quota */
  }
}

export function isPlayerIgnored(
  target: SocialIgnoreTarget,
  list: SocialIgnoreTarget[],
): boolean {
  const uid = norm(target.userId);
  const code = norm(target.code);
  const name = norm(target.name);
  return list.some((row) => {
    if (uid && row.userId && norm(row.userId) === uid) return true;
    if (code && row.code && norm(row.code) === code) return true;
    if (name && row.name && norm(row.name) === name && !uid && !row.userId)
      return true;
    return false;
  });
}

export function toggleIgnorePlayer(
  target: SocialIgnoreTarget,
  list: SocialIgnoreTarget[],
): SocialIgnoreTarget[] {
  const key = socialTargetKey(target);
  if (!key) return list;
  if (isPlayerIgnored(target, list)) {
    return list.filter((row) => {
      if (target.userId && row.userId && norm(row.userId) === norm(target.userId))
        return false;
      if (target.code && row.code && norm(row.code) === norm(target.code))
        return false;
      if (
        !target.userId &&
        !row.userId &&
        target.name &&
        row.name &&
        norm(row.name) === norm(target.name)
      )
        return false;
      return true;
    });
  }
  return [
    ...list,
    {
      userId: target.userId,
      code: target.code,
      name: target.name,
    },
  ].slice(0, 200);
}
