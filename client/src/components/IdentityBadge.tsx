import { homePath, playPath, type AuthUser, type UserRole } from "../auth";
import { normalizeAvatar, DEFAULT_AVATAR } from "../avatars";

function roleLabel(role?: UserRole | "guest"): string {
  if (role === "mainadmin") return "Mainadmin";
  if (role === "admin") return "Admin";
  if (role === "guest") return "Khách";
  return "Player";
}

interface IdentityBadgeProps {
  user?: AuthUser | null;
  /** Phiên khách */
  guestCode?: string | null;
  guestName?: string | null;
  compact?: boolean;
  showPath?: boolean;
}

/** Hiện rõ username + mã + loại tài khoản (đã login / khách). */
export function IdentityBadge({
  user,
  guestCode,
  guestName,
  compact = false,
  showPath = true,
}: IdentityBadgeProps) {
  const isGuest = !user;
  const name = user?.username || guestName || "Khách";
  const code = (user?.code || guestCode || "").toUpperCase();
  const role = isGuest ? "guest" : user!.role;
  const avatar = user
    ? normalizeAvatar(user.avatar)
    : DEFAULT_AVATAR;
  const path = user ? homePath(user) : guestCode ? `/guest/${guestCode}` : "/play";
  const play = user ? playPath(user) : guestCode ? `/guest/${guestCode}/play` : "/play";

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "" : "rounded-xl bg-white/70 px-2.5 py-2 ring-1 ring-[#1e3a6e]/12"}`}
    >
      <img
        src={avatar}
        alt=""
        className={`shrink-0 rounded-full object-cover ring-2 ring-white shadow ${
          compact ? "h-8 w-8" : "h-11 w-11"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-play text-[var(--play-ink)] ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          {name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <span className="identity-chip identity-chip--role">
            {roleLabel(role)}
          </span>
          {code && (
            <span className="identity-chip identity-chip--code" title="Mã riêng">
              {code}
            </span>
          )}
        </div>
        {showPath && (
          <p
            className={`mt-1 truncate font-mono text-[var(--play-muted)] ${
              compact ? "text-[9px]" : "text-[10px]"
            }`}
          >
            {compact ? play : `${path} · chơi ${play}`}
          </p>
        )}
      </div>
    </div>
  );
}
