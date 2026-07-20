import type { CSSProperties } from "react";

export const FANTASY_SPARKLE_ANGLES = [10, 55, 100, 145, 190, 235, 280, 325];
export const FANTASY_STAR_ANGLES = [30, 78, 126, 174, 222, 270, 318];

export function fantasyParticleStyle(
  deg: number,
  radiusPct: number,
  index: number,
  kind: "sparkle" | "star",
): CSSProperties {
  return {
    top: `${50 - radiusPct * Math.cos((deg * Math.PI) / 180)}%`,
    left: `${50 + radiusPct * Math.sin((deg * Math.PI) / 180)}%`,
    ...(kind === "sparkle"
      ? { "--sparkle-i": index }
      : { "--star-i": index }),
  } as CSSProperties;
}
