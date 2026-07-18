import { motion, AnimatePresence } from "framer-motion";
import { CARDS, formatXu, type RoundTopWinner } from "../cards";

interface ResultSummaryPopupProps {
  open: boolean;
  winningCardId: number | null;
  didWin: boolean;
  profit: number;
  payout: number;
  topWinners: RoundTopWinner[];
}

const PODIUM_ORDER = [2, 1, 3] as const;

const RANK_STYLE: Record<
  1 | 2 | 3,
  {
    crown: string;
    ring: string;
    glow: string;
    size: string;
    podium: string;
    name: string;
    xu: string;
  }
> = {
  1: {
    crown: "👑",
    ring: "from-[#ffe9a8] via-[#f0c14b] to-[#b8860b]",
    glow: "shadow-[0_0_22px_rgba(240,193,75,0.55)]",
    size: "h-16 w-16",
    podium:
      "bg-gradient-to-b from-[#f6e27a] via-[#d4a84b] to-[#8a6418] ring-1 ring-[#ffe9a8]/50",
    name: "text-[#ffe7a0]",
    xu: "text-[#ffd76a]",
  },
  2: {
    crown: "🥈",
    ring: "from-[#f4f7fb] via-[#c9d2de] to-[#7f8b9a]",
    glow: "shadow-[0_0_16px_rgba(200,210,225,0.4)]",
    size: "h-[3.25rem] w-[3.25rem]",
    podium:
      "bg-gradient-to-b from-[#e8eef5] via-[#a8b4c4] to-[#5c6775] ring-1 ring-white/40",
    name: "text-[#e8eef8]",
    xu: "text-[#d7e0ec]",
  },
  3: {
    crown: "🥉",
    ring: "from-[#ffd0a8] via-[#cd7f32] to-[#7a3e12]",
    glow: "shadow-[0_0_16px_rgba(205,127,50,0.45)]",
    size: "h-12 w-12",
    podium:
      "bg-gradient-to-b from-[#e8a36a] via-[#b86a2e] to-[#6b3410] ring-1 ring-[#ffc089]/40",
    name: "text-[#ffc89a]",
    xu: "text-[#ffb070]",
  },
};

function PodiumSlot({
  entry,
  rank,
}: {
  entry: RoundTopWinner | undefined;
  rank: 1 | 2 | 3;
}) {
  const style = RANK_STYLE[rank];
  const isFirst = rank === 1;

  return (
    <motion.div
      className={`flex flex-1 flex-col items-center ${isFirst ? "-mt-3" : "mt-4"}`}
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.08 * rank, type: "spring", stiffness: 280, damping: 22 }}
    >
      {entry ? (
        <>
          <span
            className={`${isFirst ? "text-2xl" : "text-lg"} leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]`}
          >
            {style.crown}
          </span>
          <div
            className={`mt-1 rounded-full bg-gradient-to-br p-[2.5px] ${style.ring} ${style.glow}`}
          >
            <img
              src={entry.avatar || "/assets/ui/avatar-default.png"}
              alt=""
              className={`${style.size} rounded-full object-cover ring-2 ring-[#1a1520]`}
            />
          </div>
          <p
            className={`font-play mt-1.5 max-w-[5.5rem] truncate text-center text-[11px] font-bold ${style.name}`}
          >
            {entry.name}
            {entry.isYou ? " (Bạn)" : ""}
          </p>
          <div className="mt-0.5 flex items-center gap-0.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#ffd36a] to-[#e8891a] ring-1 ring-[#fff2c2]/50"
              aria-hidden
            />
            <span
              className={`font-play text-[11px] font-bold tabular-nums ${style.xu}`}
            >
              +{formatXu(entry.profit)}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center opacity-30">
          <span className="text-lg">{style.crown}</span>
          <div className={`${style.size} mt-1 rounded-full bg-white/10`} />
          <p className="mt-1.5 text-[10px] text-white/35">—</p>
        </div>
      )}
      <div
        className={`mt-2 w-full max-w-[4.5rem] rounded-t-lg ${style.podium}`}
        style={{
          height: rank === 1 ? "4rem" : rank === 2 ? "3rem" : "2.5rem",
        }}
      />
    </motion.div>
  );
}

export function ResultSummaryPopup({
  open,
  winningCardId,
  didWin,
  profit,
  payout,
  topWinners,
}: ResultSummaryPopupProps) {
  const winner = CARDS.find((c) => c.id === winningCardId);
  const byRank = (rank: number) =>
    topWinners.find((w) => w.rank === rank) ?? topWinners[rank - 1];

  return (
    <AnimatePresence>
      {open && winner && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-[#0a1628]/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_48px_rgba(0,0,0,0.45)] ring-1 ring-[#f0c14b]/35"
            style={{
              maxHeight: "72vh",
              background:
                "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(240,193,75,0.28), transparent 55%), linear-gradient(180deg, #2a3348 0%, #1a2234 42%, #121826 100%)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-transparent via-[#f0d78c] to-transparent" />

            {/* Lá thắng */}
            <div className="relative flex flex-col items-center">
              <div
                className="pointer-events-none absolute top-8 h-24 w-24 rounded-full bg-[#f0c14b]/20 blur-2xl"
                aria-hidden
              />
              <p className="font-play relative text-[10px] font-semibold uppercase tracking-[0.22em] text-[#f0d78c]/90">
                Lá thắng
              </p>
              <motion.img
                src={winner.image}
                alt=""
                className="relative mt-1.5 h-28 w-[5.25rem] rounded-[0.65rem] object-cover object-center shadow-[0_8px_32px_rgba(240,193,75,0.35)] ring-2 ring-[#f0c14b]/80"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              />
              <p className="font-play relative mt-1.5 rounded-full bg-[#f0c14b]/15 px-2.5 py-0.5 text-sm font-bold text-[#ffe7a0] ring-1 ring-[#f0c14b]/35">
                x{winner.multiplier}
              </p>
            </div>

            {/* Kết quả cá nhân */}
            <div className="mt-2.5 text-center">
              {didWin ? (
                <>
                  <p className="font-play text-base font-bold text-[#ffe7a0]">
                    Chúc mừng!
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[#ffd76a]">
                    +{formatXu(profit)} xu{" "}
                    <span className="font-normal text-[#c8b89a]/70">
                      (nhận {formatXu(payout)})
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-play text-base font-bold text-[#e8e4dc]">
                    Rất tiếc!
                  </p>
                  <p className="mt-0.5 text-xs text-[#a8b0c0]">
                    Bạn không trúng lá này
                  </p>
                </>
              )}
            </div>

            {/* Podium Top 3 */}
            <div
              className="mt-3 rounded-2xl px-2 pb-1 pt-3 ring-1 ring-[#f0c14b]/20"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(15,20,32,0.55) 100%)",
              }}
            >
              <p className="font-play mb-1 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f0d78c]/75">
                Bục vinh danh
              </p>
              <div className="flex items-end justify-center gap-1 px-1">
                {PODIUM_ORDER.map((rank) => (
                  <PodiumSlot key={rank} rank={rank} entry={byRank(rank)} />
                ))}
              </div>
              {topWinners.length === 0 && (
                <p className="pb-3 text-center text-xs text-[#a8b0c0]/80">
                  Chưa có ai trúng ván này
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
