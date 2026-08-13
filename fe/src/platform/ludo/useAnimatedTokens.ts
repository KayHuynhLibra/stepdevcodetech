import { useEffect, useRef, useState } from "react";
import {
  buildMovePath,
  shouldAnimatePath,
  TOKEN_STEP_MS,
} from "./tokenMovePath";

export type LudoTokenView = {
  id: string;
  color: string;
  index: number;
  pos: number;
};

export type AnimatedToken = LudoTokenView & {
  hopTick: number;
  moving: boolean;
};

/**
 * Cell-by-cell hop playback when server snaps token positions.
 * Multiple tokens animate in parallel (mover + capture).
 */
export function useAnimatedTokens(
  tokens: LudoTokenView[],
  reduceFx?: boolean,
): AnimatedToken[] {
  const [display, setDisplay] = useState<AnimatedToken[]>(() =>
    tokens.map((t) => ({ ...t, hopTick: 0, moving: false })),
  );

  const visualPos = useRef<Record<string, number>>({});
  const serverPos = useRef<Record<string, number>>({});
  const genRef = useRef<Record<string, number>>({});
  const hopTickRef = useRef<Record<string, number>>({});
  const timers = useRef<number[]>([]);
  const reduceRef = useRef(!!reduceFx);
  reduceRef.current = !!reduceFx;

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  const bumpHop = (id: string) => {
    hopTickRef.current[id] = (hopTickRef.current[id] || 0) + 1;
    return hopTickRef.current[id]!;
  };

  const paint = (
    id: string,
    color: string,
    index: number,
    pos: number,
    moving: boolean,
    hop: boolean,
  ) => {
    visualPos.current[id] = pos;
    const hopTick = hop ? bumpHop(id) : hopTickRef.current[id] || 0;
    setDisplay((prev) => {
      const rest = prev.filter((t) => t.id !== id);
      return [...rest, { id, color, index, pos, hopTick, moving }];
    });
  };

  const playPath = (
    id: string,
    color: string,
    index: number,
    steps: number[],
  ) => {
    const gen = (genRef.current[id] = (genRef.current[id] || 0) + 1);
    const from = visualPos.current[id];
    const startAt =
      from !== undefined && from === steps[0] && steps.length > 1 ? 1 : 0;

    const runStep = (i: number) => {
      if (genRef.current[id] !== gen || reduceRef.current) return;
      const pos = steps[i];
      if (pos === undefined) {
        paint(id, color, index, visualPos.current[id] ?? 0, false, false);
        return;
      }
      const last = i >= steps.length - 1;
      paint(id, color, index, pos, !last, true);
      if (last) return;
      const tid = window.setTimeout(
        () => runStep(i + 1),
        i === startAt ? Math.min(50, TOKEN_STEP_MS) : TOKEN_STEP_MS,
      );
      timers.current.push(tid);
    };

    runStep(startAt);
  };

  useEffect(() => {
    if (reduceFx) {
      clearTimers();
      for (const id of Object.keys(genRef.current)) {
        genRef.current[id] = (genRef.current[id] || 0) + 1;
      }
      for (const t of tokens) {
        visualPos.current[t.id] = t.pos;
        serverPos.current[t.id] = t.pos;
      }
      setDisplay(
        tokens.map((t) => ({
          ...t,
          hopTick: hopTickRef.current[t.id] || 0,
          moving: false,
        })),
      );
      return;
    }

    const liveIds = new Set(tokens.map((t) => t.id));
    for (const id of Object.keys(visualPos.current)) {
      if (!liveIds.has(id)) {
        delete visualPos.current[id];
        delete serverPos.current[id];
        genRef.current[id] = (genRef.current[id] || 0) + 1;
      }
    }

    for (const t of tokens) {
      if (serverPos.current[t.id] === undefined) {
        serverPos.current[t.id] = t.pos;
        visualPos.current[t.id] = t.pos;
        paint(t.id, t.color, t.index, t.pos, false, false);
        continue;
      }
      if (serverPos.current[t.id] === t.pos) continue;

      const from = visualPos.current[t.id] ?? serverPos.current[t.id]!;
      serverPos.current[t.id] = t.pos;
      const path = buildMovePath(t.color, from, t.pos);
      if (!shouldAnimatePath(path)) {
        genRef.current[t.id] = (genRef.current[t.id] || 0) + 1;
        paint(t.id, t.color, t.index, t.pos, false, true);
        continue;
      }
      playPath(t.id, t.color, t.index, path);
    }

    setDisplay((prev) => {
      const byId = new Map(tokens.map((t) => [t.id, t]));
      return prev
        .filter((x) => byId.has(x.id))
        .map((x) => {
          const live = byId.get(x.id)!;
          return { ...x, color: live.color, index: live.index };
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, reduceFx]);

  useEffect(() => () => clearTimers(), []);

  const byDisp = new Map(display.map((t) => [t.id, t]));
  return tokens.map((t) => {
    const d = byDisp.get(t.id);
    if (d) return d;
    return { ...t, hopTick: 0, moving: false };
  });
}
