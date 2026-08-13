import { useEffect, useState } from "react";
import { api } from "../auth";
import { invalidatePlayMediaPresetsCache } from "./useApplyPlayMediaPresets";

export type BoiCardBackMode = "css" | "image" | "ornate";
export type BoiBgFx = "off" | "stars" | "mist" | "cosmic" | "pulse";
export type BoiFlipFx = "off" | "olympus" | "cosmic" | "alchemy";

export type BoiCosmetics = {
  cardBackMode: BoiCardBackMode;
  cardBackUrl: string;
  bgUrl: string;
  bgFx: BoiBgFx;
  flipFx: BoiFlipFx;
  reduceFx: boolean;
};

const DEFAULTS: BoiCosmetics = {
  cardBackMode: "css",
  cardBackUrl: "",
  bgUrl: "",
  bgFx: "stars",
  flipFx: "olympus",
  reduceFx: false,
};

const COSMIC_BACK = "/assets/oracle/card-back-cosmic.png";

type GameMediaPreset = {
  heroUrl?: string;
  cardBackMode?: BoiCardBackMode;
  cardBackUrl?: string;
  bgUrl?: string;
  bgFx?: BoiBgFx;
  flipFx?: BoiFlipFx;
  reduceFx?: boolean;
};

let cached: BoiCosmetics | null = null;
let cacheAt = 0;
const CACHE_MS = 45_000;

function fromPreset(g?: GameMediaPreset | null): BoiCosmetics {
  if (!g) return { ...DEFAULTS };
  const mode =
    g.cardBackMode === "image" || g.cardBackMode === "ornate"
      ? g.cardBackMode
      : "css";
  return {
    cardBackMode: mode,
    cardBackUrl: (g.cardBackUrl || "").trim(),
    bgUrl: (g.bgUrl || g.heroUrl || "").trim(),
    bgFx:
      g.bgFx === "off" ||
      g.bgFx === "mist" ||
      g.bgFx === "cosmic" ||
      g.bgFx === "pulse"
        ? g.bgFx
        : "stars",
    flipFx:
      g.flipFx === "off" ||
      g.flipFx === "cosmic" ||
      g.flipFx === "alchemy"
        ? g.flipFx
        : "olympus",
    reduceFx: !!g.reduceFx,
  };
}

async function loadBoiCosmetics(force = false): Promise<BoiCosmetics> {
  if (!force && cached && Date.now() - cacheAt < CACHE_MS) return cached;
  try {
    const r = await api<{
      ok: true;
      games: Partial<Record<"boi", GameMediaPreset>>;
    }>("/api/play-media-presets");
    cached = fromPreset(r.games?.boi);
    cacheAt = Date.now();
    return cached;
  } catch {
    return cached ?? { ...DEFAULTS };
  }
}

export function invalidateBoiCosmeticsCache() {
  cached = null;
  cacheAt = 0;
  invalidatePlayMediaPresetsCache();
}

/** Cosmetics Bói từ P+M presets — hub + ritual. */
export function useBoiCosmetics() {
  const [cosmetics, setCosmetics] = useState<BoiCosmetics>(
    () => cached ?? { ...DEFAULTS },
  );

  useEffect(() => {
    let cancelled = false;
    void loadBoiCosmetics().then((c) => {
      if (!cancelled) setCosmetics(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return cosmetics;
}

export function resolveCardBackUrl(c: BoiCosmetics): string | null {
  if (c.cardBackMode === "css") return null;
  if (c.cardBackUrl) return c.cardBackUrl;
  if (c.cardBackMode === "image" || c.cardBackMode === "ornate") {
    return COSMIC_BACK;
  }
  return null;
}

export { COSMIC_BACK, DEFAULTS as BOI_COSMETICS_DEFAULTS };
