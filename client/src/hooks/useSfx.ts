import { useCallback, useRef } from "react";
import {
  channelGain,
  usePlayPrefs,
  type AudioChannel,
} from "./usePlayPrefs";

export type SfxName =
  | "tick"
  | "gather"
  | "shuffle"
  | "suspense"
  | "flip"
  | "win"
  | "lose"
  | "spin"
  | "land"
  | "thunder"
  | "oly_win"
  | "ui";

type SfxChannel = Exclude<AudioChannel, "master">;

const SFX_CHANNEL: Record<SfxName, SfxChannel> = {
  tick: "tarot",
  gather: "tarot",
  shuffle: "tarot",
  suspense: "tarot",
  flip: "tarot",
  win: "tarot",
  lose: "tarot",
  spin: "olympus",
  land: "olympus",
  thunder: "olympus",
  oly_win: "olympus",
  ui: "ui",
};

function playTone(
  ctx: AudioContext,
  dest: AudioNode,
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
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freqEnd),
      t0 + duration,
    );
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playNoiseBurst(
  ctx: AudioContext,
  dest: AudioNode,
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
  g.connect(dest);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

export function useSfx(defaultChannel: SfxChannel = "tarot") {
  const ctxRef = useRef<AudioContext | null>(null);
  const { prefs, toggleChannelMute, toggleMasterMute, anyMuted } =
    usePlayPrefs();

  const ensureCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  const muted =
    prefs.masterMuted ||
    prefs.muted[defaultChannel] ||
    prefs.volumes.master <= 0 ||
    prefs.volumes[defaultChannel] <= 0;

  const toggleMute = useCallback(() => {
    if (prefs.masterMuted) {
      toggleMasterMute();
      return;
    }
    toggleChannelMute(defaultChannel);
  }, [
    defaultChannel,
    prefs.masterMuted,
    toggleChannelMute,
    toggleMasterMute,
  ]);

  const play = useCallback(
    (name: SfxName) => {
      const ch = SFX_CHANNEL[name] ?? defaultChannel;
      const gainMul = channelGain(prefs, ch);
      if (gainMul <= 0.001) return;
      try {
        const ctx = ensureCtx();
        const dest = ctx.createGain();
        dest.gain.value = gainMul;
        dest.connect(ctx.destination);

        if (name === "tick" || name === "ui") {
          playTone(ctx, dest, 880, 0.08, "square", 0.08);
        } else if (name === "gather") {
          for (let i = 0; i < 8; i++) {
            playNoiseBurst(ctx, dest, 0.05, 0.05, i * 0.035, 1800 + i * 120);
            playTone(
              ctx,
              dest,
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
              dest,
              0.045,
              0.07,
              i * 0.055,
              900 + Math.random() * 1800,
            );
            playTone(
              ctx,
              dest,
              180 + Math.random() * 420,
              0.05,
              "triangle",
              0.05,
              i * 0.055,
            );
          }
        } else if (name === "suspense") {
          playTone(ctx, dest, 220, 0.35, "sine", 0.08, 0, 440);
          playNoiseBurst(ctx, dest, 0.12, 0.06, 0.05, 1400);
        } else if (name === "flip") {
          playNoiseBurst(ctx, dest, 0.14, 0.14, 0, 1600);
          playTone(ctx, dest, 180, 0.16, "triangle", 0.1, 0, 720);
          playTone(ctx, dest, 90, 0.1, "sine", 0.08, 0.02, 280);
          playNoiseBurst(ctx, dest, 0.08, 0.1, 0.1, 3200);
          playTone(ctx, dest, 660, 0.1, "sine", 0.09, 0.12);
        } else if (name === "win" || name === "oly_win") {
          playTone(ctx, dest, 523, 0.12, "sine", 0.14, 0);
          playTone(ctx, dest, 659, 0.14, "sine", 0.12, 0.1);
          playTone(ctx, dest, 784, 0.22, "sine", 0.12, 0.2);
          playTone(ctx, dest, 1046, 0.28, "sine", 0.08, 0.32);
        } else if (name === "lose") {
          playTone(ctx, dest, 320, 0.18, "triangle", 0.1, 0, 160);
          playNoiseBurst(ctx, dest, 0.1, 0.05, 0.05, 800);
        } else if (name === "spin") {
          for (let i = 0; i < 6; i++) {
            playTone(
              ctx,
              dest,
              140 + i * 28,
              0.06,
              "sawtooth",
              0.04,
              i * 0.04,
              90 + i * 10,
            );
          }
          playNoiseBurst(ctx, dest, 0.18, 0.06, 0, 900);
        } else if (name === "land") {
          playTone(ctx, dest, 220, 0.08, "triangle", 0.1);
          playNoiseBurst(ctx, dest, 0.06, 0.08, 0.02, 1400);
        } else if (name === "thunder") {
          playNoiseBurst(ctx, dest, 0.35, 0.22, 0, 280);
          playNoiseBurst(ctx, dest, 0.25, 0.16, 0.08, 600);
          playTone(ctx, dest, 80, 0.4, "sawtooth", 0.12, 0, 40);
          playTone(ctx, dest, 1200, 0.08, "square", 0.06, 0.05, 200);
        }
      } catch {
        /* autoplay / audio blocked */
      }
    },
    [prefs, defaultChannel],
  );

  return { play, muted, toggleMute, anyMuted, prefs };
}
