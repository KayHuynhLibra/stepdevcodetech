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
}: {
  src: string;
  sizeClass: string;
  ringClass: string;
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
      className={`rounded-full object-cover ${ringClass} ${sizeClass}`}
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

/** [avatarA] — [ring] — [avatarB] */
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
  const ringSize = compact ? "h-7 w-7 text-lg" : "h-10 w-10 text-2xl";
  const ringClass = "ring-2 ring-[var(--gold)]/55 shadow";
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
      className={`relative flex shrink-0 items-center justify-center ${fxClass} ${ringSize}`}
      title={ringAlt}
      aria-label={ringAlt}
    >
      <span
        className="flex h-full w-full items-center justify-center"
        style={ringVisualStyle(ringSharpness)}
      >
        {isRingEmoji(ringImage) ? (
          <span className="leading-none">{ringImage || "💍"}</span>
        ) : (
          <img
            src={ringImage}
            alt={ringAlt}
            decoding="async"
            className="h-full w-full object-contain"
            draggable={false}
          />
        )}
      </span>
    </span>
  );

  const aNode = (
    <AvatarImg src={avatarA} sizeClass={sizeClass} ringClass={ringClass} />
  );

  return (
    <div
      className={`flex shrink-0 items-center gap-1 ${className}`}
      title="Cặp đôi"
    >
      {onAvatarAClick ? (
        <button
          type="button"
          onClick={onAvatarAClick}
          className="relative shrink-0 active:scale-[0.97]"
          title="Đổi avatar"
        >
          {aNode}
          <span className="absolute -bottom-0.5 -right-0.5 z-10 rounded-full bg-[var(--wood-deep)] px-1 text-[8px] font-bold leading-tight text-[var(--cream)] ring-1 ring-[var(--gold)]/50">
            Đổi
          </span>
        </button>
      ) : (
        <span className="relative shrink-0">{aNode}</span>
      )}
      {ringNode}
      <AvatarImg src={avatarB} sizeClass={sizeClass} ringClass={ringClass} />
    </div>
  );
}
