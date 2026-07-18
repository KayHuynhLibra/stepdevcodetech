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
  guestAvatar?: string | null;
  compact?: boolean;
  showPath?: boolean;
  /** Mở chọn avatar khi chạm */
  onAvatarClick?: () => void;
}

/** Hiện rõ username + mã + loại tài khoản (đã login / khách). */
export function IdentityBadge({
  user,
  guestCode,
  guestName,
  guestAvatar,
  compact = false,
  showPath = true,
  onAvatarClick,
}: IdentityBadgeProps) {
  const isGuest = !user;
  const name = user?.username || guestName || "Khách";
  const code = user?.code || (guestCode ? guestCode.toUpperCase() : "");
  const role = isGuest ? "guest" : user!.role;
  const avatar = user
    ? normalizeAvatar(user.avatar)
    : normalizeAvatar(guestAvatar) || DEFAULT_AVATAR;
  const path = user ? homePath(user) : guestCode ? `/guest/${guestCode}` : "/play";
  const play = user ? playPath(user) : guestCode ? `/guest/${guestCode}/play` : "/play";

  const className = `flex w-full items-center gap-2 text-left ${
    compact ? "" : "rounded-xl bg-white/70 px-2.5 py-2 ring-1 ring-[#0f3d6e]/12"
  } ${onAvatarClick ? "cursor-pointer active:scale-[0.99]" : ""}`;

  const body = (
    <>
      <span className="relative shrink-0">
        <img
          src={avatar}
          alt=""
          className={`rounded-full object-cover ring-2 ring-white shadow ${
            compact ? "h-8 w-8" : "h-11 w-11"
          }`}
        />
        {onAvatarClick && (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#0f3d6e] px-1 text-[8px] font-bold leading-tight text-white ring-1 ring-white">
            Đổi
          </span>
        )}
      </span>
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
            <span className="identity-chip identity-chip--code" title="ID">
              ID {code}
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
    </>
  );

  if (onAvatarClick) {
    return (
      <button
        type="button"
        onClick={onAvatarClick}
        className={className}
        title="Đổi avatar"
      >
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
