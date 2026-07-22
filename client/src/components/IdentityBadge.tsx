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
import { CoupleAvatar } from "./CoupleAvatar";
import { ColoredName } from "./ColoredName";
import { RoleAvatarFrame } from "./RoleAvatarFrame";
import {
  cultivationLabel,
  getCultivationColor,
  isCultivationRank,
} from "../cultivation";

function roleMeta(role?: UserRole | "guest"): { glyph: string; label: string } {
  if (role === "mainadmin") return { glyph: "✦", label: "Mainadmin" };
  if (role === "admin") return { glyph: "🛡", label: "Admin" };
  if (role === "eco") return { glyph: "🌿", label: "Eco" };
  if (role === "audit") return { glyph: "👁", label: "Audit" };
  if (role === "sgift") return { glyph: "🎁", label: "SGift" };
  if (role === "ring") return { glyph: "💍", label: "Ring" };
  if (role === "deal") return { glyph: "⚖", label: "Deal" };
  if (role === "onl") return { glyph: "📡", label: "Onl" };
  if (role === "tutien") return { glyph: "☯", label: "Tu Tiên" };
  if (role === "mod") return { glyph: "⚔", label: "Mod" };
  if (role === "guest") return { glyph: "◌", label: "Khách" };
  return { glyph: "👤", label: "Player" };
}

interface IdentityBadgeProps {
  user?: AuthUser | null;
  guestCode?: string | null;
  guestName?: string | null;
  guestAvatar?: string | null;
  compact?: boolean;
  showPath?: boolean;
  onAvatarClick?: () => void;
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
  const name = user ? userDisplayName(user) : guestName || "Khách";
  const loginHint =
    user && user.nickname?.trim() && user.nickname.trim().length >= 2
      ? user.username
      : null;
  const code = user?.code || (guestCode ? guestCode.toUpperCase() : "");
  const role = isGuest ? "guest" : user!.role;
  const { glyph: roleGlyph, label: roleName } = roleMeta(role);
  const avatar = user
    ? normalizeAvatar(user.avatar)
    : normalizeAvatar(guestAvatar) || DEFAULT_AVATAR;
  const path = user ? homePath(user) : guestCode ? `/guest/${guestCode}` : "/play";
  const play = user ? playPath(user) : guestCode ? `/guest/${guestCode}/play` : "/play";
  const isVip = userShowsVip(user);
  const bondActive = user?.bond?.status === "active";

  const shellClass = [
    "identity-badge",
    bondActive ? "identity-badge--couple" : "identity-badge--solo",
    compact ? "identity-badge--compact" : "",
    !compact
      ? isVip
        ? "rounded-xl bg-gradient-to-br from-amber-50/95 via-[rgba(255,248,232,0.92)] to-amber-100/80 px-2.5 py-2 ring-1 ring-amber-300/70 shadow-[0_2px_14px_rgba(180,110,20,0.12)]"
        : "rounded-xl bg-[rgba(255,248,232,0.78)] px-2.5 py-2 ring-1 ring-[var(--gold)]/35"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const nameClass = `truncate font-play ${
    compact ? "text-sm" : "text-base"
  } ${
    onNameClick
      ? "max-w-full rounded px-0.5 -mx-0.5 underline decoration-dotted decoration-[var(--gold)]/70 underline-offset-2 active:opacity-80"
      : ""
  } ${user?.nameColor ? "" : "text-[var(--play-ink)]"}`;

  const avatarSize = compact ? "sm" : "md";

  const onAvatarError = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.src.includes("avatar-default")) return;
    el.src = DEFAULT_AVATAR;
  };

  const avatarNode = (
    <RoleAvatarFrame
      src={avatar}
      alt=""
      size={avatarSize}
      frame={user?.avatarFrame}
      isVip={isVip}
      decoding="async"
      onError={onAvatarError}
    />
  );

  const coupleNode =
    bondActive && user?.bond ? (
      <CoupleAvatar
        displaySize="compact"
        className="identity-badge__couple"
        avatarA={avatar}
        avatarB={user.bond.partnerAvatar}
        ringImage={user.bond.ringImage}
        ringAlt={user.bond.ringNameVi}
        ringEffect={user.bond.ringEffect}
        ringSharpness={user.bond.ringSharpness}
        coupleFrame={user.bond.coupleFrame}
        coupleBorder={user.bond.coupleBorder}
        coupleScale="md"
        coupleMotion={user.bond.coupleMotion === "none" ? "none" : "breathe"}
        coupleGap="normal"
        coupleLayout="classic"
        ringFrame={user.bond.ringFrame}
        ringFrameScale="sm"
        onAvatarAClick={onAvatarClick}
      />
    ) : null;

  const nameNode = onNameClick ? (
    <ColoredName
      as="button"
      name={name}
      colorId={user?.nameColor}
      effectId={user?.nameEffect}
      className={`${nameClass} block w-full text-left`}
      title="Đổi tên"
      onClick={onNameClick}
    />
  ) : (
    <ColoredName
      as="p"
      name={name}
      colorId={user?.nameColor}
      effectId={user?.nameEffect}
      className={nameClass}
    />
  );

  const meta = (
    <div className="identity-badge__meta min-w-0">
      <div className="identity-badge__name-row">{nameNode}</div>
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

      <div className="role-rail" aria-label="Vai trò">
        <div className="role-rail__pills">
          {bondActive && (
            <span className="role-pill role-pill--couple" title="Cặp đôi">
              <span className="role-pill__glyph" aria-hidden>
                ♥
              </span>
              <span className="role-pill__text">Cặp đôi</span>
            </span>
          )}
          <span
            className="role-pill role-pill--role"
            title={roleName}
            data-role={role}
          >
            <span className="role-pill__glyph" aria-hidden>
              {roleGlyph}
            </span>
            <span className="role-pill__text">{roleName}</span>
          </span>
          {user?.cultivationRank && isCultivationRank(user.cultivationRank) && (
            <span
              className="role-pill role-pill--cult"
              title={cultivationLabel(user.cultivationRank) ?? "Cảnh giới"}
              style={{
                borderColor: getCultivationColor(user.cultivationRank)?.border,
                color: getCultivationColor(user.cultivationRank)?.text,
              }}
            >
              <span className="role-pill__glyph" aria-hidden>
                ᚱ
              </span>
              <span className="role-pill__text">
                {cultivationLabel(user.cultivationRank)}
              </span>
            </span>
          )}
          {isVip && (
            <span className="role-pill role-pill--vip" title="VIP">
              <span className="role-pill__glyph" aria-hidden>
                ★
              </span>
              <span className="role-pill__text">VIP</span>
            </span>
          )}
        </div>
        {code && (
          <div className="role-rail__id">
            <span
              className={`role-id${isVip ? " role-id--vip" : ""}`}
              title={
                isVip ? "ID VIP — hiện với người chơi khác" : "ID người chơi"
              }
            >
              <span className="role-id__glyph" aria-hidden>
                #
              </span>
              <span className="role-id__label">ID</span>
              <span className="role-id__value">{code}</span>
            </span>
          </div>
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
  );

  return (
    <div className={shellClass}>
      {coupleNode ? (
        <>
          <div className="identity-badge__couple-wrap">{coupleNode}</div>
          {meta}
        </>
      ) : (
        <>
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
          {meta}
        </>
      )}
    </div>
  );
}
