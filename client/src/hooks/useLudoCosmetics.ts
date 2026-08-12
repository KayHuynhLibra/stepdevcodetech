import { useEffect, useState } from "react";
import { api } from "../auth";
import { invalidatePlayMediaPresetsCache } from "./useApplyPlayMediaPresets";
import { PLAYER_COLORS, type LudoColor } from "../platform/ludo/boardMap";
import {
  isLudoPaletteId,
  isLudoViewMode,
  LUDO_BOARD_MODELS,
  LUDO_PAWN_MODELS,
  paletteColors,
  resolveCatalogModelUrl,
  type LudoPaletteId,
  type LudoPlayerColors,
  type LudoViewMode,
} from "../platform/ludo/cosmeticsCatalog";
import {
  normalizeThemeId,
  themeSeatColors,
  type LudoThemeId,
} from "../platform/ludo/themes";

export type LudoPawnColor = LudoColor;

export type LudoThemeBoardAssets = {
  boardUrl?: string;
  boardModelUrl?: string;
};

export type LudoCosmetics = {
  boardUrl: string;
  pawnUrls: Partial<Record<LudoPawnColor, string>>;
  diceUrl: string;
  reduceFx: boolean;
  paletteId: LudoPaletteId;
  playerColors: Partial<Record<LudoPawnColor, string>>;
  pawnModelId: string;
  pawnModelUrl: string;
  boardModelId: string;
  boardModelUrl: string;
  viewMode: LudoViewMode;
  themeBoards: Partial<Record<string, LudoThemeBoardAssets>>;
};

/** Optional demo art — empty by default so 3D uses procedural seat-colored pawns
 *  (texture URL + outer Suspense previously trapped UI on “Đang tải bàn 3D”). */
export const DEMO_PAWN_URLS: Partial<Record<LudoPawnColor, string>> = {};

const DEFAULTS: LudoCosmetics = {
  boardUrl: "",
  pawnUrls: { ...DEMO_PAWN_URLS },
  diceUrl: "",
  reduceFx: false,
  paletteId: "classic",
  playerColors: {},
  pawnModelId: "procedural",
  pawnModelUrl: "",
  boardModelId: "procedural",
  boardModelUrl: "",
  viewMode: "orbit",
  themeBoards: {},
};

type GameMediaPreset = {
  boardUrl?: string;
  pawnUrls?: Partial<Record<LudoPawnColor, string>>;
  diceUrl?: string;
  reduceFx?: boolean;
  paletteId?: string;
  playerColors?: Partial<Record<LudoPawnColor, string>>;
  pawnModelId?: string;
  pawnModelUrl?: string;
  boardModelId?: string;
  boardModelUrl?: string;
  viewMode?: string;
  themeBoards?: Partial<Record<string, LudoThemeBoardAssets>>;
};

let cached: LudoCosmetics | null = null;
let cacheAt = 0;
const CACHE_MS = 45_000;

function withDemoPawns(
  urls: Partial<Record<LudoPawnColor, string>>,
): Partial<Record<LudoPawnColor, string>> {
  const out = { ...urls };
  for (const c of ["red", "green", "yellow", "blue"] as const) {
    if (!out[c] && DEMO_PAWN_URLS[c]) out[c] = DEMO_PAWN_URLS[c];
  }
  return out;
}

function fromPreset(g?: GameMediaPreset | null): LudoCosmetics {
  if (!g) {
    return {
      ...DEFAULTS,
      pawnUrls: { ...DEMO_PAWN_URLS },
      playerColors: {},
    };
  }
  const pawnUrls: Partial<Record<LudoPawnColor, string>> = {};
  for (const c of ["red", "green", "yellow", "blue"] as const) {
    const u = g.pawnUrls?.[c]?.trim();
    if (u) pawnUrls[c] = u;
  }
  const playerColors: Partial<Record<LudoPawnColor, string>> = {};
  for (const c of ["red", "green", "yellow", "blue"] as const) {
    const hex = g.playerColors?.[c]?.trim();
    if (hex) playerColors[c] = hex;
  }
  return {
    boardUrl: (g.boardUrl || "").trim(),
    pawnUrls: withDemoPawns(pawnUrls),
    diceUrl: (g.diceUrl || "").trim(),
    reduceFx: !!g.reduceFx,
    paletteId: isLudoPaletteId(g.paletteId) ? g.paletteId : "classic",
    playerColors,
    pawnModelId: (g.pawnModelId || "procedural").trim() || "procedural",
    pawnModelUrl: (g.pawnModelUrl || "").trim(),
    boardModelId: (g.boardModelId || "procedural").trim() || "procedural",
    boardModelUrl: (g.boardModelUrl || "").trim(),
    viewMode: isLudoViewMode(g.viewMode) ? g.viewMode : "orbit",
    themeBoards: { ...(g.themeBoards ?? {}) },
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
    return cached ?? { ...DEFAULTS, pawnUrls: { ...DEMO_PAWN_URLS }, playerColors: {} };
  }
}

export function invalidateLudoCosmeticsCache() {
  cached = null;
  cacheAt = 0;
  invalidatePlayMediaPresetsCache();
}

export function resolvePlayerColors(
  cosmetics?: LudoCosmetics | null,
): LudoPlayerColors {
  const base = paletteColors(cosmetics?.paletteId ?? "classic");
  const override = cosmetics?.playerColors ?? {};
  return {
    red: override.red || base.red,
    green: override.green || base.green,
    yellow: override.yellow || base.yellow,
    blue: override.blue || base.blue,
  };
}

/**
 * Màu ghế/quân trên bàn theo skin phòng (classic / soccer / arena).
 * Ảnh boardUrl / pawnUrls admin vẫn áp riêng; palette admin không đè skin đã chọn.
 */
export function resolveBoardPlayerColors(
  themeId?: LudoThemeId | string | null,
  _cosmetics?: LudoCosmetics | null,
): LudoPlayerColors {
  return themeSeatColors(normalizeThemeId(themeId));
}

export function resolvePawnModelUrl(
  cosmetics?: LudoCosmetics | null,
): string | null {
  const raw = resolveCatalogModelUrl(
    LUDO_PAWN_MODELS,
    cosmetics?.pawnModelId,
    cosmetics?.pawnModelUrl,
  );
  if (!raw) return null;
  if (!/\.(glb|gltf)(\?|#|$)/i.test(raw) && !/\/models\//i.test(raw)) {
    return null;
  }
  return raw;
}

export function resolveBoardModelUrl(
  cosmetics?: LudoCosmetics | null,
  themeId?: LudoThemeId | string | null,
): string | null {
  const tid = normalizeThemeId(themeId);
  const themed = cosmetics?.themeBoards?.[tid]?.boardModelUrl?.trim();
  const raw =
    themed ||
    resolveCatalogModelUrl(
      LUDO_BOARD_MODELS,
      cosmetics?.boardModelId,
      cosmetics?.boardModelUrl,
    );
  if (!raw) return null;
  /* Only load real glTF — bad URLs hang Suspense forever. */
  if (!/\.(glb|gltf)(\?|#|$)/i.test(raw) && !/\/models\//i.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Full-board picture skins disabled — boards are procedural CSS / 3D slabs.
 * Admin may still set a GLB via boardModelUrl / themeBoards.boardModelUrl.
 */
export function resolveBoardArtUrl(
  _themeId?: LudoThemeId | string | null,
  _cosmetics?: LudoCosmetics | null,
): string {
  return "";
}

/** Cosmetics Ludo từ P+M presets — bàn / quân / xúc xắc / palette / camera. */
export function useLudoCosmetics() {
  const [cosmetics, setCosmetics] = useState<LudoCosmetics>(
    () => cached ?? { ...DEFAULTS, pawnUrls: { ...DEMO_PAWN_URLS }, playerColors: {} },
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

export { DEFAULTS as LUDO_COSMETICS_DEFAULTS, PLAYER_COLORS };
