/**
 * P+M play media presets — hero URLs, SFX channel defaults, per-game FX toggles.
 * Persist `be/data/play-media-presets.json`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "play-media-presets.json");
const TMP = join(DATA_DIR, "play-media-presets.json.tmp");

export type PlayGameId =
  | "tarot"
  | "olympus"
  | "arcana"
  | "boi"
  | "ludo"
  | "oan-quan"
  | "uno";

export const LUDO_PAWN_COLORS = ["red", "green", "yellow", "blue"] as const;
export type LudoPawnColor = (typeof LUDO_PAWN_COLORS)[number];

export const LUDO_PALETTE_IDS = [
  "classic",
  "neon",
  "pastel",
  "royal",
  "ember",
  "custom",
] as const;
export type LudoPaletteId = (typeof LUDO_PALETTE_IDS)[number];

export const LUDO_VIEW_MODES = ["orbit", "screen", "cinema"] as const;
export type LudoViewMode = (typeof LUDO_VIEW_MODES)[number];

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, 16);
  return HEX_RE.test(t) ? t : undefined;
}

function normalizeModelId(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().toLowerCase().slice(0, 32);
  if (!t || !/^[a-z0-9_-]+$/.test(t)) return undefined;
  return t;
}

export const OLYMPUS_SYMBOL_IDS = [
  "ruby",
  "sapphire",
  "emerald",
  "amethyst",
  "topaz",
  "pearl",
  "crown",
  "bolt",
  "zeus",
  "wild",
] as const;

export type OlympusSymbolId = (typeof OLYMPUS_SYMBOL_IDS)[number];

/** Cosmetics Bói bài — úp bài / nền / FX theatre */
export type BoiCardBackMode = "css" | "image" | "ornate";
export type BoiBgFx = "off" | "stars" | "mist" | "cosmic" | "pulse";
export type BoiFlipFx = "off" | "olympus" | "cosmic" | "alchemy";

export type GameMediaPreset = {
  heroUrl?: string;
  zeusHeroUrl?: string;
  coverUrl?: string;
  reduceFx?: boolean;
  symbolStrip?: "icons" | "labels" | "off";
  /** Per-symbol art overrides (Olympus strip + reels). Empty string clears. */
  symbolUrls?: Partial<Record<OlympusSymbolId, string>>;
  /** Kiểu đường sấm Zeus → ô: thẳng / zigzag / sóng */
  boltStyle?: "straight" | "zigzag" | "wave";
  boltThickness?: number;
  /** Bói: chế độ mặt úp (css / ảnh / khung ornate) */
  cardBackMode?: BoiCardBackMode;
  /** Bói: URL ảnh mặt úp (khi mode = image|ornate) */
  cardBackUrl?: string;
  /** Bói: hình nền hub + ritual (ưu tiên hơn heroUrl) */
  bgUrl?: string;
  /** Bói: lớp hiệu ứng nền */
  bgFx?: BoiBgFx;
  /** Bói: kiểu flip VFX mặc định */
  flipFx?: BoiFlipFx;
  /** Ludo: ảnh mặt bàn */
  boardUrl?: string;
  /** Ludo: ảnh quân theo màu */
  pawnUrls?: Partial<Record<LudoPawnColor, string>>;
  /** Ludo: mặt xúc xắc (optional) */
  diceUrl?: string;
  /** Ludo: palette màu ghế (admin cosmetics) */
  paletteId?: LudoPaletteId;
  /** Ludo: hex override theo ghế (custom / partial) */
  playerColors?: Partial<Record<LudoPawnColor, string>>;
  /** Ludo: catalog id model quân (`procedural` = mesh mặc định) */
  pawnModelId?: string;
  /** Ludo: URL .glb/.gltf quân (override catalog) */
  pawnModelUrl?: string;
  /** Ludo: catalog id model bàn */
  boardModelId?: string;
  /** Ludo: URL .glb/.gltf bàn */
  boardModelUrl?: string;
  /** Ludo: camera 3D mặc định — orbit xoay / screen hướng màn hình */
  viewMode?: LudoViewMode;
  /**
   * Ludo: per-theme board art / model overrides
   * keys: classic|soccer|arena|garden|neon|frost
   */
  themeBoards?: Partial<
    Record<
      string,
      { boardUrl?: string; boardModelUrl?: string }
    >
  >;
  sfx?: {
    masterMuted?: boolean;
    volumes?: Partial<Record<"master" | "ui" | "tarot" | "olympus", number>>;
    muted?: Partial<Record<"ui" | "tarot" | "olympus", boolean>>;
    /** Optional named synth / file path hooks */
    presetName?: string;
    /** Per-slot voice pack — soft/crisp/bright legacy map → mystic/casino/fortune */
    styles?: Partial<
      Record<
        string,
        | "classic"
        | "mystic"
        | "casino"
        | "fortune"
        | "soft"
        | "crisp"
        | "bright"
      >
    >;
    /** Custom uploaded audio URL per slot — overrides synth */
    paths?: Partial<Record<string, string>>;
  };
};

export type PlayMediaPresetsSnap = {
  version: 1;
  games: Partial<Record<PlayGameId, GameMediaPreset>>;
  updatedAt: number;
};

const GAME_IDS: PlayGameId[] = [
  "tarot",
  "olympus",
  "arcana",
  "boi",
  "ludo",
  "oan-quan",
  "uno",
];

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, path);
}

function clampVol(n: unknown): number | undefined {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return undefined;
  return Math.max(0, Math.min(100, v));
}

function normalizeGamePreset(raw: unknown): GameMediaPreset {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: GameMediaPreset = {};
  if (typeof o.heroUrl === "string") out.heroUrl = o.heroUrl.trim().slice(0, 200);
  if (typeof o.zeusHeroUrl === "string") {
    out.zeusHeroUrl = o.zeusHeroUrl.trim().slice(0, 200);
  }
  if (typeof o.coverUrl === "string") out.coverUrl = o.coverUrl.trim().slice(0, 200);
  if (typeof o.reduceFx === "boolean") out.reduceFx = o.reduceFx;
  if (o.symbolStrip === "icons" || o.symbolStrip === "labels" || o.symbolStrip === "off") {
    out.symbolStrip = o.symbolStrip;
  }
  if (o.symbolUrls && typeof o.symbolUrls === "object") {
    const urls: NonNullable<GameMediaPreset["symbolUrls"]> = {};
    const raw = o.symbolUrls as Record<string, unknown>;
    for (const id of OLYMPUS_SYMBOL_IDS) {
      const v = raw[id];
      if (typeof v === "string") {
        const t = v.trim().slice(0, 200);
        if (t) urls[id] = t;
      }
    }
    if (Object.keys(urls).length) out.symbolUrls = urls;
  }
  if (
    o.boltStyle === "straight" ||
    o.boltStyle === "zigzag" ||
    o.boltStyle === "wave"
  ) {
    out.boltStyle = o.boltStyle;
  }
  {
    const t = Math.round(Number(o.boltThickness));
    if (Number.isFinite(t) && t >= 1 && t <= 8) out.boltThickness = t;
  }
  if (o.cardBackMode === "css" || o.cardBackMode === "image" || o.cardBackMode === "ornate") {
    out.cardBackMode = o.cardBackMode;
  }
  if (typeof o.cardBackUrl === "string") {
    out.cardBackUrl = o.cardBackUrl.trim().slice(0, 200);
  }
  if (typeof o.bgUrl === "string") out.bgUrl = o.bgUrl.trim().slice(0, 200);
  if (
    o.bgFx === "off" ||
    o.bgFx === "stars" ||
    o.bgFx === "mist" ||
    o.bgFx === "cosmic" ||
    o.bgFx === "pulse"
  ) {
    out.bgFx = o.bgFx;
  }
  if (
    o.flipFx === "off" ||
    o.flipFx === "olympus" ||
    o.flipFx === "cosmic" ||
    o.flipFx === "alchemy"
  ) {
    out.flipFx = o.flipFx;
  }
  if (typeof o.boardUrl === "string") {
    out.boardUrl = o.boardUrl.trim().slice(0, 200);
  }
  if (typeof o.diceUrl === "string") {
    out.diceUrl = o.diceUrl.trim().slice(0, 200);
  }
  if (o.pawnUrls && typeof o.pawnUrls === "object") {
    const urls: NonNullable<GameMediaPreset["pawnUrls"]> = {};
    const raw = o.pawnUrls as Record<string, unknown>;
    for (const id of LUDO_PAWN_COLORS) {
      const v = raw[id];
      if (typeof v === "string") {
        const t = v.trim().slice(0, 200);
        if (t) urls[id] = t;
      }
    }
    if (Object.keys(urls).length) out.pawnUrls = urls;
  }
  if (
    typeof o.paletteId === "string" &&
    (LUDO_PALETTE_IDS as readonly string[]).includes(o.paletteId)
  ) {
    out.paletteId = o.paletteId as LudoPaletteId;
  }
  if (o.playerColors && typeof o.playerColors === "object") {
    const colors: NonNullable<GameMediaPreset["playerColors"]> = {};
    const raw = o.playerColors as Record<string, unknown>;
    for (const id of LUDO_PAWN_COLORS) {
      const hex = normalizeHex(raw[id]);
      if (hex) colors[id] = hex;
    }
    if (Object.keys(colors).length) out.playerColors = colors;
  }
  {
    const pid = normalizeModelId(o.pawnModelId);
    if (pid) out.pawnModelId = pid;
  }
  if (typeof o.pawnModelUrl === "string") {
    out.pawnModelUrl = o.pawnModelUrl.trim().slice(0, 200);
  }
  {
    const bid = normalizeModelId(o.boardModelId);
    if (bid) out.boardModelId = bid;
  }
  if (typeof o.boardModelUrl === "string") {
    out.boardModelUrl = o.boardModelUrl.trim().slice(0, 200);
  }
  if (
    typeof o.viewMode === "string" &&
    (LUDO_VIEW_MODES as readonly string[]).includes(o.viewMode)
  ) {
    out.viewMode = o.viewMode as LudoViewMode;
  }
  if (o.themeBoards && typeof o.themeBoards === "object") {
    const themes: NonNullable<GameMediaPreset["themeBoards"]> = {};
    for (const [key, val] of Object.entries(
      o.themeBoards as Record<string, unknown>,
    )) {
      if (!val || typeof val !== "object") continue;
      const row = val as Record<string, unknown>;
      const entry: { boardUrl?: string; boardModelUrl?: string } = {};
      if (typeof row.boardUrl === "string") {
        const t = row.boardUrl.trim().slice(0, 200);
        if (t) entry.boardUrl = t;
      }
      if (typeof row.boardModelUrl === "string") {
        const t = row.boardModelUrl.trim().slice(0, 200);
        if (t) entry.boardModelUrl = t;
      }
      if (entry.boardUrl || entry.boardModelUrl) {
        themes[key.trim().slice(0, 24)] = entry;
      }
    }
    if (Object.keys(themes).length) out.themeBoards = themes;
  }
  if (o.sfx && typeof o.sfx === "object") {
    const s = o.sfx as Record<string, unknown>;
    const sfx: NonNullable<GameMediaPreset["sfx"]> = {};
    if (typeof s.masterMuted === "boolean") sfx.masterMuted = s.masterMuted;
    if (typeof s.presetName === "string") {
      sfx.presetName = s.presetName.trim().slice(0, 40);
    }
    if (s.styles && typeof s.styles === "object") {
      const styles: NonNullable<
        NonNullable<GameMediaPreset["sfx"]>["styles"]
      > = {};
      for (const [k, val] of Object.entries(
        s.styles as Record<string, unknown>,
      )) {
        if (
          val === "classic" ||
          val === "mystic" ||
          val === "casino" ||
          val === "fortune" ||
          val === "soft" ||
          val === "crisp" ||
          val === "bright"
        ) {
          styles[k.slice(0, 24)] = val;
        }
      }
      if (Object.keys(styles).length) sfx.styles = styles;
    }
    if (s.volumes && typeof s.volumes === "object") {
      const v = s.volumes as Record<string, unknown>;
      sfx.volumes = {};
      for (const k of ["master", "ui", "tarot", "olympus"] as const) {
        const n = clampVol(v[k]);
        if (n !== undefined) sfx.volumes[k] = n;
      }
    }
    if (s.muted && typeof s.muted === "object") {
      const m = s.muted as Record<string, unknown>;
      sfx.muted = {};
      for (const k of ["ui", "tarot", "olympus"] as const) {
        if (typeof m[k] === "boolean") sfx.muted[k] = m[k];
      }
    }
    if (s.paths && typeof s.paths === "object") {
      const p = s.paths as Record<string, unknown>;
      sfx.paths = {};
      for (const [k, val] of Object.entries(p)) {
        if (typeof val === "string" && val.trim()) {
          sfx.paths[k.slice(0, 32)] = val.trim().slice(0, 200);
        }
      }
    }
    if (Object.keys(sfx).length) out.sfx = sfx;
  }
  return out;
}

class PlayMediaPresetsStore {
  private games: Partial<Record<PlayGameId, GameMediaPreset>> = {};
  private updatedAt = Date.now();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        return;
      }
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as Partial<PlayMediaPresetsSnap>;
      const games: Partial<Record<PlayGameId, GameMediaPreset>> = {};
      if (raw.games && typeof raw.games === "object") {
        for (const id of GAME_IDS) {
          if (raw.games[id]) games[id] = normalizeGamePreset(raw.games[id]);
        }
      }
      this.games = games;
      this.updatedAt = Math.floor(Number(raw.updatedAt)) || Date.now();
    } catch {
      this.games = {};
      this.save();
    }
  }

  private save() {
    this.updatedAt = Date.now();
    atomicWrite(PATH, this.snapshot());
  }

  snapshot(): PlayMediaPresetsSnap {
    return {
      version: 1,
      games: { ...this.games },
      updatedAt: this.updatedAt,
    };
  }

  /** Public subset for clients entering a table. */
  publicSnap(): PlayMediaPresetsSnap {
    return this.snapshot();
  }

  patchGame(
    gameId: string,
    patch: GameMediaPreset,
  ): { ok: true; games: PlayMediaPresetsSnap["games"] } | { ok: false; reason: string } {
    const id = String(gameId ?? "").trim().toLowerCase() as PlayGameId;
    if (!GAME_IDS.includes(id)) {
      return {
        ok: false,
        reason: "gameId phải là tarot|olympus|arcana|boi|ludo|oan-quan|uno",
      };
    }
    const cur = this.games[id] ?? {};
    const mergedSymbolUrls = {
      ...(cur.symbolUrls ?? {}),
      ...(patch.symbolUrls ?? {}),
    };
    // Empty string in patch clears that symbol key
    if (patch.symbolUrls) {
      for (const [k, v] of Object.entries(patch.symbolUrls)) {
        if (v === "") delete (mergedSymbolUrls as Record<string, string>)[k];
      }
    }
    const mergedPawnUrls = {
      ...(cur.pawnUrls ?? {}),
      ...(patch.pawnUrls ?? {}),
    };
    if (patch.pawnUrls) {
      for (const [k, v] of Object.entries(patch.pawnUrls)) {
        if (v === "") delete (mergedPawnUrls as Record<string, string>)[k];
      }
    }
    const mergedPlayerColors = {
      ...(cur.playerColors ?? {}),
      ...(patch.playerColors ?? {}),
    };
    if (patch.playerColors) {
      for (const [k, v] of Object.entries(patch.playerColors)) {
        if (v === "") delete (mergedPlayerColors as Record<string, string>)[k];
      }
    }
    const mergedStyles = {
      ...(cur.sfx?.styles ?? {}),
      ...(patch.sfx?.styles ?? {}),
    };
    const mergedPaths = {
      ...(cur.sfx?.paths ?? {}),
      ...(patch.sfx?.paths ?? {}),
    };
    if (patch.sfx?.paths) {
      for (const [k, v] of Object.entries(patch.sfx.paths)) {
        if (v === "") delete (mergedPaths as Record<string, string>)[k];
      }
    }
    const next = normalizeGamePreset({
      ...cur,
      ...patch,
      symbolUrls: mergedSymbolUrls,
      pawnUrls: mergedPawnUrls,
      playerColors: mergedPlayerColors,
      sfx: {
        ...cur.sfx,
        ...patch.sfx,
        styles: mergedStyles,
        paths: mergedPaths,
        volumes: { ...cur.sfx?.volumes, ...patch.sfx?.volumes },
        muted: { ...cur.sfx?.muted, ...patch.sfx?.muted },
      },
    });
    this.games[id] = next;
    this.save();
    return { ok: true, games: this.snapshot().games };
  }

  replaceAll(
    games: Partial<Record<PlayGameId, GameMediaPreset>>,
  ): PlayMediaPresetsSnap {
    const next: Partial<Record<PlayGameId, GameMediaPreset>> = {};
    for (const id of GAME_IDS) {
      if (games[id]) next[id] = normalizeGamePreset(games[id]);
    }
    this.games = next;
    this.save();
    return this.snapshot();
  }
}

export const playMediaPresetsStore = new PlayMediaPresetsStore();
