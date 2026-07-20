import type { StreakBonusRules } from "../../lib/arcanaPayout";
import { ArcanaStreakStats } from "./ArcanaStreakStats";

export function ArcanaStreakPanel({
  luckStreak,
  streakBonus,
  variant = "inline",
}: {
  luckStreak: number;
  streakBonus: StreakBonusRules & { nextWinBonusPercent?: number };
  variant?: "inline" | "sheet";
}) {
  const inner = (
    <>
      {variant === "inline" && (
        <p className="play-heading text-center text-sm">Luck streak</p>
      )}
      <div className={variant === "sheet" ? "arcana-streak-frame arcana-streak-frame--sheet mt-0" : "mt-2"}>
        {variant === "sheet" && (
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--gold-soft)]/90">
            Details
          </p>
        )}
        <ArcanaStreakStats luckStreak={luckStreak} streakBonus={streakBonus} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--play-muted)]">
        Wins in a row increase your streak (+1); losses decrease it (−1). A
        negative streak is stats only — no penalty. When your win streak before a
        spin is ≥ {streakBonus.minStreak} and you win, you earn up to{" "}
        {streakBonus.capPercent}% extra on the base payout.
      </p>
    </>
  );

  if (variant === "sheet") {
    return <div className="px-1 pb-2">{inner}</div>;
  }

  return (
    <section className="arcana-streak-panel app-panel mt-3 p-3">{inner}</section>
  );
}
