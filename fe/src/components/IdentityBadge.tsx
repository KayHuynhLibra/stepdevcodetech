import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import {
  homePath,
  playPath,
  userDisplayName,
  userShowsVip,
  type AuthUser,
} from "../auth";
import { normalizeAvatar, DEFAULT_AVATAR } from "../avatars";
import { CoupleAvatar } from "./CoupleAvatar";
import { ColoredName } from "./ColoredName";
import { RoleAvatarFrame } from "./RoleAvatarFrame";
import { RoleRail } from "./RoleRail";
import {
  cultivationLabel,
  getCultivationColor,
  isCultivationRank,
} from "../cultivation";
import {
  nobilityColors,
  nobilityLabel,
  nobilityTierOf,
} from "../nobility";
import { computeVipTier, vipLabel as vipTierLabel } from "../vip";
import { PlayLevelBadge } from "./PlayLevelBadge";
import { coupleWithLabel } from "../rings";
import type { RoleDisplayPublic } from "../roleDisplay";
import {
  resolveRoleColorStyle,
  resolveRoleGlyph,
  resolveRoleLabel,
} from "../roleDisplay";
import { useRoleDisplay } from "./RoleRail";
import { displayBadgeDef } from "../displayBadges";

interface IdentityBadgeProps {
  user?: AuthUser | null;
  guestCode?: string | null;
  guestName?: string | null;
  guestAvatar?: string | null;
  compact?: boolean;
  showPath?: boolean;
  roleDisplay?: RoleDisplayPublic | null;
  onAvatarClick?: () => void;
  onNameClick?: () => void;
}

const LONG_PRESS_MS = 480;

/** Hiện rõ username + mã + loại tài khoản (đã login / khách). */
export function IdentityBadge({
  user,
  guestCode,
  guestName,
  guestAvatar,
  compact = false,
  showPath = true,
  roleDisplay,
  onAvatarClick,
  onNameClick,
}: IdentityBadgeProps) {
  const rd = useRoleDisplay(roleDisplay);
  const isGuest = !user;
  const name = user ? userDisplayName(user) : guestName || "Khách";
  const loginHint =
    user && user.nickname?.trim() && user.nickname.trim().length >= 2
      ? user.username
      : null;
  const code = user?.code || (guestCode ? guestCode.toUpperCase() : "");
  const role = isGuest ? "guest" : user!.role;
  const roleKey = role === "user" ? "user" : role;
  const roleGlyph = resolveRoleGlyph(roleKey);
  const roleName = resolveRoleLabel(roleKey, rd.roleLabels);
  const coupleLabel = resolveRoleLabel("couple", rd.roleLabels);
  const vipLabel = resolveRoleLabel("vip", rd.roleLabels);
  const avatar = user
    ? normalizeAvatar(user.avatar)
    : normalizeAvatar(guestAvatar) || DEFAULT_AVATAR;
  const path = user ? homePath(user) : guestCode ? `/guest/${guestCode}` : "/play";
  const play = user ? playPath(user) : guestCode ? `/guest/${guestCode}/play` : "/play";
  const isVip = userShowsVip(user);
  const vipTier = user ? computeVipTier(user) : 0;
  const vipPillText =
    vipTier >= 1 ? vipTierLabel(vipTier) || vipLabel : vipLabel;
  const nobleTier = user ? nobilityTierOf(user) : 0;
  const nobleName =
    nobleTier > 0 && !user?.nameColor
      ? nobilityColors(nobleTier).name
      : undefined;
  const bondActive = user?.bond?.status === "active";

  const [showLoginHint, setShowLoginHint] = useState(false);
  const loginHintRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    setShowLoginHint(false);
  }, [user?.id, user?.nickname, user?.username]);

  useEffect(() => {
    if (!showLoginHint) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = loginHintRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setShowLoginHint(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [showLoginHint]);

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onCoupleNamePointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    longPressFired.current = false;
    clearLongPress();
    if (!onNameClick) return;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      longPressTimer.current = null;
      setShowLoginHint(false);
      onNameClick();
    }, LONG_PRESS_MS);
  };

  const onCoupleNamePointerUp = () => {
    clearLongPress();
  };

  const onCoupleNameClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (loginHint) {
      setShowLoginHint((v) => !v);
      return;
    }
    onNameClick?.();
  };

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
    onNameClick || loginHint
      ? "max-w-full rounded px-0.5 -mx-0.5 underline decoration-dotted decoration-[var(--gold)]/70 underline-offset-2 active:opacity-80"
      : ""
  } ${
    user?.nameColor
      ? ""
      : bondActive
        ? "text-[#FFE8F0]"
        : "text-[var(--play-ink)]"
  }`;

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
      vipTier={vipTier}
      nobilityTier={nobleTier}
      bonded={bondActive}
      accountRole={isGuest ? "guest" : role}
      decoding="async"
      onError={onAvatarError}
    />
  );

  const coupleNode =
    bondActive && user?.bond ? (
      <CoupleAvatar
        displaySize="default"
        className="identity-badge__couple"
        avatarA={avatar}
        avatarB={user.bond.partnerAvatar}
        ringImage={user.bond.ringImage}
        ringAlt={user.bond.ringNameVi}
        ringEffect={user.bond.ringEffect}
        ringSharpness={user.bond.ringSharpness}
        coupleFrame={user.bond.coupleFrame}
        coupleBorder={user.bond.coupleBorder}
        coupleScale={user.bond.coupleScale || "lg"}
        coupleMotion={user.bond.coupleMotion === "none" ? "none" : "breathe"}
        coupleGap="span"
        coupleLayout={user.bond.coupleLayout || "classic"}
        ringFrame={user.bond.ringFrame}
        ringFrameScale={user.bond.ringFrameScale || "md"}
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
      style={nobleName ? { color: nobleName } : undefined}
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
      style={nobleName ? { color: nobleName } : undefined}
    />
  );

  const rolesTable = (
    <div className="identity-badge__roles-table" aria-label="Vai trò">
      <RoleRail
        config={rd}
        slots={{
          couple: bondActive ? (
            <span
              className="role-pill role-pill--couple"
              title={coupleLabel}
              style={resolveRoleColorStyle("couple", rd.roleColors)}
            >
              <span className="role-pill__glyph" aria-hidden>
                {resolveRoleGlyph("couple")}
              </span>
              <span className="role-pill__text">
                {coupleLabel}
                {typeof user?.bond?.coupleLevel === "number"
                  ? ` · Lv.${user.bond.coupleLevel}`
                  : ""}
              </span>
            </span>
          ) : null,
          level:
            user && !compact ? (
              <PlayLevelBadge
                rounds={user.roundsPlayed ?? 0}
                size="sm"
                className="role-rail__level"
              />
            ) : null,
          role: (
            <span
              className={`role-pill role-pill--role role-pill--${role}`}
              title={roleName}
              data-role={role}
              style={resolveRoleColorStyle(
                role === "user" ? "user" : role,
                rd.roleColors,
              )}
            >
              <span className="role-pill__glyph" aria-hidden>
                {roleGlyph}
              </span>
              <span className="role-pill__text">{roleName}</span>
            </span>
          ),
          cult:
            user?.cultivationRank && isCultivationRank(user.cultivationRank) ? (
              <span
                className="role-pill role-pill--cult"
                title={cultivationLabel(user.cultivationRank) ?? "Cảnh giới"}
                style={{
                  ...resolveRoleColorStyle("tutien", rd.roleColors),
                  borderColor: getCultivationColor(user.cultivationRank)?.border,
                  color:
                    resolveRoleColorStyle("tutien", rd.roleColors)?.color ??
                    getCultivationColor(user.cultivationRank)?.text,
                }}
              >
                <span className="role-pill__glyph" aria-hidden>
                  ᚱ
                </span>
                <span className="role-pill__text">
                  {cultivationLabel(user.cultivationRank)}
                </span>
              </span>
            ) : null,
          vip: isVip ? (
            <span
              className="role-pill role-pill--vip"
              title={vipPillText}
              style={resolveRoleColorStyle("vip", rd.roleColors)}
            >
              <span className="role-pill__glyph" aria-hidden>
                {resolveRoleGlyph("vip")}
              </span>
              <span className="role-pill__text">{vipPillText}</span>
            </span>
          ) : null,
          badges:
            user?.displayBadges && user.displayBadges.length > 0 ? (
              <>
                {nobleTier > 0 ? (
                  <span
                    className="role-pill role-pill--nobility"
                    title={nobilityLabel(nobleTier)}
                    style={{
                      background: nobilityColors(nobleTier).bg,
                      color: nobilityColors(nobleTier).text,
                      borderColor: nobilityColors(nobleTier).border,
                    }}
                  >
                    <span className="role-pill__glyph" aria-hidden>
                      ♛
                    </span>
                    <span className="role-pill__text">
                      {nobilityLabel(nobleTier)}
                    </span>
                  </span>
                ) : null}
                {user.displayBadges.map((bid) => {
                  const def = displayBadgeDef(bid);
                  if (!def) return null;
                  return (
                    <span
                      key={def.id}
                      className={`role-pill role-pill--badge role-pill--badge-${def.tone}`}
                      title={def.label}
                      data-badge={def.id}
                    >
                      <span className="role-pill__glyph" aria-hidden>
                        {def.glyph}
                      </span>
                      <span className="role-pill__text">{def.label}</span>
                    </span>
                  );
                })}
              </>
            ) : nobleTier > 0 ? (
              <span
                className="role-pill role-pill--nobility"
                title={nobilityLabel(nobleTier)}
                style={{
                  background: nobilityColors(nobleTier).bg,
                  color: nobilityColors(nobleTier).text,
                  borderColor: nobilityColors(nobleTier).border,
                }}
              >
                <span className="role-pill__glyph" aria-hidden>
                  ♛
                </span>
                <span className="role-pill__text">
                  {nobilityLabel(nobleTier)}
                </span>
              </span>
            ) : null,
          id: code ? (
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
          ) : null,
        }}
      />
    </div>
  );

  if (coupleNode && user?.bond) {
    const partnerName = user.bond.partnerName;
    const phrase = coupleWithLabel(user.bond.couplePhrase);
    return (
      <div className={shellClass}>
        <div className="identity-badge__couple-stage">
          <div className="identity-badge__couple-bg" aria-hidden />
          <div className="identity-badge__couple-stars" aria-hidden />
          <div className="identity-badge__couple-wrap">{coupleNode}</div>
          <div className="identity-badge__couple-identity" ref={loginHintRef}>
            <div className="identity-badge__couple-names">
              <ColoredName
                as="button"
                name={name}
                colorId={user?.nameColor}
                effectId={user?.nameEffect}
                className={`${nameClass} identity-badge__couple-name identity-badge__couple-name--a`}
                title={
                  loginHint
                    ? "Ấn xem @username · giữ để đổi tên"
                    : onNameClick
                      ? "Đổi tên"
                      : undefined
                }
                onClick={onCoupleNameClick}
                onPointerDown={onCoupleNamePointerDown}
                onPointerUp={onCoupleNamePointerUp}
                onPointerLeave={onCoupleNamePointerUp}
                onPointerCancel={onCoupleNamePointerUp}
              />
              <span className="identity-badge__with">{phrase}</span>
              <span
                className="identity-badge__couple-name identity-badge__couple-name--b truncate font-play"
                title={partnerName}
              >
                {partnerName}
              </span>
            </div>
            {loginHint && showLoginHint && (
              <p
                className="identity-badge__login-hint"
                title="Username đăng nhập"
              >
                @{loginHint}
              </p>
            )}
          </div>
        </div>
        {rolesTable}
        {showPath && (
          <p
            className={`identity-badge__path truncate font-mono text-[var(--play-muted)] ${
              compact ? "text-[9px]" : "text-[10px]"
            }`}
          >
            {compact ? play : `${path} · chơi ${play}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="identity-badge__solo-row">
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
        <div className="identity-badge__meta min-w-0 flex-1">
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
      {rolesTable}
    </div>
  );
}
