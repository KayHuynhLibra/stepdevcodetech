/**
 * Staff grant ladder + capabilities — lớp trên UserRole (additive).
 * Khi không có staffGrantLevel → hành vi trùng role cũ.
 *
 * eco / audit / sgift: quyền theo role (không qua L5) để tránh gắn nhầm bằng override bậc.
 */

export type UserRoleForGrant =
  | "user"
  | "admin"
  | "mainadmin"
  | "deal"
  | "onl"
  | "tutien"
  | "mod"
  | "eco"
  | "audit"
  | "sgift";

export type GrantCapability =
  | "play"
  | "see_online"
  | "balance_ops"
  | "voice_mod"
  | "room_admin_tab"
  | "cultivation_manage"
  | "staff_dashboard"
  | "grant_rooms"
  /** Compat: full mainadmin suite (Inter+vault+IP+…). Prefer caps tách khi gắn feature mới. */
  | "inter_vault_ip"
  | "room_lock_any"
  | "vault_ops"
  | "traffic_view"
  | "invite_ops"
  | "arcana_config"
  | "ip_audit"
  | "tools_lookup"
  | "chat_config"
  | "inter_control"
  | "gift_manage";

export const STAFF_GRANT_LEVEL_MIN = 0;
export const STAFF_GRANT_LEVEL_MAX = 6;

export const ROLE_DEFAULT_LEVEL: Record<UserRoleForGrant, number> = {
  user: 0,
  onl: 1,
  deal: 2,
  mod: 3,
  tutien: 4,
  admin: 5,
  eco: 5,
  audit: 5,
  sgift: 5,
  mainadmin: 6,
};

export const GRANT_LEVEL_LABELS: Record<number, string> = {
  0: "L0 · Player",
  1: "L1 · Onl",
  2: "L2 · Deal",
  3: "L3 · Mod",
  4: "L4 · Tu Tiên",
  5: "L5 · Admin",
  6: "L6 · Mainadmin",
};

export function clampStaffGrantLevel(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return STAFF_GRANT_LEVEL_MIN;
  return Math.max(
    STAFF_GRANT_LEVEL_MIN,
    Math.min(STAFF_GRANT_LEVEL_MAX, v),
  );
}

export function roleDefaultLevel(role: UserRoleForGrant | string): number {
  if (role in ROLE_DEFAULT_LEVEL) {
    return ROLE_DEFAULT_LEVEL[role as UserRoleForGrant]!;
  }
  return 0;
}

export type GrantUser = {
  role: UserRoleForGrant | string;
  staffGrantLevel?: number | null;
  voiceRoomGrants?: number[];
};

/** Level hiệu lực: override nếu có, không thì theo role. */
export function effectiveStaffGrantLevel(user: GrantUser | null | undefined): number {
  if (!user) return 0;
  if (user.staffGrantLevel != null && user.staffGrantLevel !== undefined) {
    return clampStaffGrantLevel(user.staffGrantLevel);
  }
  return roleDefaultLevel(user.role);
}

/**
 * Capability check. Không có override → trùng luật role hiện tại.
 * Có staffGrantLevel → có thể nâng capability theo bậc (trừ eco/audit/sgift caps — chỉ role hoặc L6).
 */
export function hasCapability(
  user: GrantUser | null | undefined,
  cap: GrantCapability,
): boolean {
  if (!user) return false;
  const role = user.role;
  const L = effectiveStaffGrantLevel(user);
  const overridden =
    user.staffGrantLevel != null && user.staffGrantLevel !== undefined;
  const isMainish = role === "mainadmin" || (overridden && L >= 6);

  switch (cap) {
    case "play":
      return true;
    case "see_online":
      return (
        role === "onl" ||
        role === "admin" ||
        role === "mainadmin" ||
        role === "eco" ||
        role === "audit" ||
        role === "sgift" ||
        (overridden && L >= 1)
      );
    case "balance_ops":
      return (
        role === "deal" ||
        role === "admin" ||
        role === "mainadmin" ||
        (overridden && L >= 2)
      );
    case "voice_mod":
      return (
        role === "mod" ||
        role === "admin" ||
        role === "mainadmin" ||
        (overridden && L >= 3)
      );
    case "room_admin_tab":
      return (
        role === "mod" ||
        role === "mainadmin" ||
        (overridden && L >= 3)
      );
    case "cultivation_manage":
      return (
        role === "tutien" ||
        role === "mainadmin" ||
        (overridden && L >= 4)
      );
    case "staff_dashboard":
      return (
        role === "admin" ||
        role === "mainadmin" ||
        role === "eco" ||
        role === "audit" ||
        role === "sgift" ||
        (overridden && L >= 5)
      );
    case "grant_rooms":
      return (
        role === "admin" ||
        role === "mainadmin" ||
        (overridden && L >= 5)
      );
    case "vault_ops":
    case "traffic_view":
    case "invite_ops":
    case "arcana_config":
      return role === "eco" || isMainish;
    case "ip_audit":
    case "tools_lookup":
    case "chat_config":
      return role === "audit" || isMainish;
    case "gift_manage":
      return role === "sgift" || isMainish;
    case "inter_control":
      return isMainish;
    case "inter_vault_ip":
      return isMainish;
    case "room_lock_any":
      return isMainish;
    default:
      return false;
  }
}

export function normalizeVoiceRoomGrants(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<number>();
  for (const x of raw) {
    const n = Math.floor(Number(x));
    if (Number.isInteger(n) && n >= 1 && n <= 5) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** Đóng phòng / MK: mainadmin (hoặc L6 override) hoặc đúng Room#. */
export function canControlVoiceRoomLock(
  user: GrantUser | null | undefined,
  roomId: number,
): boolean {
  if (!user) return false;
  if (hasCapability(user, "room_lock_any")) return true;
  const n = Math.floor(Number(roomId));
  if (!Number.isInteger(n) || n < 1 || n > 5) return false;
  return normalizeVoiceRoomGrants(user.voiceRoomGrants).includes(n);
}
