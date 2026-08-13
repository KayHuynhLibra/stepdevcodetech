import { useEffect, useRef, useState } from "react";
import type { SowStep } from "./types";

type FlyStone = {
  id: string;
  x: number;
  y: number;
  kind: "place" | "capture";
  phase: "start" | "move" | "done";
  isQuan?: boolean;
};

const STEP_MS = 95;
const TRAVEL_MS = 180;

function pitCenter(
  board: HTMLElement,
  pitIndex: number,
): { x: number; y: number } | null {
  const el = board.querySelector(`[data-oan-pit="${pitIndex}"]`);
  if (!el) return null;
  const br = board.getBoundingClientRect();
  const pr = el.getBoundingClientRect();
  return {
    x: pr.left + pr.width / 2 - br.left,
    y: pr.top + pr.height / 2 - br.top,
  };
}

export function OanSowFx({
  moveSeq,
  lastSteps,
}: {
  moveSeq?: number;
  lastSteps?: SowStep[];
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [flies, setFlies] = useState<FlyStone[]>([]);
  const sigRef = useRef("");

  useEffect(() => {
    const board = boardRef.current?.parentElement;
    if (!board || !lastSteps?.length || !moveSeq) return;
    const sig = `${moveSeq}:${lastSteps.map((s) => `${s.kind}${s.from}-${s.to}`).join("|")}`;
    if (sig === sigRef.current) return;
    sigRef.current = sig;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setFlies([]);
      return;
    }

    const placeSteps = lastSteps.filter((s) => s.kind === "place");
    const captureSteps = lastSteps.filter((s) => s.kind === "capture");
    const all: {
      from: number;
      to: number;
      kind: "place" | "capture";
      delay: number;
      isQuan?: boolean;
    }[] = [];

    placeSteps.forEach((s, i) => {
      all.push({ from: s.from, to: s.to, kind: "place", delay: i * STEP_MS });
    });
    captureSteps.forEach((s, i) => {
      all.push({
        from: s.to,
        to: s.to,
        kind: "capture",
        delay: placeSteps.length * STEP_MS + i * (STEP_MS + 20),
        isQuan: s.quan > 0,
      });
    });

    const timers: ReturnType<typeof setTimeout>[] = [];
    const active: FlyStone[] = [];

    for (const step of all) {
      const t0 = setTimeout(() => {
        const from = pitCenter(board, step.from);
        const to = pitCenter(board, step.to);
        if (!from || !to) return;
        const id = `${moveSeq}-${step.kind}-${step.from}-${step.to}-${step.delay}`;
        const fly: FlyStone = {
          id,
          x: from.x,
          y: from.y,
          kind: step.kind,
          phase: "start",
          isQuan: step.isQuan,
        };
        active.push(fly);
        setFlies([...active]);

        requestAnimationFrame(() => {
          setFlies((prev) =>
            prev.map((f) => {
              if (f.id !== id) return f;
              if (step.kind === "capture") {
                return { ...f, y: f.y - 18, phase: "move" };
              }
              return { ...f, x: to.x, y: to.y, phase: "move" };
            }),
          );
        });

        const t1 = setTimeout(() => {
          setFlies((prev) => prev.filter((f) => f.id !== id));
          const idx = active.findIndex((f) => f.id === id);
          if (idx >= 0) active.splice(idx, 1);
        }, TRAVEL_MS + 30);
        timers.push(t1);
      }, step.delay);
      timers.push(t0);
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [moveSeq, lastSteps]);

  return (
    <div ref={boardRef} className="oan-sow-fx" aria-hidden>
      {flies.map((f) => (
        <span
          key={f.id}
          className={`oan-fly-stone oan-fly-stone--${f.kind} oan-fly-stone--${f.phase} ${f.isQuan ? "oan-fly-stone--quan" : ""}`}
          style={{
            left: f.x,
            top: f.y,
            transitionDuration: `${TRAVEL_MS}ms`,
          }}
        />
      ))}
    </div>
  );
}
