import { useCallback, useEffect, useState } from "react";

const KEY = "play_prefs_v1";
const MUTE_LEGACY = "tarot_sfx_muted";

export type AudioChannel = "master" | "ui" | "tarot" | "olympus";

export type SymbolStripMode = "icons" | "labels" | "off";

export type PlayPrefs = {
  masterMuted: boolean;
  volumes: Record<AudioChannel, number>;
  muted: Record<Exclude<AudioChannel, "master">, boolean>;
  /** Hàng biểu tượng cạnh bàn — không ẩn mặc định */
  symbolStrip: SymbolStripMode;
  /** Giảm chuyển động ngoài deck (sky/page) */
  reduceFx: boolean;
};

const DEFAULT: PlayPrefs = {
  masterMuted: false,
  volumes: { master: 80, ui: 70, tarot: 85, olympus: 85 },
  muted: { ui: false, tarot: false, olympus: false },
  symbolStrip: "icons",
  reduceFx: false,
};

function clampVol(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 80;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function loadPrefs(): PlayPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<PlayPrefs>;
      return {
        masterMuted: !!j.masterMuted,
        volumes: {
          master: clampVol(j.volumes?.master ?? DEFAULT.volumes.master),
          ui: clampVol(j.volumes?.ui ?? DEFAULT.volumes.ui),
          tarot: clampVol(j.volumes?.tarot ?? DEFAULT.volumes.tarot),
          olympus: clampVol(j.volumes?.olympus ?? DEFAULT.volumes.olympus),
        },
        muted: {
          ui: !!j.muted?.ui,
          tarot: !!j.muted?.tarot,
          olympus: !!j.muted?.olympus,
        },
        symbolStrip:
          j.symbolStrip === "labels" || j.symbolStrip === "off"
            ? j.symbolStrip
            : "icons",
        reduceFx: !!j.reduceFx,
      };
    }
    /* migrate old tarot mute */
    if (localStorage.getItem(MUTE_LEGACY) === "1") {
      return {
        ...DEFAULT,
        muted: { ...DEFAULT.muted, tarot: true },
        masterMuted: false,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT, volumes: { ...DEFAULT.volumes }, muted: { ...DEFAULT.muted } };
}

function savePrefs(p: PlayPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    localStorage.setItem(
      MUTE_LEGACY,
      p.masterMuted || p.muted.tarot ? "1" : "0",
    );
  } catch {
    /* ignore */
  }
}

type Listener = (p: PlayPrefs) => void;
const listeners = new Set<Listener>();
let cached = loadPrefs();

function publish(next: PlayPrefs) {
  cached = next;
  savePrefs(next);
  for (const fn of listeners) fn(next);
}

/** Effective gain 0..1 for a channel (respects master + channel mute/volume). */
export function channelGain(prefs: PlayPrefs, ch: Exclude<AudioChannel, "master">): number {
  if (prefs.masterMuted || prefs.muted[ch]) return 0;
  const m = prefs.volumes.master / 100;
  const c = prefs.volumes[ch] / 100;
  return Math.max(0, Math.min(1, m * c));
}

export function usePlayPrefs() {
  const [prefs, setPrefs] = useState<PlayPrefs>(() => cached);

  useEffect(() => {
    const fn: Listener = (p) => setPrefs(p);
    listeners.add(fn);
    setPrefs(cached);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const patch = useCallback((partial: Partial<PlayPrefs>) => {
    const next: PlayPrefs = {
      ...cached,
      ...partial,
      volumes: { ...cached.volumes, ...(partial.volumes || {}) },
      muted: { ...cached.muted, ...(partial.muted || {}) },
    };
    publish(next);
  }, []);

  const setVolume = useCallback((ch: AudioChannel, value: number) => {
    patch({ volumes: { ...cached.volumes, [ch]: clampVol(value) } });
  }, [patch]);

  const toggleChannelMute = useCallback(
    (ch: Exclude<AudioChannel, "master">) => {
      patch({ muted: { ...cached.muted, [ch]: !cached.muted[ch] } });
    },
    [patch],
  );

  const toggleMasterMute = useCallback(() => {
    patch({ masterMuted: !cached.masterMuted });
  }, [patch]);

  const anyMuted =
    prefs.masterMuted ||
    prefs.muted.ui ||
    prefs.muted.tarot ||
    prefs.muted.olympus;

  return {
    prefs,
    patch,
    setVolume,
    toggleChannelMute,
    toggleMasterMute,
    anyMuted,
    gain: (ch: Exclude<AudioChannel, "master">) => channelGain(prefs, ch),
  };
}
