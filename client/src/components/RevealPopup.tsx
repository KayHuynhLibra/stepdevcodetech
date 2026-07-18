import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CARDS, formatXu, type CardDef } from "../cards";

type RevealStage = "gather" | "shuffle" | "question" | "flip" | "done";

interface RevealPopupProps {
  open: boolean;
  winningCardId: number | null;
  yourStake?: number;
  onShuffleSfx?: () => void;
  onWinSfx?: () => void;
  onDone?: () => void;
}

export function RevealPopup({
  open,
  winningCardId,
  yourStake = 0,
  onShuffleSfx,
  onWinSfx,
  onDone,
}: RevealPopupProps) {
  const [stage, setStage] = useState<RevealStage>("gather");
  const onDoneRef = useRef(onDone);
  const onShuffleRef = useRef(onShuffleSfx);
  const onWinRef = useRef(onWinSfx);
  onDoneRef.current = onDone;
  onShuffleRef.current = onShuffleSfx;
  onWinRef.current = onWinSfx;

  const winner: CardDef | undefined = CARDS.find((c) => c.id === winningCardId);
  const payout =
    winner && yourStake > 0 ? yourStake * winner.multiplier : 0;

  useEffect(() => {
    if (!open || winningCardId == null) {
      setStage("gather");
      return;
    }

    setStage("gather");
    const t1 = window.setTimeout(() => {
      setStage("shuffle");
      onShuffleRef.current?.();
    }, 700);
    const t2 = window.setTimeout(() => setStage("question"), 2000);
    const t3 = window.setTimeout(() => {
      setStage("flip");
      onWinRef.current?.();
    }, 2800);
    const t4 = window.setTimeout(() => setStage("done"), 4200);
    // Parent closes when phase leaves revealing; keep short safety
    const t5 = window.setTimeout(() => onDoneRef.current?.(), 4800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
    };
  }, [open, winningCardId]);

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
                  <motion.img
                    key={`face-${card.id}`}
                    src={card.image}
                    alt=""
                    className="absolute left-1/2 top-1/2 h-20 w-[3.75rem] -translate-x-1/2 -translate-y-1/2 rounded-[0.45rem] object-cover object-center shadow-lg"
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
                  />
                );
              })}

            {stage === "question" && (
              <motion.div
                key="q"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <div className="flex h-36 w-[6.5rem] items-center justify-center rounded-xl bg-[#1a2234] text-5xl font-bold text-[var(--gold-soft)] ring-2 ring-[var(--gold)]/50">
                  ?
                </div>
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
                  <img
                    src={winner.image}
                    alt=""
                    className="h-40 w-[7.5rem] rounded-[0.7rem] object-cover object-center shadow-[0_0_48px_rgba(212,168,75,0.65)] ring-2 ring-[var(--gold)]"
                  />
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
