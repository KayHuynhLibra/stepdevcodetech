import type { SyntheticEvent } from "react";
import {
  homePath,
  playPath,
  userDisplayName,
  userShowsVip,
  type AuthUser,
  type UserRole,
} from "../auth";
import { normalizeAvatar, DEFAULT_AVATAR } from "../avatars";
import { VipFantasyAvatar } from "./VipFantasyAvatar";
import { CultivationChip } from "./CultivationChip";
import { CoupleAvatar } from "./CoupleAvatar";

function roleLabel(role?: UserRole | "guest"): string {
  if (role === "mainadmin") return "Mainadmin";
  if (role === "admin") return "Admin";
  if (role === "eco") return "Eco";
  if (role === "audit") return "Audit";
  if (role === "sgift") return "SGift";
  if (role === "ring") return "Ring";
  if (role === "deal") return "Deal";
  if (role === "onl") return "Onl";
  if (role === "tutien") return "Tu Tiên";
  if (role === "mod") return "Mod";
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
  /** Mở đổi tên khi chạm tên (khách hoặc user đăng nhập) */
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
  const name = user
    ? userDisplayName(user)
    : guestName || "Khách";
  const loginHint =
    user && user.nickname?.trim() && user.nickname.trim().length >= 2
      ? user.username
      : null;
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

  const bondActive = user?.bond?.status === "active";

  const avatarNode = isVip ? (
    <VipFantasyAvatar
      src={avatar}
      alt=""
      size={avatarSize}
      fx={!compact}
      decoding="async"
      onError={onAvatarError}
    />
  ) : (
    <img
      src={avatar}
      alt=""
      decoding="async"
      className={`rounded-full object-cover ${avatarRing} ${
        compact ? "h-9 w-9" : "h-14 w-14"
      }`}
      onError={onAvatarError}
    />
  );

  const coupleNode =
    bondActive && user?.bond ? (
      <CoupleAvatar
        avatarA={avatar}
        avatarB={user.bond.partnerAvatar}
        ringImage={user.bond.ringImage}
        ringAlt={user.bond.ringNameVi}
        ringEffect={user.bond.ringEffect}
        ringSharpness={user.bond.ringSharpness}
        coupleFrame={user.bond.coupleFrame}
        coupleBorder={user.bond.coupleBorder}
        coupleScale={user.bond.coupleScale}
        compact={compact}
        onAvatarAClick={onAvatarClick}
      />
    ) : null;

  return (
    <div className={className}>
      {coupleNode ? (
        coupleNode
      ) : onAvatarClick ? (
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
        {bondActive && (
          <p
            className={`inline-flex items-center rounded-full bg-gradient-to-r from-rose-500/20 to-amber-400/15 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-rose-700/90 ring-1 ring-rose-400/35 ${
              compact ? "mt-0" : "mt-0.5"
            }`}
          >
            Cặp đôi
          </p>
        )}
        {loginHint && (
          <p
            className={`truncate font-mono text-[9px] text-[var(--play-muted)] ${
              compact ? "mt-0" : "mt-0.5"
            }`}
            title="Username đăng nhập"
          >
            @{loginHint}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="identity-chip identity-chip--role">
            {roleLabel(role)}
          </span>
          {user?.cultivationRank && (
            <CultivationChip rank={user.cultivationRank} />
          )}
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
