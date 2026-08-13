import { userDisplayName, userShowsVip, type AuthUser } from "../auth";
import { ColoredName } from "./ColoredName";
import { RoleAvatarFrame } from "./RoleAvatarFrame";
import { RoleRail } from "./RoleRail";
import { CoupleAvatar } from "./CoupleAvatar";
import {
  normalizeProfileTheme,
  normalizeNameFrame,
  normalizeIdFrame,
  resolveDisplayAvatarFrame,
} from "../profileStyles";
import {
  cultivationLabel,
  getCultivationColor,
  isCultivationRank,
} from "../cultivation";
import { displayBadgeDef } from "../displayBadges";
import { coupleWithLabel, isRingEmoji } from "../rings";
import {
  resolveRoleColorStyle,
  resolveRoleGlyph,
  resolveRoleLabel,
  type RoleDisplayPublic,
} from "../roleDisplay";
import { useRoleDisplay } from "./RoleRail";

interface CelestialProfilePreviewProps {
  user: AuthUser;
  roleDisplay?: RoleDisplayPublic | null;
  /** Thu gọn cho sheet cosmetics */
  compact?: boolean;
  className?: string;
}

/**
 * Preview hồ sơ chiêm tinh — đúng UI người khác thấy khi bấm avatar.
 * Không có nút Thoát / staff / tặng xu.
 */
export function CelestialProfilePreview({
  user,
  roleDisplay,
  compact = true,
  className = "",
}: CelestialProfilePreviewProps) {
  const rd = useRoleDisplay(roleDisplay);
  const name = userDisplayName(user);
  const showVip = userShowsVip(user);
  const targetBonded = user.bond?.status === "active";
  const theme = normalizeProfileTheme(user.profileTheme);
  const nameFrame = normalizeNameFrame(user.nameFrame);
  const idFrame = normalizeIdFrame(user.idFrame);
  const displayFrame = resolveDisplayAvatarFrame(user.avatarFrame, {
    isVip: showVip,
    bonded: targetBonded,
    role: user.role,
  });
  const roleName = resolveRoleLabel(
    user.role === "user" ? "user" : user.role,
    rd.roleLabels,
  );
  const coupleLabel = resolveRoleLabel("couple", rd.roleLabels);
  const vipLabel = resolveRoleLabel("vip", rd.roleLabels);

  return (
    <div
      className={`profile-celestial profile-celestial--preview relative overflow-hidden rounded-2xl border border-[#8A9BB8]/45 bg-[#0B1528]/92 text-[#E3D8C4] shadow-[0_0_24px_rgba(120,150,200,0.16)] ${
        compact ? "profile-celestial--preview-compact" : ""
      } ${className}`}
      data-theme={theme}
      aria-label="Preview hồ sơ chiêm tinh (người khác thấy)"
    >
      <div className="profile-celestial__ornament" aria-hidden />
      <div className="profile-celestial__stars" aria-hidden />

      <p className="relative z-[1] px-3 pt-2 text-[9px] font-bold uppercase tracking-wide text-[#8A9EB8]">
        Người khác thấy · Hồ Sơ Chiêm Tinh · {theme}
      </p>

      <div className="relative z-[1] mx-2 mt-1 rounded-xl border border-[#3A4E6C]/50 profile-celestial__hero">
        <div className="profile-celestial__couple-stage !min-h-0 !py-2">
          {targetBonded && user.bond ? (
            <CoupleAvatar
              displaySize="compact"
              className="profile-celestial__couple"
              avatarA={user.avatar || "/assets/ui/avatar-default.png"}
              avatarB={user.bond.partnerAvatar}
              ringImage={user.bond.ringImage}
              ringAlt={user.bond.ringNameVi}
              ringEffect={user.bond.ringEffect}
              ringSharpness={user.bond.ringSharpness}
              coupleFrame={user.bond.coupleFrame}
              coupleBorder={user.bond.coupleBorder}
              coupleScale="md"
              coupleMotion={
                user.bond.coupleMotion === "none" ? "none" : "breathe"
              }
              coupleGap="normal"
              coupleLayout="classic"
              ringFrame={user.bond.ringFrame}
              ringFrameScale="sm"
            />
          ) : (
            <RoleAvatarFrame
              size={compact ? "md" : "lg"}
              src={user.avatar || "/assets/ui/avatar-default.png"}
              frame={user.avatarFrame}
              isVip={showVip}
              bonded={targetBonded}
              accountRole={user.role}
              alt=""
            />
          )}
        </div>
      </div>

      <div
        className="profile-celestial__identity relative z-[1] !pb-3 !pt-2"
        data-avatar-frame={displayFrame}
      >
        <div
          className={`profile-name-frame profile-name-frame--${nameFrame}`}
          data-frame={nameFrame}
        >
          <ColoredName
            name={name}
            colorId={user.nameColor}
            effectId={user.nameEffect}
            as="p"
            className={`font-display text-center font-bold leading-tight text-[#F3EAD8] ${
              compact ? "text-lg" : "text-2xl"
            }`}
          />
        </div>

        {targetBonded && user.bond && (
          <p className="profile-celestial__partner !text-[10px]">
            <span className="profile-celestial__with font-semibold text-[#FFD0DC]">
              {coupleWithLabel(user.bond.couplePhrase)}
            </span>
            <span aria-hidden>💖</span>
            <span className="font-medium text-[#E3D8C4]">
              {user.bond.partnerName}
            </span>
            {!isRingEmoji(user.bond.ringImage) ? (
              <img
                src={user.bond.ringImage}
                alt=""
                className="inline-block h-3.5 w-3.5 object-contain align-middle"
              />
            ) : null}
          </p>
        )}

        {user.code && (
          <div className="profile-celestial__id-wrap">
            <span
              className={`profile-id-frame profile-id-frame--${idFrame}`}
              data-frame={idFrame}
            >
              <span className="profile-id-frame__label">ID</span>
              <span className="profile-id-frame__value">{user.code}</span>
            </span>
          </div>
        )}

        <div className="profile-celestial__roles" role="list">
          <RoleRail
            config={rd}
            slots={{
              couple: targetBonded ? (
                <span
                  className="role-pill role-pill--couple"
                  role="listitem"
                  style={resolveRoleColorStyle("couple", rd.roleColors)}
                >
                  <span className="role-pill__glyph" aria-hidden>
                    {resolveRoleGlyph("couple")}
                  </span>
                  <span className="role-pill__text">{coupleLabel}</span>
                </span>
              ) : null,
              vip: showVip ? (
                <span
                  className="role-pill role-pill--vip"
                  role="listitem"
                  style={resolveRoleColorStyle("vip", rd.roleColors)}
                >
                  <span className="role-pill__glyph" aria-hidden>
                    {resolveRoleGlyph("vip")}
                  </span>
                  <span className="role-pill__text">{vipLabel}</span>
                </span>
              ) : null,
              cult:
                user.cultivationRank &&
                isCultivationRank(user.cultivationRank) ? (
                  <span
                    className="role-pill role-pill--cult"
                    role="listitem"
                      style={{
                        ...resolveRoleColorStyle("tutien", rd.roleColors),
                        borderColor: getCultivationColor(user.cultivationRank)
                          ?.border,
                        color:
                          resolveRoleColorStyle("tutien", rd.roleColors)
                            ?.color ??
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
              role: (
                <span
                  className={`role-pill role-pill--role role-pill--${user.role}`}
                  role="listitem"
                  style={resolveRoleColorStyle(
                    user.role === "user" ? "user" : user.role,
                    rd.roleColors,
                  )}
                >
                  <span className="role-pill__glyph" aria-hidden>
                    {resolveRoleGlyph(
                      user.role === "user" ? "user" : user.role,
                    )}
                  </span>
                  <span className="role-pill__text">{roleName}</span>
                </span>
              ),
              badges:
                user.displayBadges && user.displayBadges.length > 0 ? (
                  <>
                    {user.displayBadges.map((bid) => {
                      const def = displayBadgeDef(bid);
                      if (!def) return null;
                      return (
                        <span
                          key={def.id}
                          className={`role-pill role-pill--badge role-pill--badge-${def.tone}`}
                          role="listitem"
                          title={def.label}
                        >
                          <span className="role-pill__glyph" aria-hidden>
                            {def.glyph}
                          </span>
                          <span className="role-pill__text">{def.label}</span>
                        </span>
                      );
                    })}
                  </>
                ) : null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
