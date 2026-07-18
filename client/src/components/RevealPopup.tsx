import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CARD_BACK, CARDS, formatXu, type CardDef } from "../cards";

type RevealStage = "gather" | "shuffle" | "question" | "flip" | "done";

interface RevealPopupProps {
  open: boolean;
  winningCardId: number | null;
  yourStake?: number;
  onGatherSfx?: () => void;
  onShuffleSfx?: () => void;
  onSuspenseSfx?: () => void;
  onFlipSfx?: () => void;
  onWinSfx?: () => void;
  onLoseSfx?: () => void;
  onDone?: () => void;
}

export function RevealPopup({
  open,
  winningCardId,
  yourStake = 0,
  onGatherSfx,
  onShuffleSfx,
  onSuspenseSfx,
  onFlipSfx,
  onWinSfx,
  onLoseSfx,
  onDone,
}: RevealPopupProps) {
  const [stage, setStage] = useState<RevealStage>("gather");
  const onDoneRef = useRef(onDone);
  const onGatherRef = useRef(onGatherSfx);
  const onShuffleRef = useRef(onShuffleSfx);
  const onSuspenseRef = useRef(onSuspenseSfx);
  const onFlipRef = useRef(onFlipSfx);
  const onWinRef = useRef(onWinSfx);
  const onLoseRef = useRef(onLoseSfx);
  onDoneRef.current = onDone;
  onGatherRef.current = onGatherSfx;
  onShuffleRef.current = onShuffleSfx;
  onSuspenseRef.current = onSuspenseSfx;
  onFlipRef.current = onFlipSfx;
  onWinRef.current = onWinSfx;
  onLoseRef.current = onLoseSfx;

  const winner: CardDef | undefined = CARDS.find((c) => c.id === winningCardId);
  const payout =
    winner && yourStake > 0 ? yourStake * winner.multiplier : 0;

  useEffect(() => {
    if (!open || winningCardId == null) {
      setStage("gather");
      return;
    }

    setStage("gather");
    onGatherRef.current?.();

    const t1 = window.setTimeout(() => {
      setStage("shuffle");
      onShuffleRef.current?.();
    }, 700);
    const t2 = window.setTimeout(() => {
      setStage("question");
      onSuspenseRef.current?.();
    }, 2000);
    const t3 = window.setTimeout(() => {
      setStage("flip");
      onFlipRef.current?.();
    }, 2800);
    const tResult = window.setTimeout(() => {
      if (yourStake > 0) onWinRef.current?.();
      else onLoseRef.current?.();
    }, 3100);
    const t4 = window.setTimeout(() => setStage("done"), 4200);
    // Parent closes when phase leaves revealing; keep short safety
    const t5 = window.setTimeout(() => onDoneRef.current?.(), 4800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(tResult);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
    };
  }, [open, winningCardId, yourStake]);

  if (!open || winningCardId == null || !winner) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-black/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      />
      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-4">
        <p className="mb-4 font-display text-sm tracking-[0.25em] text-[var(--gold-soft)] uppercase">
          {stage === "flip" || stage === "done" ? "Kết quả" : "Đang rút bài…"}
        </p>

        <div className="relative h-56 w-52">
          <AnimatePresence mode="sync">
            {(stage === "gather" || stage === "shuffle") &&
              CARDS.map((card, i) => {
                const angle = (i / CARDS.length) * Math.PI * 2;
                const r = stage === "gather" ? 70 : 18 + (i % 3) * 6;
                return (
                  <motion.div
                    key={`face-${card.id}`}
                    className="absolute left-1/2 top-1/2 h-20 w-[3.75rem] -translate-x-1/2 -translate-y-1/2"
                    initial={{
                      x: Math.cos(angle) * 120,
                      y: Math.sin(angle) * 120,
                      rotate: i * 20,
                      opacity: 0.3,
                      scale: 0.7,
                    }}
                    animate={
                      stage === "gather"
                        ? {
                            x: Math.cos(angle) * r,
                            y: Math.sin(angle) * r,
                            rotate: i * 40,
                            opacity: 1,
                            scale: 1,
                          }
                        : {
                            x: Math.cos(angle + i) * r,
                            y: Math.sin(angle * 2 + i) * r,
                            rotate: [0, 180, 360, 520],
                            opacity: 1,
                            scale: [1, 0.9, 1.05, 0.85],
                          }
                    }
                    transition={
                      stage === "shuffle"
                        ? { duration: 1.2, ease: "easeInOut" }
                        : { duration: 0.55, delay: i * 0.03 }
                    }
                  >
                    <img
                      src={card.image}
                      alt={card.nameVi}
                      className="h-full w-full rounded-[0.45rem] object-cover object-center shadow-lg ring-1 ring-white/20"
                    />
                    <span className="font-play absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--gold)] px-1 text-[10px] font-bold text-[#1a1208] tabular-nums shadow ring-1 ring-black/20">
                      {card.id}
                    </span>
                  </motion.div>
                );
              })}

            {stage === "question" && (
              <motion.div
                key="q"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0.4, opacity: 0, rotateY: 0 }}
                animate={{ scale: 1, opacity: 1, rotateY: [0, 8, -8, 0] }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.7 }}
              >
                <img
                  src={CARD_BACK}
                  alt=""
                  className="h-36 w-[6.5rem] rounded-xl object-cover object-center shadow-[0_0_36px_rgba(212,168,75,0.45)] ring-2 ring-[var(--gold)]/50"
                />
              </motion.div>
            )}

            {(stage === "flip" || stage === "done") && (
              <motion.div
                key="win"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ rotateY: 90, scale: 0.4, opacity: 0 }}
                animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <img
                      src={winner.image}
                      alt={`#${winner.id} ${winner.nameVi}`}
                      className="h-40 w-[7.5rem] rounded-[0.7rem] object-cover object-center shadow-[0_0_48px_rgba(212,168,75,0.65)] ring-2 ring-[var(--gold)]"
                    />
                    <span className="font-play absolute -left-1.5 -top-1.5 flex h-8 min-w-8 items-center justify-center rounded-full bg-[var(--gold)] px-1.5 text-base font-bold text-[#1a1208] tabular-nums shadow-[0_0_12px_rgba(212,168,75,0.7)] ring-2 ring-[#1a1208]/30">
                      {winner.id}
                    </span>
                  </div>
                  <motion.span
                    className="font-display text-base font-bold text-[var(--gold-soft)]"
                    animate={{
                      scale: [1, 1.12, 1],
                      opacity: [1, 0.85, 1],
                    }}
                    transition={{ repeat: Infinity, duration: 0.7 }}
                  >
                    x{winner.multiplier}
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {(stage === "flip" || stage === "done") && (
          <motion.div
            className="mt-4 text-center"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            {yourStake > 0 ? (
              <p className="text-xs text-[var(--gold)]">
                Bạn +{formatXu(payout - yourStake)} xu
              </p>
            ) : (
              <p className="text-xs text-white/45">Bạn không đặt lá này</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
