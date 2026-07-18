import { CARDS, formatXu, type Phase } from "../cards";

const MAX_CARDS_PER_ROUND = 5;
/** Đồng bộ server PHASE_MS.betting — dùng cho thanh tiến trình */
const BETTING_SECONDS = 60;

interface BettingBoardProps {
  remaining: number;
  canBet: boolean;
  playerCounts: number[];
  yourBets: number[];
  winningCardId: number | null;
  phase: Phase | null;
  onPick: (cardId: number) => void;
}

export function BettingBoard({
  remaining,
  canBet,
  playerCounts,
  yourBets,
  winningCardId,
  phase,
  onPick,
}: BettingBoardProps) {
  const showWin =
    winningCardId != null &&
    (phase === "revealing" || phase === "payout");
  const selectedCount = yourBets.filter((v) => v > 0).length;
  const atCardLimit = selectedCount >= MAX_CARDS_PER_ROUND;
  const seconds = canBet || phase === "betting" ? remaining : 0;
  const urgent = canBet && remaining > 0 && remaining <= 5;
  const timerPct = Math.max(
    0,
    Math.min(100, (seconds / BETTING_SECONDS) * 100),
  );

  return (
    <div className="board-stack mt-4">
      {/* Khung đếm ngược — glass modern */}
      <div
        className={`board-timer-frame ${urgent ? "board-timer-frame--urgent" : ""}`}
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

      <section className="game-task game-task-board relative px-2.5 pb-4 pt-3">
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {CARDS.map((card) => {
            const idx = card.id - 1;
            const people = playerCounts[idx] ?? 0;
            const mine = yourBets[idx] ?? 0;
            const isWin = showWin && winningCardId === card.id;
            const lockedOut = canBet && atCardLimit && mine <= 0;

            return (
              <button
                key={card.id}
                type="button"
                disabled={!canBet || lockedOut}
                onClick={() => onPick(card.id)}
                className={`flex flex-col items-center ${
                  lockedOut ? "opacity-40" : "disabled:opacity-95"
                } ${canBet && !lockedOut ? "active:scale-[0.96]" : ""}`}
              >
                <span className="font-play board-meta mb-0.5 text-base font-bold tabular-nums">
                  {card.id}
                </span>

                <div
                  className={`relative aspect-[3/4] w-full overflow-hidden rounded-[0.65rem] ${
                    isWin
                      ? "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]"
                      : mine > 0
                        ? "ring-2 ring-amber-500/80"
                        : "ring-1 ring-black/5"
                  }`}
                >
                  <img
                    src={card.image}
                    alt={card.nameVi}
                    className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-center"
                    draggable={false}
                  />
                  {mine > 0 && (
                    <span className="absolute right-0.5 top-0.5 z-[1] rounded bg-amber-400 px-1 text-[8px] font-bold text-[#1a1208]">
                      {formatXu(mine)}
                    </span>
                  )}
                </div>

                <div className="board-mult font-play mt-1 tabular-nums">
                  x{card.multiplier}
                </div>

                <p className="board-meta mt-0.5 text-[11px] font-semibold tabular-nums opacity-90">
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
