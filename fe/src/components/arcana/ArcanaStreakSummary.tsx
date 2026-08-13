import { useMemo } from "react";
import type { StreakBonusRules } from "../../lib/arcanaPayout";
import { ArcanaInfoButton } from "./ArcanaInfoButton";
import { ArcanaStreakStats } from "./ArcanaStreakStats";

export function ArcanaStreakSummary({
  luckStreak,
  streakBonus,
  onDetail,
}: {
  luckStreak: number;
  streakBonus: StreakBonusRules & { nextWinBonusPercent?: number };
  onDetail: () => void;
}) {
  const nextPct = streakBonus.nextWinBonusPercent ?? 0;

  const tickerPhrase = useMemo(() => {
    if (streakBonus.enabled && nextPct > 0) {
      return `+${nextPct}% ON WIN · STREAK BONUS · +${nextPct}% ON WIN · STREAK BONUS · `;
    }
    return "BUILD YOUR STREAK · WIN TO EARN BONUS · BUILD YOUR STREAK · WIN TO EARN BONUS · ";
  }, [streakBonus.enabled, nextPct]);

  return (
    <div className="arcana-streak-block mt-2 px-1">
      <div className="arcana-streak-frame">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--gold-soft)]/90">
            Luck streak
          </p>
          <ArcanaInfoButton onClick={onDetail} ariaLabel="Luck streak details">
            ⓘ
          </ArcanaInfoButton>
        </div>
        <ArcanaStreakStats luckStreak={luckStreak} streakBonus={streakBonus} />
        <div className="arcana-streak-ticker mt-3" aria-hidden>
          <div className="arcana-streak-ticker-track">
            <span>{tickerPhrase}</span>
            <span>{tickerPhrase}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
