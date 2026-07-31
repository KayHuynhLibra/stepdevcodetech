import { useEffect, useState } from "react";
import { api } from "../auth";
import { invalidatePlayMediaPresetsCache } from "./useApplyPlayMediaPresets";

export type LudoPawnColor = "red" | "green" | "yellow" | "blue";

export type LudoCosmetics = {
  boardUrl: string;
  pawnUrls: Partial<Record<LudoPawnColor, string>>;
  diceUrl: string;
  reduceFx: boolean;
};

const DEFAULTS: LudoCosmetics = {
  boardUrl: "",
  pawnUrls: {},
  diceUrl: "",
  reduceFx: false,
};

type GameMediaPreset = {
  boardUrl?: string;
  pawnUrls?: Partial<Record<LudoPawnColor, string>>;
  diceUrl?: string;
  reduceFx?: boolean;
};

let cached: LudoCosmetics | null = null;
let cacheAt = 0;
const CACHE_MS = 45_000;

function fromPreset(g?: GameMediaPreset | null): LudoCosmetics {
  if (!g) return { ...DEFAULTS, pawnUrls: {} };
  const pawnUrls: Partial<Record<LudoPawnColor, string>> = {};
  for (const c of ["red", "green", "yellow", "blue"] as const) {
    const u = g.pawnUrls?.[c]?.trim();
    if (u) pawnUrls[c] = u;
  }
  return {
    boardUrl: (g.boardUrl || "").trim(),
    pawnUrls,
    diceUrl: (g.diceUrl || "").trim(),
    reduceFx: !!g.reduceFx,
  };
}

async function loadLudoCosmetics(force = false): Promise<LudoCosmetics> {
  if (!force && cached && Date.now() - cacheAt < CACHE_MS) return cached;
  try {
    const r = await api<{
      ok: true;
      games: Partial<Record<"ludo", GameMediaPreset>>;
    }>("/api/play-media-presets");
    cached = fromPreset(r.games?.ludo);
    cacheAt = Date.now();
    return cached;
  } catch {
    return cached ?? { ...DEFAULTS, pawnUrls: {} };
  }
}

export function invalidateLudoCosmeticsCache() {
  cached = null;
  cacheAt = 0;
  invalidatePlayMediaPresetsCache();
}

/** Cosmetics Ludo từ P+M presets — bàn / quân / xúc xắc. */
export function useLudoCosmetics() {
  const [cosmetics, setCosmetics] = useState<LudoCosmetics>(
    () => cached ?? { ...DEFAULTS, pawnUrls: {} },
  );

  useEffect(() => {
    let cancelled = false;
    void loadLudoCosmetics().then((c) => {
      if (!cancelled) setCosmetics(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return cosmetics;
}

export { DEFAULTS as LUDO_COSMETICS_DEFAULTS };
