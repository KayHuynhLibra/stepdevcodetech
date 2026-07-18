import { useCallback, useRef, useState } from "react";

type SfxName = "tick" | "shuffle" | "win";

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.12,
  delay = 0,
) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function useSfx() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("tarot_sfx_muted") === "1";
    } catch {
      return false;
    }
  });

  const ensureCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("tarot_sfx_muted", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const play = useCallback(
    (name: SfxName) => {
      if (muted) return;
      try {
        const ctx = ensureCtx();
        if (name === "tick") {
          playTone(ctx, 880, 0.08, "square", 0.08);
        } else if (name === "shuffle") {
          for (let i = 0; i < 6; i++) {
            playTone(
              ctx,
              200 + Math.random() * 400,
              0.06,
              "triangle",
              0.07,
              i * 0.05,
            );
          }
        } else if (name === "win") {
          playTone(ctx, 523, 0.12, "sine", 0.14, 0);
          playTone(ctx, 659, 0.14, "sine", 0.12, 0.1);
          playTone(ctx, 784, 0.22, "sine", 0.12, 0.2);
        }
      } catch {
        /* autoplay / audio blocked */
      }
    },
    [muted],
  );

  return { play, muted, toggleMute };
}
