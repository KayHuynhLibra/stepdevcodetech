import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import { DEFAULT_AVATAR, normalizeAvatar } from "../avatars";
import {
  normalizeAvatarFrame,
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
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "className" | "size"> {
  src: string;
  frame?: AvatarFrameId | string | null;
  size?: RoleAvatarSize;
  className?: string;
  /** Fallback VIP aura khi frame=none và isVip */
  isVip?: boolean;
}

/** Avatar đơn với khung role (RoleAD catalog). */
export function RoleAvatarFrame({
  src,
  frame,
  size = "md",
  className = "",
  isVip = false,
  alt = "",
  ...imgProps
}: RoleAvatarFrameProps) {
  const id = normalizeAvatarFrame(frame);
  const onError = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.src.includes("avatar-default")) return;
    el.src = DEFAULT_AVATAR;
    imgProps.onError?.(e);
  };

  if (id === "none" && isVip) {
    const vipSize = size === "sm" ? "sm" : size === "md" ? "md" : "lg";
    return (
      <VipFantasyAvatar
        {...imgProps}
        src={normalizeAvatar(src) || DEFAULT_AVATAR}
        alt={alt}
        size={vipSize}
        className={className}
        onError={onError}
      />
    );
  }

  if (id === "none") {
    return (
      <img
        {...imgProps}
        src={normalizeAvatar(src) || DEFAULT_AVATAR}
        alt={alt}
        className={`rounded-full object-cover border-4 border-[#C8A968] shadow-[0_0_15px_rgba(200,169,104,0.45)] ${SIZE_CLASS[size]} ${className}`}
        onError={onError}
      />
    );
  }

  return (
    <span
      className={`role-avatar-frame role-avatar-frame--${id} inline-flex shrink-0 items-center justify-center ${className}`}
      data-frame={id}
      data-size={size}
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
