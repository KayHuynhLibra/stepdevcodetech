import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import { DEFAULT_AVATAR, normalizeAvatar } from "../avatars";
import {
  resolveDisplayAvatarFrame,
  type AvatarFrameId,
} from "../profileStyles";
import { VipFantasyAvatar } from "./VipFantasyAvatar";

export type RoleAvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<RoleAvatarSize, string> = {
  sm: "h-9 w-9",
  md: "h-14 w-14",
  lg: "h-28 w-28 md:h-32 md:w-32",
  xl: "h-28 w-28 md:h-32 md:w-32",
};

interface RoleAvatarFrameProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "className" | "size" | "role"> {
  src: string;
  frame?: AvatarFrameId | string | null;
  size?: RoleAvatarSize;
  className?: string;
  isVip?: boolean;
  /** VIP tier — ≥3 ưu tiên khung VIP fantasy nếu chưa có frame */
  vipTier?: number;
  /** Quý tộc — rim màu theo bậc */
  nobilityTier?: number;
  bonded?: boolean;
  /** Staff / account role — dùng gợi ý khung khi frame = none */
  accountRole?: string | null;
}

/** Avatar đơn với khung role (RoleAD / gợi ý theo VIP·role·couple). */
export function RoleAvatarFrame({
  src,
  frame,
  size = "md",
  className = "",
  isVip = false,
  vipTier = 0,
  nobilityTier = 0,
  bonded = false,
  accountRole = null,
  alt = "",
  ...imgProps
}: RoleAvatarFrameProps) {
  const treatVip = isVip || vipTier >= 1;
  const id = resolveDisplayAvatarFrame(frame, {
    isVip: treatVip && vipTier >= 3,
    bonded,
    role: accountRole,
  });
  const onError = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.src.includes("avatar-default")) return;
    el.src = DEFAULT_AVATAR;
    imgProps.onError?.(e);
  };

  const nobleRim =
    nobilityTier > 0
      ? {
          boxShadow: `0 0 0 2px ${nobilityBorder(nobilityTier)}`,
        }
      : undefined;

  /** VIP fantasy aura khi khung hiển thị là VIP */
  if (id === "vip") {
    const vipSize = size === "sm" ? "sm" : size === "md" ? "md" : "lg";
    return (
      <span
        className={`role-avatar-frame role-avatar-frame--vip role-avatar-frame--aura inline-flex shrink-0 items-center justify-center ${className}`}
        data-frame="vip"
        data-size={size}
        data-nobility={nobilityTier || undefined}
        style={nobleRim}
      >
        <VipFantasyAvatar
          {...imgProps}
          src={normalizeAvatar(src) || DEFAULT_AVATAR}
          alt={alt}
          size={vipSize}
          onError={onError}
        />
      </span>
    );
  }

  return (
    <span
      className={`role-avatar-frame role-avatar-frame--${id} inline-flex shrink-0 items-center justify-center ${className}`}
      data-frame={id}
      data-size={size}
      data-nobility={nobilityTier || undefined}
      style={nobleRim}
    >
      <span className="role-avatar-frame__rim" aria-hidden />
      <span className="role-avatar-frame__glow" aria-hidden />
      <img
        {...imgProps}
        src={normalizeAvatar(src) || DEFAULT_AVATAR}
        alt={alt}
        className={`role-avatar-frame__img rounded-full object-cover ${SIZE_CLASS[size]}`}
        onError={onError}
      />
    </span>
  );
}

function nobilityBorder(tier: number): string {
  const map: Record<number, string> = {
    1: "#90a4ae",
    2: "#66bb6a",
    3: "#42a5f5",
    4: "#ffb300",
    5: "#ab47bc",
    6: "#ffc107",
  };
  return map[Math.max(0, Math.min(6, Math.floor(tier)))] ?? "#90a4ae";
}
