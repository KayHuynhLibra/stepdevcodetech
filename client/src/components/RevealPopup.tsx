import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CARD_BACK, CARDS, formatXu, type CardDef } from "../cards";
import {
  normalizeRevealStyle,
  type RevealStyleId,
} from "../tableConfig";

type RevealStage = "gather" | "shuffle" | "question" | "flip" | "done";

interface RevealPopupProps {
  open: boolean;
  winningCardId: number | null;
  yourStake?: number;
  /** classic | fan | spiral — từ admin Tổng quan */
  revealStyle?: RevealStyleId | string;
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
  revealStyle: revealStyleRaw,
  onGatherSfx,
  onShuffleSfx,
  onSuspenseSfx,
  onFlipSfx,
  onWinSfx,
  onLoseSfx,
  onDone,
}: RevealPopupProps) {
  const style = normalizeRevealStyle(revealStyleRaw);
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

  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };

  const dismiss = () => {
    clearTimers();
    setStage("done");
    onDoneRef.current?.();
  };

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
    const t5 = window.setTimeout(() => onDoneRef.current?.(), 4800);

    timersRef.current = [t1, t2, t3, tResult, t4, t5];

    return () => {
      clearTimers();
    };
  }, [open, winningCardId, yourStake, style]);

  if (!open || winningCardId == null || !winner) return null;

  const stageLabel =
    stage === "flip" || stage === "done" ? "Kết quả" : "Đang rút bài…";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <button
        type="button"
        className="reveal-popup-backdrop absolute inset-0 z-0 bg-black/80"
        aria-label="Đóng"
        onClick={dismiss}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-4 pointer-events-none">
        <p className="mb-1 font-display text-sm tracking-[0.25em] text-[var(--gold-soft)] uppercase">
          {stageLabel}
        </p>
        <p className="reveal-popup-hint mb-3 text-[10px] font-semibold text-white/40">
          Chạm nền để đóng
        </p>

        <div className="relative h-56 w-52">
          <AnimatePresence mode="sync">
            {(stage === "gather" || stage === "shuffle") &&
              CARDS.map((card, i) => (
                <DeckCard
                  key={`${style}-face-${card.id}`}
                  cardId={card.id}
                  index={i}
                  stage={stage}
                  style={style}
                />
              ))}

            {stage === "question" && (
              <motion.div
                key={`${style}-q`}
                className="absolute inset-0 flex items-center justify-center"
                initial={
                  style === "spiral"
                    ? { scale: 0.2, opacity: 0, rotate: -540 }
                    : style === "fan"
                      ? { y: 40, scale: 0.6, opacity: 0, rotate: -18 }
                      : { scale: 0.4, opacity: 0, rotateY: 0 }
                }
                animate={
                  style === "spiral"
                    ? { scale: 1, opacity: 1, rotate: 0 }
                    : style === "fan"
                      ? { y: 0, scale: 1, opacity: 1, rotate: 0 }
                      : { scale: 1, opacity: 1, rotateY: [0, 8, -8, 0] }
                }
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: style === "spiral" ? 0.85 : 0.7 }}
              >
                <img
                  src={CARD_BACK}
                  alt=""
                  decoding="async"
                  className="h-36 w-[6.5rem] rounded-xl object-cover object-center shadow-[0_0_36px_rgba(212,168,75,0.45)] ring-2 ring-[var(--gold)]/50"
                />
              </motion.div>
            )}

            {(stage === "flip" || stage === "done") && (
              <motion.div
                key={`${style}-win`}
                className="absolute inset-0 flex items-center justify-center"
                initial={
                  style === "spiral"
                    ? { rotate: 180, scale: 0.2, opacity: 0 }
                    : style === "fan"
                      ? { rotateY: -90, y: -24, scale: 0.5, opacity: 0 }
                      : { rotateY: 90, scale: 0.4, opacity: 0 }
                }
                animate={
                  style === "spiral"
                    ? { rotate: 0, scale: 1, opacity: 1 }
                    : { rotateY: 0, y: 0, scale: 1, opacity: 1 }
                }
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <img
                      src={winner.image}
                      alt={`#${winner.id} ${winner.nameVi}`}
                      decoding="async"
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

function DeckCard({
  cardId,
  index: i,
  stage,
  style,
}: {
  cardId: number;
  index: number;
  stage: "gather" | "shuffle";
  style: RevealStyleId;
}) {
  const n = CARDS.length;

  /** Góc quỹ đạo (rad) → độ xoay CSS để đỉnh lá hướng về tâm */
  const faceCenterDeg = (rad: number) => (rad * 180) / Math.PI - 90;

  const classicAngle = (i / n) * Math.PI * 2;
  const classicR = stage === "gather" ? 70 : 22;

  // Quạt: cung ngang — đỉnh lá hướng về điểm tụ phía dưới
  const fanT = n <= 1 ? 0 : i / (n - 1);
  const fanRot = -55 + fanT * 110;
  const fanRad = (fanRot * Math.PI) / 180;
  const fanR = stage === "gather" ? 78 : 52;
  const fanX = Math.sin(fanRad) * fanR;
  const fanY = 28 - Math.cos(fanRad) * (fanR * 0.35);

  // Spiral / classic: vòng tròn — rotate luôn = góc quỹ đạo (đồng điệu về tâm)
  const spiralTurns = 1.25;
  const spiralBase = (i / n) * Math.PI * 2;
  const spiralAngle = spiralBase * spiralTurns;
  const spiralR = stage === "gather" ? 14 + (i / Math.max(1, n - 1)) * 72 : 28;

  let initial: Record<string, number>;
  let animate: Record<string, number | number[]>;
  let transition: {
    duration: number;
    ease?: "easeInOut" | "easeOut" | "easeIn" | "linear";
    delay?: number;
  };

  if (style === "fan") {
    initial = {
      x: (i - n / 2) * 28,
      y: 110,
      rotate: fanRot * 0.3,
      opacity: 0.2,
      scale: 0.65,
    };
    animate =
      stage === "gather"
        ? {
            x: fanX,
            y: fanY,
            rotate: fanRot,
            opacity: 1,
            scale: 1,
          }
        : {
            // Xáo nhẹ nhưng giữ hướng quạt (về điểm tụ)
            x: [fanX, fanX * 0.92, fanX * 1.04, fanX],
            y: [fanY, fanY - 6, fanY + 2, fanY],
            rotate: [fanRot, fanRot - 3, fanRot + 3, fanRot],
            opacity: 1,
            scale: [1, 1.03, 0.97, 1],
          };
    transition =
      stage === "shuffle"
        ? { duration: 1.15, ease: "easeInOut" }
        : { duration: 0.6, delay: i * 0.028 };
  } else if (style === "spiral") {
    const spin = [0, Math.PI * 0.55, Math.PI * 1.1, Math.PI * 1.65];
    const orbitAngles = spin.map((d) => spiralAngle + d);
    initial = {
      x: Math.cos(spiralAngle) * 130,
      y: Math.sin(spiralAngle) * 130,
      rotate: faceCenterDeg(spiralAngle),
      opacity: 0.15,
      scale: 0.5,
    };
    animate =
      stage === "gather"
        ? {
            x: Math.cos(spiralAngle) * spiralR,
            y: Math.sin(spiralAngle) * spiralR,
            rotate: faceCenterDeg(spiralAngle),
            opacity: 1,
            scale: 1,
          }
        : {
            x: orbitAngles.map((a) => Math.cos(a) * spiralR),
            y: orbitAngles.map((a) => Math.sin(a) * spiralR),
            rotate: orbitAngles.map((a) => faceCenterDeg(a)),
            opacity: 1,
            scale: [1, 0.94, 1.02, 0.96],
          };
    transition =
      stage === "shuffle"
        ? { duration: 1.25, ease: "linear" }
        : { duration: 0.65, delay: i * 0.025 };
  } else {
    // classic: vòng tròn đều, đỉnh lá luôn hướng tâm
    const spin = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    const orbitAngles = spin.map((d) => classicAngle + d);
    initial = {
      x: Math.cos(classicAngle) * 120,
      y: Math.sin(classicAngle) * 120,
      rotate: faceCenterDeg(classicAngle),
      opacity: 0.3,
      scale: 0.7,
    };
    animate =
      stage === "gather"
        ? {
            x: Math.cos(classicAngle) * classicR,
            y: Math.sin(classicAngle) * classicR,
            rotate: faceCenterDeg(classicAngle),
            opacity: 1,
            scale: 1,
          }
        : {
            x: orbitAngles.map((a) => Math.cos(a) * classicR),
            y: orbitAngles.map((a) => Math.sin(a) * classicR),
            rotate: orbitAngles.map((a) => faceCenterDeg(a)),
            opacity: 1,
            scale: [1, 0.95, 1.02, 0.92],
          };
    transition =
      stage === "shuffle"
        ? { duration: 1.2, ease: "linear" }
        : { duration: 0.55, delay: i * 0.03 };
  }

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 h-20 w-[3.75rem] -translate-x-1/2 -translate-y-1/2"
      initial={initial}
      animate={animate}
      transition={transition}
      style={{ transformOrigin: "center center" }}
    >
      <img
        src={CARD_BACK}
        alt=""
        decoding="async"
        className="h-full w-full rounded-[0.45rem] object-cover object-center shadow-lg ring-1 ring-white/20"
      />
      <span className="font-play absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--gold)] px-1 text-[10px] font-bold text-[#1a1208] tabular-nums shadow ring-1 ring-black/20">
        {cardId}
      </span>
    </motion.div>
  );
}
