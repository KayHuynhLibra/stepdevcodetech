import type { CSSProperties, SyntheticEvent } from "react";
import { DEFAULT_AVATAR, normalizeAvatar } from "../avatars";
import {
  isRingEmoji,
  normalizeCoupleBorder,
  normalizeCoupleFrame,
  normalizeCoupleScale,
  normalizeRingEffect,
  type CoupleBorderStyle,
  type CoupleFrameScale,
  type CoupleFrameStyle,
  type RingEffect,
} from "../rings";

export type CoupleDisplaySize = "compact" | "default" | "hero";

interface CoupleAvatarProps {
  avatarA: string;
  avatarB: string;
  ringImage: string;
  ringAlt?: string;
  ringEffect?: RingEffect | string;
  ringSharpness?: number;
  coupleFrame?: CoupleFrameStyle | string;
  coupleBorder?: CoupleBorderStyle | string;
  coupleScale?: CoupleFrameScale | string;
  /** compact = badge; default = sheet thường; hero = profile modal lớn */
  displaySize?: CoupleDisplaySize;
  compact?: boolean;
  onAvatarAClick?: () => void;
  className?: string;
}

function AvatarImg({
  src,
  sizeClass,
  className = "",
}: {
  src: string;
  sizeClass: string;
  className?: string;
}) {
  const onError = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.src.includes("avatar-default")) return;
    el.src = DEFAULT_AVATAR;
  };
  return (
    <img
      src={normalizeAvatar(src) || DEFAULT_AVATAR}
      alt=""
      decoding="async"
      className={`couple-avatar__face object-cover ${sizeClass} ${className}`}
      onError={onError}
    />
  );
}

function FramedAvatar({
  src,
  sizeClass,
  compact,
}: {
  src: string;
  sizeClass: string;
  compact: boolean;
}) {
  return (
    <span
      className={`couple-avatar__frame ${compact ? "couple-avatar__frame--compact" : ""}`}
    >
      <span className="couple-avatar__frame-rim" aria-hidden />
      <AvatarImg src={src} sizeClass={sizeClass} />
    </span>
  );
}

function ringVisualStyle(sharpness: number): CSSProperties {
  const s = Math.max(0, Math.min(100, Math.floor(sharpness)));
  const scale = 0.82 + (s / 100) * 0.38;
  const contrast = 0.9 + (s / 100) * 0.35;
  const saturate = 0.95 + (s / 100) * 0.35;
  return {
    transform: `scale(${scale.toFixed(3)})`,
    filter: `contrast(${contrast.toFixed(2)}) saturate(${saturate.toFixed(2)})`,
  };
}

function faceSizeClass(
  display: CoupleDisplaySize,
  scale: CoupleFrameScale,
): string {
  if (display === "compact") {
    if (scale === "xl" || scale === "lg") return "h-11 w-11";
    return "h-9 w-9";
  }
  if (display === "hero") {
    switch (scale) {
      case "sm":
        return "h-20 w-20 md:h-24 md:w-24";
      case "md":
        return "h-24 w-24 md:h-28 md:w-28";
      case "lg":
        return "h-28 w-28 md:h-32 md:w-32";
      default:
        return "h-28 w-28 md:h-32 md:w-32";
    }
  }
  switch (scale) {
    case "sm":
      return "h-12 w-12";
    case "md":
      return "h-[4.25rem] w-[4.25rem]";
    case "lg":
      return "h-20 w-20";
    default:
      return "h-[5.25rem] w-[5.25rem]";
  }
}

/** [A] — oval nhẫn — [B]; frame/border/scale từ catalog nhẫn. */
export function CoupleAvatar({
  avatarA,
  avatarB,
  ringImage,
  ringAlt = "Nhẫn",
  ringEffect,
  ringSharpness = 70,
  coupleFrame,
  coupleBorder,
  coupleScale,
  displaySize,
  compact = false,
  onAvatarAClick,
  className = "",
}: CoupleAvatarProps) {
  const display: CoupleDisplaySize =
    displaySize ?? (compact ? "compact" : "default");
  const frame = normalizeCoupleFrame(coupleFrame);
  const border = normalizeCoupleBorder(coupleBorder);
  const scale = normalizeCoupleScale(coupleScale);
  const sizeClass = faceSizeClass(display, scale);
  const effect = normalizeRingEffect(ringEffect);
  const fxClass =
    effect === "glow"
      ? "ring-fx ring-fx--glow"
      : effect === "pulse"
        ? "ring-fx ring-fx--pulse"
        : effect === "sparkle"
          ? "ring-fx ring-fx--sparkle"
          : effect === "orbit"
            ? "ring-fx ring-fx--orbit"
            : "ring-fx";

  const aFace = (
    <FramedAvatar
      src={avatarA}
      sizeClass={sizeClass}
      compact={display === "compact"}
    />
  );

  return (
    <div
      className={`couple-avatar couple-avatar--${display} ${className}`}
      data-frame={frame}
      data-border={border}
      data-scale={scale}
      title="Cặp đôi"
    >
      <span className="couple-avatar__trail couple-avatar__trail--l" aria-hidden />
      <span className="couple-avatar__trail couple-avatar__trail--r" aria-hidden />

      {onAvatarAClick ? (
        <button
          type="button"
          onClick={onAvatarAClick}
          className="couple-avatar__slot couple-avatar__slot--a relative shrink-0 active:scale-[0.97]"
          title="Đổi avatar"
        >
          {aFace}
          <span className="couple-avatar__swap">Đổi</span>
        </button>
      ) : (
        <span className="couple-avatar__slot couple-avatar__slot--a relative shrink-0">
          {aFace}
        </span>
      )}

      <div
        className="couple-avatar__oval"
        title={ringAlt}
        aria-label={ringAlt}
      >
        <div className="couple-avatar__oval-inner">
          <span
            className={`couple-avatar__ring-visual relative flex h-full w-full items-center justify-center ${fxClass}`}
          >
            <span
              className="flex h-[90%] w-[90%] items-center justify-center"
              style={ringVisualStyle(ringSharpness)}
            >
              {isRingEmoji(ringImage) ? (
                <span className="couple-avatar__ring-emoji leading-none">
                  {ringImage || "💍"}
                </span>
              ) : (
                <img
                  src={ringImage}
                  alt={ringAlt}
                  decoding="async"
                  className="h-full w-full object-contain drop-shadow-md"
                  draggable={false}
                />
              )}
            </span>
          </span>
        </div>
        <span className="couple-avatar__pedestal" aria-hidden />
        <span className="couple-avatar__heart" aria-hidden>
          ♥
        </span>
      </div>

      <span className="couple-avatar__slot couple-avatar__slot--b relative shrink-0">
        <FramedAvatar
          src={avatarB}
          sizeClass={sizeClass}
          compact={display === "compact"}
        />
      </span>
    </div>
  );
}
