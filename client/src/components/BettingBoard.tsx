import { CARDS, formatXu, type Phase } from "../cards";

const MAX_CARDS_PER_ROUND = 5;

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

  return (
    <section className="game-task game-task-board relative mt-4 px-2.5 pb-4 pt-7">

      {/* Countdown ribbon */}
      <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
        <div
          className={`font-play px-6 py-1 text-center text-sm font-bold tracking-wide text-white shadow-md tabular-nums transition-colors ${
            canBet && remaining > 0 && remaining <= 5
              ? "bg-rose-600 animate-pulse"
              : "bg-[#0f3d6e]"
          }`}
          style={{
            clipPath:
              "polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)",
            minWidth: "9.5rem",
          }}
        >
          Đếm ngược {canBet || phase === "betting" ? remaining : 0}
        </div>
      </div>

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
              <span className="font-play mb-0.5 text-base font-bold text-[#0f3d6e] tabular-nums">
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

              {/* Trapezoid multiplier badge */}
              <div
                className="font-play mt-1 min-w-[2.4rem] bg-[#2b6cb0] px-2 py-0.5 text-center text-[11px] font-bold text-white shadow-sm tabular-nums"
                style={{
                  clipPath:
                    "polygon(6% 0, 100% 0, 94% 100%, 0 100%)",
                }}
              >
                x{card.multiplier}
              </div>

              <p className="mt-0.5 text-[11px] font-semibold text-[#0f3d6e] tabular-nums">
                {people} người
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
