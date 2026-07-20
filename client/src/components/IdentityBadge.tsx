import type { SyntheticEvent } from "react";
import {
  homePath,
  playPath,
  userShowsVip,
  type AuthUser,
  type UserRole,
} from "../auth";
import { normalizeAvatar, DEFAULT_AVATAR } from "../avatars";
import { VipFantasyAvatar } from "./VipFantasyAvatar";

function roleLabel(role?: UserRole | "guest"): string {
  if (role === "mainadmin") return "Mainadmin";
  if (role === "admin") return "Admin";
  if (role === "deal") return "Deal";
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
  const isVip = userShowsVip(user);

  const className = `flex w-full items-center gap-2 text-left ${
    compact
      ? ""
      : `rounded-xl px-2.5 py-2 ring-1 ${
          isVip
            ? "bg-gradient-to-br from-amber-50/95 via-[rgba(255,248,232,0.92)] to-amber-100/80 ring-amber-300/70 shadow-[0_2px_14px_rgba(180,110,20,0.12)]"
            : "bg-[rgba(255,248,232,0.78)] ring-[var(--gold)]/35"
        }`
  }`;

  const avatarRing = isVip
    ? ""
    : "ring-2 ring-[var(--gold)]/55 shadow";

  const nameClass = `truncate font-play text-[var(--play-ink)] ${
    compact ? "text-sm" : "text-base"
  } ${
    onNameClick
      ? "max-w-full rounded px-0.5 -mx-0.5 underline decoration-dotted decoration-[var(--gold)]/70 underline-offset-2 active:opacity-80"
      : ""
  }`;

  const avatarSize = compact ? "sm" : "md";

  const onAvatarError = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.src.includes("avatar-default")) return;
    el.src = DEFAULT_AVATAR;
  };

  const avatarNode = isVip ? (
    <VipFantasyAvatar
      src={avatar}
      alt=""
      size={avatarSize}
      onError={onAvatarError}
    />
  ) : (
    <img
      src={avatar}
      alt=""
      className={`rounded-full object-cover ${avatarRing} ${
        compact ? "h-9 w-9" : "h-14 w-14"
      }`}
      onError={onAvatarError}
    />
  );

  return (
    <div className={className}>
      {onAvatarClick ? (
        <button
          type="button"
          onClick={onAvatarClick}
          className="relative shrink-0 active:scale-[0.97]"
          title="Đổi avatar"
        >
          {avatarNode}
          <span className="absolute -bottom-0.5 -right-0.5 z-10 rounded-full bg-[var(--wood-deep)] px-1 text-[8px] font-bold leading-tight text-[var(--cream)] ring-1 ring-[var(--gold)]/50">
            Đổi
          </span>
        </button>
      ) : (
        <span className="relative shrink-0">{avatarNode}</span>
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
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="identity-chip identity-chip--role">
            {roleLabel(role)}
          </span>
          {isVip && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#1a1208] shadow ring-1 ring-amber-200/80">
              VIP
            </span>
          )}
          {code && (
            <span
              className={`identity-chip identity-chip--code identity-chip--code-lg${
                isVip ? " identity-chip--code-vip" : ""
              }`}
              title={isVip ? "ID VIP — hiện với người chơi khác" : "ID người chơi"}
            >
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
