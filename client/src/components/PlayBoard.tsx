import { memo, useMemo } from "react";
import { CARDS, formatXu, type Phase, type GameState } from "../cards";
import { usePhaseRemaining } from "../hooks/usePhaseRemaining";

const MAX_CARDS_PER_ROUND = 5;
/** Đồng bộ server PHASE_MS.placing — dùng cho thanh tiến trình */
const BETTING_SECONDS = 30;

interface PlayBoardProps {
  phaseEndsAt: number;
  serverTime: number;
  canPlace: boolean;
  playerCounts: number[];
  yourStakes: number[];
  winningCardId: number | null;
  phase: Phase | null;
  cardHeat?: GameState["cardHeat"];
  onPick: (cardId: number) => void;
}

function PlayBoardInner({
  phaseEndsAt,
  serverTime,
  canPlace,
  playerCounts,
  yourStakes,
  winningCardId,
  phase,
  cardHeat,
  onPick,
}: PlayBoardProps) {
  const remaining = usePhaseRemaining(phaseEndsAt, serverTime);
  const showWin =
    winningCardId != null &&
    (phase === "revealing" || phase === "payout");
  const selectedCount = yourStakes.filter((v) => v > 0).length;
  const atCardLimit = selectedCount >= MAX_CARDS_PER_ROUND;
  const seconds = canPlace || phase === "placing" ? remaining : 0;
  const urgent = canPlace && remaining > 0 && remaining <= 5;
  const timerPct = Math.max(
    0,
    Math.min(100, (seconds / BETTING_SECONDS) * 100),
  );

  const heatById = useMemo(() => {
    const m = new Map<number, "hot" | "cold" | "neutral">();
    for (const row of cardHeat ?? []) {
      m.set(row.cardId, row.level);
    }
    return m;
  }, [cardHeat]);

  return (
    <div className="board-stack tarot-board-stack mt-4">
      {/* Ambient: static only — no blur/particle layers (perf) */}

      <div
        className={`board-timer-frame tarot-board-timer ${urgent ? "board-timer-frame--urgent" : ""}`}
        style={{ ["--timer-pct" as string]: `${timerPct}%` }}
        aria-live="polite"
      >
        <div className="board-timer-row">
          <span className="board-timer-label">Đếm ngược</span>
          <span className="board-timer-value font-play tabular-nums">
            {seconds}
          </span>
        </div>
        <div className="board-timer-track" aria-hidden>
          <div className="board-timer-bar" />
        </div>
      </div>

      <section className="game-task game-task-board tarot-board-deck relative px-2.5 pb-4 pt-3">
        <p className="tarot-board-deck__title play-heading relative z-[1] mb-2 text-center text-[11px] tracking-wide">
          Bàn đặt xu
        </p>

        <div className="relative z-[1] grid grid-cols-4 gap-x-2 gap-y-3">
          {CARDS.map((card) => {
            const idx = card.id - 1;
            const people = playerCounts[idx] ?? 0;
            const mine = yourStakes[idx] ?? 0;
            const isWin = showWin && winningCardId === card.id;
            const lockedOut = canPlace && atCardLimit && mine <= 0;
            const hasStake = mine > 0;
            const heat = heatById.get(card.id);

            return (
              <button
                key={card.id}
                type="button"
                disabled={!canPlace || lockedOut}
                onClick={() => onPick(card.id)}
                className={`tarot-board-card flex flex-col items-center ${
                  lockedOut ? "tarot-board-card--locked" : ""
                } ${canPlace && !lockedOut ? "tarot-board-card--active" : ""}`}
              >
                <span className="tarot-board-card__index font-play tabular-nums">
                  {card.id}
                  {heat === "hot" && (
                    <span className="ml-0.5 text-[8px] text-orange-400" title="Lá nóng">
                      🔥
                    </span>
                  )}
                  {heat === "cold" && (
                    <span className="ml-0.5 text-[8px] text-sky-300" title="Lá lạnh">
                      ❄
                    </span>
                  )}
                </span>

                <div
                  className={`tarot-board-card__frame relative aspect-[3/4] w-full ${
                    isWin
                      ? "tarot-board-card__frame--win"
                      : hasStake
                        ? "tarot-board-card__frame--stake"
                        : ""
                  }`}
                >
                  <img
                    src={card.image}
                    alt={card.nameVi}
                    className="tarot-board-card__img"
                    draggable={false}
                    decoding="async"
                    loading="eager"
                  />
                  {hasStake && (
                    <span className="tarot-board-card__stake font-play tabular-nums">
                      {formatXu(mine)}
                    </span>
                  )}
                  {isWin && (
                    <span className="tarot-board-card__win-badge" aria-hidden>
                      ✦
                    </span>
                  )}
                </div>

                <div className="board-mult font-play mt-1 tabular-nums">
                  x{card.multiplier}
                </div>

                <p className="tarot-board-card__players board-meta mt-0.5 text-[11px] font-semibold tabular-nums">
                  {people} người
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export const PlayBoard = memo(PlayBoardInner);
