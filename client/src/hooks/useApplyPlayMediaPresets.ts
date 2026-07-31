import { useEffect } from "react";
import { api } from "../auth";
import { usePlayPrefs, type PlayPrefs } from "./usePlayPrefs";

export type PlayMediaGameId = "tarot" | "olympus" | "arcana" | "boi" | "ludo";

export type OlympusSymbolId =
  | "ruby"
  | "sapphire"
  | "emerald"
  | "amethyst"
  | "topaz"
  | "pearl"
  | "crown"
  | "bolt"
  | "zeus"
  | "wild";

type GameMediaPreset = {
  reduceFx?: boolean;
  symbolStrip?: PlayPrefs["symbolStrip"];
  symbolUrls?: Partial<Record<OlympusSymbolId, string>>;
  boltStyle?: "straight" | "zigzag" | "wave";
  boltThickness?: number;
  sfx?: {
    masterMuted?: boolean;
    volumes?: Partial<PlayPrefs["volumes"]>;
    muted?: Partial<PlayPrefs["muted"]>;
  };
  heroUrl?: string;
  zeusHeroUrl?: string;
};

let cached: Partial<Record<PlayMediaGameId, GameMediaPreset>> | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

async function loadPresets() {
  if (cached && Date.now() - cacheAt < CACHE_MS) return cached;
  try {
    const r = await api<{
      ok: true;
      games: Partial<Record<PlayMediaGameId, GameMediaPreset>>;
    }>("/api/play-media-presets");
    cached = r.games ?? {};
    cacheAt = Date.now();
    return cached;
  } catch {
    return cached ?? {};
  }
}

/** Invalidate cache after P+M saves (optional call). */
export function invalidatePlayMediaPresetsCache() {
  cached = null;
  cacheAt = 0;
}

/** Áp preset server (SFX/FX) khi vào bàn — không ghi đè nếu user đã chỉnh local mạnh. */
export function useApplyPlayMediaPresets(gameId: PlayMediaGameId) {
  const { patch } = usePlayPrefs();

  useEffect(() => {
    let cancelled = false;
    void loadPresets().then((games) => {
      if (cancelled) return;
      const g = games[gameId];
      if (!g) return;
      const partial: Partial<PlayPrefs> = {};
      if (typeof g.reduceFx === "boolean") partial.reduceFx = g.reduceFx;
      if (g.symbolStrip) partial.symbolStrip = g.symbolStrip;
      if (g.sfx) {
        if (typeof g.sfx.masterMuted === "boolean") {
          partial.masterMuted = g.sfx.masterMuted;
        }
        if (g.sfx.volumes) partial.volumes = g.sfx.volumes as PlayPrefs["volumes"];
        if (g.sfx.muted) partial.muted = g.sfx.muted as PlayPrefs["muted"];
      }
      if (Object.keys(partial).length) patch(partial);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, patch]);
}

export async function fetchGameHeroUrl(
  gameId: PlayMediaGameId,
): Promise<string | null> {
  const games = await loadPresets();
  const g = games[gameId];
  if (!g) return null;
  if (gameId === "olympus") return g.zeusHeroUrl || g.heroUrl || null;
  return g.heroUrl || null;
}

export async function fetchOlympusSymbolUrls(): Promise<
  Partial<Record<OlympusSymbolId, string>>
> {
  const games = await loadPresets();
  return games.olympus?.symbolUrls ?? {};
}

export type OlympusBoltStyle = "straight" | "zigzag" | "wave";

export async function fetchOlympusBoltFx(): Promise<{
  boltStyle: OlympusBoltStyle;
  boltThickness: number;
}> {
  const games = await loadPresets();
  const g = games.olympus;
  const boltStyle =
    g?.boltStyle === "zigzag" || g?.boltStyle === "wave"
      ? g.boltStyle
      : "straight";
  const boltThickness =
    typeof g?.boltThickness === "number" && g.boltThickness >= 1
      ? Math.min(8, g.boltThickness)
      : 2;
  return { boltStyle, boltThickness };
}
