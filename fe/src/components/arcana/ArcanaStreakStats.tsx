import type { StreakBonusRules } from "../../lib/arcanaPayout";

export function ArcanaStreakStats({
  luckStreak,
  streakBonus,
}: {
  luckStreak: number;
  streakBonus: StreakBonusRules & { nextWinBonusPercent?: number };
}) {
  const positive = luckStreak > 0;
  const negative = luckStreak < 0;
  const nextPct = streakBonus.nextWinBonusPercent ?? 0;
  const cap = Math.max(1, streakBonus.capPercent);
  const barPct =
    streakBonus.enabled && nextPct > 0
      ? Math.min(100, Math.round((nextPct / cap) * 100))
      : 0;
  const bonusDisplay =
    streakBonus.enabled && nextPct > 0 ? `+${nextPct}%` : "—";
  const streakDisplay =
    luckStreak > 0 ? `+${luckStreak}` : String(luckStreak);

  return (
    <div className="arcana-streak-grid">
      <div
        className={`arcana-streak-stat ${
          positive
            ? "arcana-streak-stat--hot"
            : negative
              ? "arcana-streak-stat--cold"
              : ""
        }`}
      >
        <span className="arcana-streak-stat-label">Streak</span>
        <span
          className={`arcana-streak-stat-value ${
            positive
              ? "text-[var(--jade-soft)]"
              : negative
                ? "text-rose-400"
                : "text-[var(--cream)]"
          }`}
          aria-live="polite"
        >
          {streakDisplay}
        </span>
      </div>
      <div className="arcana-streak-stat arcana-streak-stat--bonus">
        <span className="arcana-streak-stat-label">Next win bonus</span>
        <span className="arcana-streak-stat-value text-[#f5e0a8]">
          {bonusDisplay}
        </span>
        <div
          className="arcana-streak-bar mt-1.5"
          role="presentation"
          aria-hidden
        >
          <div
            className="arcana-streak-bar-fill"
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
