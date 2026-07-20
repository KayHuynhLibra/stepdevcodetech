import type { ImgHTMLAttributes } from "react";
import {
  FANTASY_SPARKLE_ANGLES,
  FANTASY_STAR_ANGLES,
  fantasyParticleStyle,
} from "../lib/fantasyParticles";

export type VipFantasyAvatarSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<VipFantasyAvatarSize, string> = {
  sm: "vip-fantasy-avatar--sm h-9 w-9",
  md: "vip-fantasy-avatar--md h-14 w-14",
  lg: "vip-fantasy-avatar--lg h-[5.25rem] w-[5.25rem]",
};

interface VipFantasyAvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "className"> {
  size?: VipFantasyAvatarSize;
  className?: string;
  /** Bật aura + particle (mặc định true — dùng cho VIP) */
  fx?: boolean;
}

/** Avatar VIP thử nghiệm: aura tím–xanh + sao lấp lánh (giống bánh xe Arcana). */
export function VipFantasyAvatar({
  size = "md",
  className = "",
  fx = true,
  alt = "",
  ...imgProps
}: VipFantasyAvatarProps) {
  const sparkleRadius = size === "sm" ? 52 : size === "lg" ? 56 : 54;
  const starRadius = size === "sm" ? 58 : size === "lg" ? 62 : 60;

  return (
    <span
      className={`vip-fantasy-avatar inline-flex shrink-0 items-center justify-center ${SIZE_CLASS[size]} ${className}`}
    >
      {fx && (
        <>
          <span
            className="arcana-aura vip-fantasy-avatar__aura pointer-events-none absolute rounded-full"
            style={{ inset: size === "sm" ? -5 : size === "lg" ? -10 : -7 }}
            aria-hidden
          />
          <span
            className="arcana-aura-inner vip-fantasy-avatar__aura pointer-events-none absolute rounded-full"
            style={{ inset: size === "sm" ? -3 : size === "lg" ? -6 : -4 }}
            aria-hidden
          />
          {FANTASY_SPARKLE_ANGLES.map((deg, i) => (
            <span
              key={`vip-sp-${deg}`}
              className="arcana-sparkle vip-fantasy-avatar__sparkle pointer-events-none"
              style={fantasyParticleStyle(deg, sparkleRadius, i, "sparkle")}
              aria-hidden
            />
          ))}
          {FANTASY_STAR_ANGLES.map((deg, i) => (
            <span
              key={`vip-st-${deg}`}
              className="arcana-star vip-fantasy-avatar__star pointer-events-none"
              style={fantasyParticleStyle(deg, starRadius, i, "star")}
              aria-hidden
            >
              ✦
            </span>
          ))}
        </>
      )}
      <img
        {...imgProps}
        alt={alt}
        className={`vip-fantasy-avatar__img rounded-full object-cover ${fx ? "vip-fantasy-avatar__img--fx" : ""}`}
      />
    </span>
  );
}
