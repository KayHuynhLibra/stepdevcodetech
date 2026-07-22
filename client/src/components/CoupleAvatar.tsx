import type { SyntheticEvent } from "react";
import { DEFAULT_AVATAR, normalizeAvatar } from "../avatars";
import { isRingEmoji } from "../rings";

interface CoupleAvatarProps {
  avatarA: string;
  avatarB: string;
  ringImage: string;
  ringAlt?: string;
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

/** [avatarA] — [ring] — [avatarB] */
export function CoupleAvatar({
  avatarA,
  avatarB,
  ringImage,
  ringAlt = "Nhẫn",
  compact = false,
  onAvatarAClick,
  className = "",
}: CoupleAvatarProps) {
  const sizeClass = compact ? "h-9 w-9" : "h-14 w-14";
  const ringSize = compact ? "h-6 w-6 text-base" : "h-8 w-8 text-xl";
  const ringClass = "ring-2 ring-[var(--gold)]/55 shadow";

  const ringNode = isRingEmoji(ringImage) ? (
    <span
      className={`flex shrink-0 items-center justify-center ${ringSize}`}
      title={ringAlt}
      aria-label={ringAlt}
    >
      {ringImage || "💍"}
    </span>
  ) : (
    <img
      src={ringImage}
      alt={ringAlt}
      decoding="async"
      className={`shrink-0 object-contain ${ringSize}`}
    />
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
