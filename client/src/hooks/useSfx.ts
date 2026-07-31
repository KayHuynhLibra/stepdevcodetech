import { useCallback, useEffect, useRef } from "react";
import {
  channelGain,
  usePlayPrefs,
  type AudioChannel,
} from "./usePlayPrefs";
import { api } from "../auth";
import type { SfxStyleId } from "../sfxCatalog";
import { isSfxStyleId } from "../sfxCatalog";

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

type SfxRuntime = {
  styles: Partial<Record<string, SfxStyleId>>;
  paths: Partial<Record<string, string>>;
};

let runtime: SfxRuntime = { styles: {}, paths: {} };
let runtimeAt = 0;
const RUNTIME_CACHE_MS = 45_000;

export function invalidateSfxRuntimeCache() {
  runtimeAt = 0;
}

async function loadSfxRuntime(gameId: string): Promise<SfxRuntime> {
  if (Date.now() - runtimeAt < RUNTIME_CACHE_MS && runtimeAt > 0) {
    return runtime;
  }
  try {
    const r = await api<{
      ok: true;
      games: Partial<
        Record<
          string,
          {
            sfx?: {
              styles?: Partial<Record<string, string>>;
              paths?: Partial<Record<string, string>>;
            };
          }
        >
      >;
    }>("/api/play-media-presets");
    const styles: SfxRuntime["styles"] = {};
    const paths: SfxRuntime["paths"] = {};
    // Merge all games — slots are unique enough; prefer requested game last
    const order = ["tarot", "olympus", "boi", "arcana", gameId];
    for (const id of order) {
      const g = r.games?.[id]?.sfx;
      if (!g) continue;
      if (g.styles) {
        for (const [k, v] of Object.entries(g.styles)) {
          if (isSfxStyleId(v)) styles[k] = v;
        }
      }
      if (g.paths) {
        for (const [k, v] of Object.entries(g.paths)) {
          if (typeof v === "string" && v.trim()) paths[k] = v.trim();
        }
      }
    }
    runtime = { styles, paths };
    runtimeAt = Date.now();
    return runtime;
  } catch {
    return runtime;
  }
}

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

type StyleMul = { gain: number; pitch: number; dens: number };

function styleMul(style: SfxStyleId): StyleMul {
  switch (style) {
    case "soft":
      return { gain: 0.72, pitch: 0.92, dens: 0.7 };
    case "crisp":
      return { gain: 1.05, pitch: 1.12, dens: 1.15 };
    case "bright":
      return { gain: 1.1, pitch: 1.28, dens: 1.05 };
    default:
      return { gain: 1, pitch: 1, dens: 1 };
  }
}

function playSynth(
  ctx: AudioContext,
  dest: AudioNode,
  name: SfxName,
  style: SfxStyleId,
) {
  const m = styleMul(style);
  const g = (n: number) => n * m.gain;
  const p = (n: number) => n * m.pitch;
  const dens = m.dens;

  if (name === "tick" || name === "ui") {
    playTone(ctx, dest, p(880), 0.08, "square", g(0.08));
  } else if (name === "gather") {
    const n = Math.max(4, Math.round(8 * dens));
    for (let i = 0; i < n; i++) {
      playNoiseBurst(ctx, dest, 0.05, g(0.05), i * 0.035, p(1800 + i * 120));
      playTone(
        ctx,
        dest,
        p(320 + i * 40),
        0.05,
        "triangle",
        g(0.04),
        i * 0.035,
      );
    }
  } else if (name === "shuffle") {
    const n = Math.max(6, Math.round(10 * dens));
    for (let i = 0; i < n; i++) {
      playNoiseBurst(
        ctx,
        dest,
        0.045,
        g(0.07),
        i * 0.055,
        p(900 + Math.random() * 1800),
      );
      playTone(
        ctx,
        dest,
        p(180 + Math.random() * 420),
        0.05,
        "triangle",
        g(0.05),
        i * 0.055,
      );
    }
  } else if (name === "suspense") {
    playTone(ctx, dest, p(220), 0.35, "sine", g(0.08), 0, p(440));
    playNoiseBurst(ctx, dest, 0.12, g(0.06), 0.05, p(1400));
  } else if (name === "flip") {
    playNoiseBurst(ctx, dest, 0.14, g(0.14), 0, p(1600));
    playTone(ctx, dest, p(180), 0.16, "triangle", g(0.1), 0, p(720));
    playTone(ctx, dest, p(90), 0.1, "sine", g(0.08), 0.02, p(280));
    playNoiseBurst(ctx, dest, 0.08, g(0.1), 0.1, p(3200));
    playTone(ctx, dest, p(660), 0.1, "sine", g(0.09), 0.12);
  } else if (name === "win" || name === "oly_win") {
    playTone(ctx, dest, p(523), 0.12, "sine", g(0.14), 0);
    playTone(ctx, dest, p(659), 0.14, "sine", g(0.12), 0.1);
    playTone(ctx, dest, p(784), 0.22, "sine", g(0.12), 0.2);
    playTone(ctx, dest, p(1046), 0.28, "sine", g(0.08), 0.32);
  } else if (name === "lose") {
    playTone(ctx, dest, p(320), 0.18, "triangle", g(0.1), 0, p(160));
    playNoiseBurst(ctx, dest, 0.1, g(0.05), 0.05, p(800));
  } else if (name === "spin") {
    const n = Math.max(4, Math.round(6 * dens));
    for (let i = 0; i < n; i++) {
      playTone(
        ctx,
        dest,
        p(140 + i * 28),
        0.06,
        "sawtooth",
        g(0.04),
        i * 0.04,
        p(90 + i * 10),
      );
    }
    playNoiseBurst(ctx, dest, 0.18, g(0.06), 0, p(900));
  } else if (name === "land") {
    playTone(ctx, dest, p(220), 0.08, "triangle", g(0.1));
    playNoiseBurst(ctx, dest, 0.06, g(0.08), 0.02, p(1400));
  } else if (name === "thunder") {
    playNoiseBurst(ctx, dest, 0.35, g(0.22), 0, p(280));
    playNoiseBurst(ctx, dest, 0.25, g(0.16), 0.08, p(600));
    playTone(ctx, dest, p(80), 0.4, "sawtooth", g(0.12), 0, p(40));
    playTone(ctx, dest, p(1200), 0.08, "square", g(0.06), 0.05, p(200));
  }
}

function playFile(url: string, volume: number) {
  const a = new Audio(url);
  a.volume = Math.max(0, Math.min(1, volume));
  void a.play().catch(() => {
    /* autoplay blocked */
  });
}

export function useSfx(
  defaultChannel: SfxChannel = "tarot",
  gameId: "tarot" | "olympus" | "arcana" | "boi" = "tarot",
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const { prefs, toggleChannelMute, toggleMasterMute, anyMuted } =
    usePlayPrefs();

  useEffect(() => {
    void loadSfxRuntime(gameId);
  }, [gameId]);

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

      const path = runtime.paths[name];
      if (path) {
        playFile(path, Math.min(1, gainMul));
        return;
      }

      const style = runtime.styles[name] ?? "classic";
      try {
        const ctx = ensureCtx();
        const dest = ctx.createGain();
        dest.gain.value = gainMul;
        dest.connect(ctx.destination);
        playSynth(ctx, dest, name, style);
      } catch {
        /* autoplay / audio blocked */
      }
    },
    [prefs, defaultChannel],
  );

  return { play, muted, toggleMute, anyMuted, prefs };
}
