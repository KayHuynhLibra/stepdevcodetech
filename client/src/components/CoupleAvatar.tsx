import type { CSSProperties, SyntheticEvent } from "react";
import { DEFAULT_AVATAR, normalizeAvatar } from "../avatars";
import {
  isRingEmoji,
  normalizeRingEffect,
  type RingEffect,
} from "../rings";

interface CoupleAvatarProps {
  avatarA: string;
  avatarB: string;
  ringImage: string;
  ringAlt?: string;
  ringEffect?: RingEffect | string;
  /** 0–100 */
  ringSharpness?: number;
  compact?: boolean;
  /** Click avatar A (thường là mình) */
  onAvatarAClick?: () => void;
  className?: string;
}

function AvatarImg({
  src,
  sizeClass,
  ringClass,
  className = "",
}: {
  src: string;
  sizeClass: string;
  ringClass: string;
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
      className={`couple-avatar__face rounded-full object-cover ${ringClass} ${sizeClass} ${className}`}
      onError={onError}
    />
  );
}

function ringVisualStyle(sharpness: number): CSSProperties {
  const s = Math.max(0, Math.min(100, Math.floor(sharpness)));
  /** 0 → mờ/nhỏ; 100 → nét + phóng nhẹ */
  const scale = 0.72 + (s / 100) * 0.55;
  const contrast = 0.85 + (s / 100) * 0.45;
  const saturate = 0.9 + (s / 100) * 0.35;
  return {
    transform: `scale(${scale.toFixed(3)})`,
    filter: `contrast(${contrast.toFixed(2)}) saturate(${saturate.toFixed(2)})`,
    imageRendering: s >= 80 ? "auto" : "auto",
  };
}

/** [avatarA] ⧉ [ring] ⧉ [avatarB] — chồng nhẹ, nhẫn giữa trên pedestal */
export function CoupleAvatar({
  avatarA,
  avatarB,
  ringImage,
  ringAlt = "Nhẫn",
  ringEffect,
  ringSharpness = 70,
  compact = false,
  onAvatarAClick,
  className = "",
}: CoupleAvatarProps) {
  const sizeClass = compact ? "h-9 w-9" : "h-14 w-14";
  const ringSize = compact ? "h-6 w-6 text-base" : "h-9 w-9 text-xl";
  const pedestalSize = compact ? "h-8 w-8" : "h-11 w-11";
  const ringClass =
    "ring-2 ring-[var(--gold)]/60 shadow-[0_2px_8px_rgba(24,12,4,0.45)]";
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

  const ringNode = (
    <span
      className={`couple-avatar__ring-badge relative z-[3] flex shrink-0 items-center justify-center ${pedestalSize}`}
      title={ringAlt}
      aria-label={ringAlt}
    >
      <span
        className={`relative flex items-center justify-center ${fxClass} ${ringSize}`}
      >
        <span
          className="flex h-full w-full items-center justify-center"
          style={ringVisualStyle(ringSharpness)}
        >
          {isRingEmoji(ringImage) ? (
            <span className="leading-none drop-shadow-sm">
              {ringImage || "💍"}
            </span>
          ) : (
            <img
              src={ringImage}
              alt={ringAlt}
              decoding="async"
              className="h-full w-full object-contain drop-shadow-sm"
              draggable={false}
            />
          )}
        </span>
      </span>
    </span>
  );

  const aNode = (
    <AvatarImg
      src={avatarA}
      sizeClass={sizeClass}
      ringClass={ringClass}
      className="relative z-[2]"
    />
  );

  return (
    <div
      className={`couple-avatar ${compact ? "couple-avatar--compact" : ""} ${className}`}
      title="Cặp đôi"
    >
      <span className="couple-avatar__heart" aria-hidden>
        ♥
      </span>
      {onAvatarAClick ? (
        <button
          type="button"
          onClick={onAvatarAClick}
          className="couple-avatar__slot couple-avatar__slot--a relative shrink-0 active:scale-[0.97]"
          title="Đổi avatar"
        >
          {aNode}
          <span className="absolute -bottom-0.5 -right-0.5 z-10 rounded-full bg-[var(--wood-deep)] px-1 text-[8px] font-bold leading-tight text-[var(--cream)] ring-1 ring-[var(--gold)]/50">
            Đổi
          </span>
        </button>
      ) : (
        <span className="couple-avatar__slot couple-avatar__slot--a relative shrink-0">
          {aNode}
        </span>
      )}
      {ringNode}
      <span className="couple-avatar__slot couple-avatar__slot--b relative shrink-0">
        <AvatarImg
          src={avatarB}
          sizeClass={sizeClass}
          ringClass={ringClass}
          className="relative z-[1]"
        />
      </span>
    </div>
  );
}
