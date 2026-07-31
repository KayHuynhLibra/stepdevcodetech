import { useCallback, useEffect, useRef } from "react";
import {
  channelGain,
  usePlayPrefs,
  type AudioChannel,
} from "./usePlayPrefs";
import { api } from "../auth";
import {
  normalizeSfxStyleId,
  type SfxStyleId,
} from "../sfxCatalog";

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
  | "ui"
  | "roll"
  | "move"
  | "capture"
  | "home";

type SfxChannel = Exclude<AudioChannel, "master">;

export type SfxGameId = "tarot" | "olympus" | "arcana" | "boi" | "ludo";

const ALL_SFX_NAMES = new Set<string>([
  "tick",
  "gather",
  "shuffle",
  "suspense",
  "flip",
  "win",
  "lose",
  "spin",
  "land",
  "thunder",
  "oly_win",
  "ui",
  "roll",
  "move",
  "capture",
  "home",
]);

type SfxRuntime = {
  styles: Partial<Record<string, SfxStyleId>>;
  paths: Partial<Record<string, string>>;
};

let runtimeByGame: Partial<Record<SfxGameId, SfxRuntime>> = {};
let runtimeAt = 0;
const RUNTIME_CACHE_MS = 45_000;

export function invalidateSfxRuntimeCache() {
  runtimeAt = 0;
  runtimeByGame = {};
}

async function loadSfxRuntime(gameId: SfxGameId): Promise<SfxRuntime> {
  if (
    Date.now() - runtimeAt < RUNTIME_CACHE_MS &&
    runtimeAt > 0 &&
    runtimeByGame[gameId]
  ) {
    return runtimeByGame[gameId]!;
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
    const next: typeof runtimeByGame = {};
    for (const id of ["tarot", "olympus", "arcana", "boi", "ludo"] as const) {
      const g = r.games?.[id]?.sfx;
      const styles: SfxRuntime["styles"] = {};
      const paths: SfxRuntime["paths"] = {};
      if (g?.styles) {
        for (const [k, v] of Object.entries(g.styles)) {
          const n = normalizeSfxStyleId(v);
          if (n) styles[k] = n;
        }
      }
      if (g?.paths) {
        for (const [k, v] of Object.entries(g.paths)) {
          if (typeof v === "string" && v.trim()) paths[k] = v.trim();
        }
      }
      next[id] = { styles, paths };
    }
    runtimeByGame = next;
    runtimeAt = Date.now();
    return runtimeByGame[gameId] ?? { styles: {}, paths: {} };
  } catch {
    return runtimeByGame[gameId] ?? { styles: {}, paths: {} };
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
  q = 0.7,
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
  filter.Q.value = q;
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

/** Chord / arpeggio helper */
function playChord(
  ctx: AudioContext,
  dest: AudioNode,
  freqs: number[],
  duration: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
  stagger = 0,
) {
  freqs.forEach((f, i) => {
    playTone(ctx, dest, f, duration, type, gain, delay + i * stagger);
  });
}

/**
 * Gói âm = chất liệu khác nhau (không phải slider êm/sắc).
 * classic: bài gỗ dày · mystic: pad/chuông · casino: chip dứt · fortune: chuông may
 */
function playSynth(
  ctx: AudioContext,
  dest: AudioNode,
  name: SfxName,
  style: SfxStyleId,
) {
  if (name === "tick" || name === "ui") {
    if (style === "mystic") {
      playTone(ctx, dest, 660, 0.1, "sine", 0.07);
      playTone(ctx, dest, 990, 0.08, "triangle", 0.04, 0.02);
    } else if (style === "casino") {
      playTone(ctx, dest, 1200, 0.05, "square", 0.07);
      playNoiseBurst(ctx, dest, 0.04, 0.05, 0, 2800, 1.2);
    } else if (style === "fortune") {
      playTone(ctx, dest, 1046, 0.09, "sine", 0.08);
      playTone(ctx, dest, 1568, 0.07, "sine", 0.05, 0.04);
    } else {
      playTone(ctx, dest, 880, 0.07, "square", 0.09);
      playNoiseBurst(ctx, dest, 0.035, 0.04, 0, 2400);
    }
    return;
  }

  if (name === "gather") {
    if (style === "mystic") {
      for (let i = 0; i < 6; i++) {
        playTone(
          ctx,
          dest,
          180 + i * 55,
          0.12,
          "sine",
          0.055,
          i * 0.05,
          260 + i * 40,
        );
      }
      playTone(ctx, dest, 110, 0.35, "triangle", 0.06, 0, 90);
    } else if (style === "casino") {
      for (let i = 0; i < 10; i++) {
        playNoiseBurst(ctx, dest, 0.04, 0.08, i * 0.028, 1600 + i * 90, 1.4);
        playTone(ctx, dest, 400 + i * 30, 0.035, "square", 0.045, i * 0.028);
      }
    } else if (style === "fortune") {
      for (let i = 0; i < 7; i++) {
        playTone(ctx, dest, 523 + i * 40, 0.1, "sine", 0.06, i * 0.045);
        playTone(ctx, dest, 784 + i * 30, 0.08, "triangle", 0.035, i * 0.045);
      }
    } else {
      /* classic — gỗ / giấy dày */
      for (let i = 0; i < 10; i++) {
        playNoiseBurst(ctx, dest, 0.055, 0.07, i * 0.032, 1400 + i * 100, 0.9);
        playTone(
          ctx,
          dest,
          280 + i * 35,
          0.06,
          "triangle",
          0.055,
          i * 0.032,
        );
        if (i % 2 === 0) {
          playTone(ctx, dest, 90 + i * 8, 0.05, "sine", 0.04, i * 0.032);
        }
      }
    }
    return;
  }

  if (name === "shuffle") {
    if (style === "mystic") {
      for (let i = 0; i < 8; i++) {
        playNoiseBurst(ctx, dest, 0.07, 0.05, i * 0.06, 700 + i * 80, 0.5);
        playTone(
          ctx,
          dest,
          160 + Math.random() * 80,
          0.1,
          "sine",
          0.05,
          i * 0.06,
          220,
        );
      }
      playTone(ctx, dest, 55, 0.45, "triangle", 0.07, 0, 40);
    } else if (style === "casino") {
      for (let i = 0; i < 14; i++) {
        playNoiseBurst(
          ctx,
          dest,
          0.035,
          0.09,
          i * 0.04,
          1100 + Math.random() * 1600,
          1.6,
        );
        playTone(
          ctx,
          dest,
          220 + Math.random() * 500,
          0.03,
          "square",
          0.04,
          i * 0.04,
        );
      }
    } else if (style === "fortune") {
      for (let i = 0; i < 9; i++) {
        playTone(
          ctx,
          dest,
          440 + (i % 4) * 110,
          0.07,
          "triangle",
          0.055,
          i * 0.05,
        );
        playNoiseBurst(ctx, dest, 0.04, 0.04, i * 0.05, 2400, 0.8);
      }
    } else {
      for (let i = 0; i < 12; i++) {
        playNoiseBurst(
          ctx,
          dest,
          0.05,
          0.085,
          i * 0.048,
          800 + Math.random() * 2000,
          0.85,
        );
        playTone(
          ctx,
          dest,
          150 + Math.random() * 380,
          0.055,
          "triangle",
          0.06,
          i * 0.048,
        );
        if (i % 3 === 0) {
          playTone(
            ctx,
            dest,
            70 + Math.random() * 40,
            0.06,
            "sine",
            0.045,
            i * 0.048,
          );
        }
      }
    }
    return;
  }

  if (name === "suspense") {
    if (style === "mystic") {
      playTone(ctx, dest, 110, 0.55, "sine", 0.09, 0, 330);
      playTone(ctx, dest, 165, 0.5, "triangle", 0.05, 0.05, 440);
      playNoiseBurst(ctx, dest, 0.2, 0.05, 0.1, 900, 0.4);
    } else if (style === "casino") {
      playTone(ctx, dest, 180, 0.28, "sawtooth", 0.07, 0, 360);
      playNoiseBurst(ctx, dest, 0.15, 0.08, 0.05, 1800, 1.2);
      playTone(ctx, dest, 90, 0.2, "square", 0.05, 0.12);
    } else if (style === "fortune") {
      playTone(ctx, dest, 392, 0.4, "sine", 0.07, 0, 523);
      playTone(ctx, dest, 587, 0.35, "sine", 0.05, 0.08, 784);
    } else {
      playTone(ctx, dest, 180, 0.4, "sine", 0.09, 0, 480);
      playTone(ctx, dest, 90, 0.35, "triangle", 0.06, 0.04, 220);
      playNoiseBurst(ctx, dest, 0.16, 0.07, 0.08, 1200);
    }
    return;
  }

  if (name === "flip") {
    if (style === "mystic") {
      playNoiseBurst(ctx, dest, 0.12, 0.08, 0, 900, 0.5);
      playTone(ctx, dest, 140, 0.22, "sine", 0.1, 0, 560);
      playTone(ctx, dest, 420, 0.18, "triangle", 0.07, 0.08);
      playTone(ctx, dest, 840, 0.14, "sine", 0.05, 0.16);
    } else if (style === "casino") {
      playNoiseBurst(ctx, dest, 0.08, 0.16, 0, 2200, 1.8);
      playTone(ctx, dest, 240, 0.1, "square", 0.1, 0, 90);
      playTone(ctx, dest, 880, 0.07, "square", 0.07, 0.06);
      playNoiseBurst(ctx, dest, 0.05, 0.1, 0.09, 3600, 2);
    } else if (style === "fortune") {
      playNoiseBurst(ctx, dest, 0.1, 0.08, 0, 1800);
      playChord(ctx, dest, [523, 659, 784], 0.16, "sine", 0.07, 0.04, 0.04);
      playTone(ctx, dest, 1046, 0.12, "sine", 0.06, 0.18);
    } else {
      playNoiseBurst(ctx, dest, 0.16, 0.16, 0, 1500, 0.9);
      playTone(ctx, dest, 160, 0.18, "triangle", 0.12, 0, 680);
      playTone(ctx, dest, 80, 0.12, "sine", 0.1, 0.02, 240);
      playNoiseBurst(ctx, dest, 0.1, 0.12, 0.09, 3000, 1.1);
      playTone(ctx, dest, 720, 0.12, "sine", 0.1, 0.11);
      playTone(ctx, dest, 360, 0.08, "triangle", 0.06, 0.14);
    }
    return;
  }

  if (name === "win" || name === "oly_win") {
    if (style === "mystic") {
      playChord(ctx, dest, [196, 247, 294], 0.35, "sine", 0.08, 0, 0.06);
      playChord(ctx, dest, [392, 494, 587], 0.4, "triangle", 0.07, 0.2, 0.05);
      playTone(ctx, dest, 784, 0.45, "sine", 0.06, 0.4);
    } else if (style === "casino") {
      playTone(ctx, dest, 523, 0.1, "square", 0.12, 0);
      playTone(ctx, dest, 659, 0.1, "square", 0.11, 0.08);
      playTone(ctx, dest, 784, 0.12, "square", 0.1, 0.16);
      playTone(ctx, dest, 1046, 0.2, "sawtooth", 0.08, 0.26);
      playNoiseBurst(ctx, dest, 0.12, 0.08, 0.3, 2000, 1.2);
    } else if (style === "fortune") {
      playChord(ctx, dest, [523, 659, 784, 1046], 0.22, "sine", 0.09, 0, 0.05);
      playChord(ctx, dest, [659, 784, 988, 1319], 0.28, "sine", 0.07, 0.22, 0.04);
      playTone(ctx, dest, 1568, 0.35, "triangle", 0.05, 0.45);
    } else {
      playTone(ctx, dest, 523, 0.14, "sine", 0.15, 0);
      playTone(ctx, dest, 659, 0.14, "triangle", 0.12, 0.09);
      playTone(ctx, dest, 784, 0.18, "sine", 0.12, 0.18);
      playTone(ctx, dest, 1046, 0.28, "sine", 0.1, 0.3);
      playTone(ctx, dest, 1319, 0.22, "triangle", 0.06, 0.42);
      playNoiseBurst(ctx, dest, 0.1, 0.05, 0.35, 2400);
    }
    return;
  }

  if (name === "lose") {
    if (style === "mystic") {
      playTone(ctx, dest, 220, 0.35, "sine", 0.09, 0, 90);
      playTone(ctx, dest, 165, 0.4, "triangle", 0.06, 0.1, 70);
    } else if (style === "casino") {
      playTone(ctx, dest, 280, 0.14, "square", 0.1, 0, 120);
      playNoiseBurst(ctx, dest, 0.12, 0.08, 0.05, 600, 1.4);
    } else if (style === "fortune") {
      playTone(ctx, dest, 392, 0.2, "sine", 0.08, 0, 247);
      playTone(ctx, dest, 294, 0.28, "triangle", 0.06, 0.12, 196);
    } else {
      playTone(ctx, dest, 300, 0.2, "triangle", 0.11, 0, 140);
      playTone(ctx, dest, 180, 0.22, "sine", 0.08, 0.08, 90);
      playNoiseBurst(ctx, dest, 0.12, 0.07, 0.06, 700);
    }
    return;
  }

  if (name === "spin") {
    if (style === "mystic") {
      for (let i = 0; i < 7; i++) {
        playTone(
          ctx,
          dest,
          90 + i * 22,
          0.1,
          "sine",
          0.05,
          i * 0.05,
          60 + i * 8,
        );
      }
    } else if (style === "casino") {
      for (let i = 0; i < 8; i++) {
        playTone(
          ctx,
          dest,
          160 + i * 35,
          0.05,
          "sawtooth",
          0.05,
          i * 0.035,
          100,
        );
      }
      playNoiseBurst(ctx, dest, 0.15, 0.07, 0, 1000, 1.2);
    } else if (style === "fortune") {
      for (let i = 0; i < 6; i++) {
        playTone(ctx, dest, 330 + i * 40, 0.08, "triangle", 0.05, i * 0.04);
      }
    } else {
      for (let i = 0; i < 7; i++) {
        playTone(
          ctx,
          dest,
          140 + i * 28,
          0.07,
          "sawtooth",
          0.05,
          i * 0.04,
          90 + i * 10,
        );
      }
      playNoiseBurst(ctx, dest, 0.2, 0.07, 0, 900);
    }
    return;
  }

  if (name === "land") {
    if (style === "mystic") {
      playTone(ctx, dest, 180, 0.12, "sine", 0.09);
      playTone(ctx, dest, 270, 0.1, "triangle", 0.05, 0.03);
    } else if (style === "casino") {
      playTone(ctx, dest, 300, 0.06, "square", 0.11);
      playNoiseBurst(ctx, dest, 0.05, 0.1, 0.015, 1800, 1.5);
    } else if (style === "fortune") {
      playTone(ctx, dest, 523, 0.1, "sine", 0.09);
      playTone(ctx, dest, 784, 0.08, "sine", 0.05, 0.04);
    } else {
      playTone(ctx, dest, 220, 0.09, "triangle", 0.11);
      playNoiseBurst(ctx, dest, 0.07, 0.09, 0.02, 1400);
    }
    return;
  }

  if (name === "thunder") {
    if (style === "mystic") {
      playNoiseBurst(ctx, dest, 0.45, 0.18, 0, 200, 0.4);
      playTone(ctx, dest, 60, 0.5, "sine", 0.14, 0, 35);
      playTone(ctx, dest, 900, 0.1, "triangle", 0.04, 0.12, 200);
    } else if (style === "casino") {
      playNoiseBurst(ctx, dest, 0.25, 0.24, 0, 350, 1.2);
      playNoiseBurst(ctx, dest, 0.18, 0.16, 0.06, 800, 1.5);
      playTone(ctx, dest, 100, 0.3, "sawtooth", 0.12, 0, 45);
    } else if (style === "fortune") {
      playNoiseBurst(ctx, dest, 0.3, 0.16, 0, 400);
      playChord(ctx, dest, [130, 196, 260], 0.35, "sawtooth", 0.07, 0.05, 0.04);
    } else {
      playNoiseBurst(ctx, dest, 0.38, 0.24, 0, 260);
      playNoiseBurst(ctx, dest, 0.28, 0.18, 0.08, 620);
      playTone(ctx, dest, 75, 0.42, "sawtooth", 0.13, 0, 38);
      playTone(ctx, dest, 1400, 0.09, "square", 0.07, 0.05, 180);
    }
    return;
  }

  if (name === "roll") {
    playNoiseBurst(ctx, dest, 0.08, 0.12, 0, 1800, 1.2);
    playTone(ctx, dest, 220, 0.06, "square", 0.08, 0.02);
    playTone(ctx, dest, 340, 0.05, "square", 0.07, 0.07);
    playNoiseBurst(ctx, dest, 0.05, 0.1, 0.1, 2400, 1.4);
    if (style === "fortune") {
      playTone(ctx, dest, 880, 0.08, "sine", 0.05, 0.14);
    }
    return;
  }

  if (name === "move") {
    playTone(ctx, dest, 520, 0.07, "triangle", 0.09, 0, 380);
    playTone(ctx, dest, 660, 0.06, "sine", 0.06, 0.05);
    if (style === "casino") {
      playNoiseBurst(ctx, dest, 0.04, 0.06, 0.02, 2000, 1.5);
    }
    return;
  }

  if (name === "capture") {
    playNoiseBurst(ctx, dest, 0.12, 0.14, 0, 900, 1.1);
    playTone(ctx, dest, 180, 0.12, "sawtooth", 0.1, 0, 90);
    playTone(ctx, dest, 90, 0.16, "triangle", 0.08, 0.06);
    return;
  }

  if (name === "home") {
    playChord(ctx, dest, [523, 659, 784], 0.22, "sine", 0.07, 0, 0.05);
    playTone(ctx, dest, 1046, 0.14, "triangle", 0.05, 0.12);
    return;
  }
}

function playFile(url: string, volume: number) {
  const a = new Audio(url);
  a.volume = Math.max(0, Math.min(1, volume));
  void a.play().catch(() => {
    /* autoplay blocked */
  });
}

/** Preview synth/file từ Admin P+M — không phụ thuộc mute user. */
export function previewSfxSlot(
  name: string,
  style: SfxStyleId = "classic",
  fileUrl?: string | null,
) {
  if (fileUrl) {
    playFile(fileUrl, 0.75);
    return;
  }
  if (!ALL_SFX_NAMES.has(name)) return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const dest = ctx.createGain();
    dest.gain.value = 0.85;
    dest.connect(ctx.destination);
    playSynth(ctx, dest, name as SfxName, style);
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* ignore */
  }
}

export function useSfx(
  defaultChannel: SfxChannel = "tarot",
  gameId: SfxGameId = "tarot",
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const runtimeRef = useRef<SfxRuntime>({ styles: {}, paths: {} });
  const { prefs, toggleChannelMute, toggleMasterMute, anyMuted } =
    usePlayPrefs();

  useEffect(() => {
    let cancelled = false;
    void loadSfxRuntime(gameId).then((r) => {
      if (!cancelled) runtimeRef.current = r;
    });
    return () => {
      cancelled = true;
    };
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
      /* Volume/mute theo bàn đang chơi — không map spin→olympus khi Arcana/Bói */
      const ch = defaultChannel;
      const gainMul = channelGain(prefs, ch);
      if (gainMul <= 0.001) return;

      const rt = runtimeRef.current;
      const path = rt.paths[name];
      if (path) {
        playFile(path, Math.min(1, gainMul));
        return;
      }

      const style = rt.styles[name] ?? "classic";
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
