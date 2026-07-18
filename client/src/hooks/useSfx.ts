import { useCallback, useRef, useState } from "react";

export type SfxName =
  | "tick"
  | "gather"
  | "shuffle"
  | "suspense"
  | "flip"
  | "win"
  | "lose";

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.12,
  delay = 0,
  freqEnd?: number,
) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Noise burst — tiếng giấy / lật bài. */
function playNoiseBurst(
  ctx: AudioContext,
  duration: number,
  gain = 0.1,
  delay = 0,
  filterFreq = 2200,
) {
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
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
        } else if (name === "gather") {
          for (let i = 0; i < 8; i++) {
            playNoiseBurst(ctx, 0.05, 0.05, i * 0.035, 1800 + i * 120);
            playTone(
              ctx,
              320 + i * 40,
              0.05,
              "triangle",
              0.04,
              i * 0.035,
            );
          }
        } else if (name === "shuffle") {
          for (let i = 0; i < 10; i++) {
            playNoiseBurst(
              ctx,
              0.045,
              0.07,
              i * 0.055,
              900 + Math.random() * 1800,
            );
            playTone(
              ctx,
              180 + Math.random() * 420,
              0.05,
              "triangle",
              0.05,
              i * 0.055,
            );
          }
        } else if (name === "suspense") {
          playTone(ctx, 220, 0.35, "sine", 0.08, 0, 440);
          playNoiseBurst(ctx, 0.12, 0.06, 0.05, 1400);
        } else if (name === "flip") {
          // Whoosh giấy + “bật” mặt bài
          playNoiseBurst(ctx, 0.14, 0.14, 0, 1600);
          playTone(ctx, 180, 0.16, "triangle", 0.1, 0, 720);
          playTone(ctx, 90, 0.1, "sine", 0.08, 0.02, 280);
          playNoiseBurst(ctx, 0.08, 0.1, 0.1, 3200);
          playTone(ctx, 660, 0.1, "sine", 0.09, 0.12);
        } else if (name === "win") {
          playTone(ctx, 523, 0.12, "sine", 0.14, 0);
          playTone(ctx, 659, 0.14, "sine", 0.12, 0.1);
          playTone(ctx, 784, 0.22, "sine", 0.12, 0.2);
          playTone(ctx, 1046, 0.28, "sine", 0.08, 0.32);
        } else if (name === "lose") {
          playTone(ctx, 320, 0.18, "triangle", 0.1, 0, 160);
          playNoiseBurst(ctx, 0.1, 0.05, 0.05, 800);
        }
      } catch {
        /* autoplay / audio blocked */
      }
    },
    [muted],
  );

  return { play, muted, toggleMute };
}
