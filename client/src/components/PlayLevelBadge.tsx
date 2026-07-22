import {
  playLevelFromRounds,
  playLevelProgress,
  playLevelTitle,
} from "../playLevel";

interface PlayLevelBadgeProps {
  rounds?: number | null;
  /** sm = badge; md = hồ sơ */
  size?: "sm" | "md";
  className?: string;
  showTitle?: boolean;
  showBar?: boolean;
}

/** Chip cấp độ 1–99 theo số ván đã chơi. */
export function PlayLevelBadge({
  rounds,
  size = "sm",
  className = "",
  showTitle = false,
  showBar = false,
}: PlayLevelBadgeProps) {
  if (rounds == null || !Number.isFinite(rounds)) return null;
  const prog = playLevelProgress(rounds);
  const title = playLevelTitle(prog.level);
  const tier =
    prog.level >= 90
      ? "myth"
      : prog.level >= 70
        ? "ace"
        : prog.level >= 50
          ? "elite"
          : prog.level >= 30
            ? "vet"
            : prog.level >= 15
              ? "adept"
              : prog.level >= 5
                ? "trainee"
                : "novice";

  return (
    <div
      className={`play-level play-level--${size} play-level--${tier} ${className}`}
      data-level={prog.level}
      title={`Cấp ${prog.level} · ${title} · ${prog.rounds.toLocaleString("vi-VN")} ván`}
    >
      <span className="play-level__chip">
        <span className="play-level__glyph" aria-hidden>
          ▲
        </span>
        <span className="play-level__text">
          {prog.level}
          {showTitle ? (
            <span className="play-level__title"> · {title}</span>
          ) : null}
        </span>
      </span>
      {showBar && (
        <div
          className="play-level__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(prog.ratio * 100)}
          aria-label={
            prog.isMax
              ? "Đã đạt cấp tối đa"
              : `Còn ${prog.needForNext.toLocaleString("vi-VN")} ván lên cấp`
          }
        >
          <span
            className="play-level__bar-fill"
            style={{ width: `${Math.round(prog.ratio * 100)}%` }}
          />
        </div>
      )}
      {showBar && !prog.isMax && size === "md" && (
        <p className="play-level__hint">
          Còn {prog.needForNext.toLocaleString("vi-VN")} ván →{" "}
          {prog.level + 1}
        </p>
      )}
      {showBar && prog.isMax && size === "md" && (
        <p className="play-level__hint">Đã đạt cấp tối đa</p>
      )}
    </div>
  );
}

export { playLevelFromRounds, playLevelProgress, playLevelTitle };
