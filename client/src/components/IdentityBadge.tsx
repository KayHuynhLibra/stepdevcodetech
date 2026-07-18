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
  /** Mở đổi tên khi chạm tên (khách) */
  onNameClick?: () => void;
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
  onNameClick,
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
    compact ? "" : "rounded-xl bg-[rgba(255,248,232,0.78)] px-2.5 py-2 ring-1 ring-[var(--gold)]/35"
  }`;

  const nameClass = `truncate font-play text-[var(--play-ink)] ${
    compact ? "text-sm" : "text-base"
  } ${
    onNameClick
      ? "max-w-full rounded px-0.5 -mx-0.5 underline decoration-dotted decoration-[var(--gold)]/70 underline-offset-2 active:opacity-80"
      : ""
  }`;

  return (
    <div className={className}>
      {onAvatarClick ? (
        <button
          type="button"
          onClick={onAvatarClick}
          className="relative shrink-0 active:scale-[0.97]"
          title="Đổi avatar"
        >
          <img
            src={avatar}
            alt=""
            className={`rounded-full object-cover ring-2 ring-white shadow ${
              compact ? "h-8 w-8" : "h-11 w-11"
            }`}
          />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--wood-deep)] px-1 text-[8px] font-bold leading-tight text-[var(--cream)] ring-1 ring-[var(--gold)]/50">
            Đổi
          </span>
        </button>
      ) : (
        <span className="relative shrink-0">
          <img
            src={avatar}
            alt=""
            className={`rounded-full object-cover ring-2 ring-white shadow ${
              compact ? "h-8 w-8" : "h-11 w-11"
            }`}
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {onNameClick ? (
          <button
            type="button"
            onClick={onNameClick}
            className={`${nameClass} block w-full text-left`}
            title="Đổi tên"
          >
            {name}
          </button>
        ) : (
          <p className={nameClass}>{name}</p>
        )}
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
    </div>
  );
}
