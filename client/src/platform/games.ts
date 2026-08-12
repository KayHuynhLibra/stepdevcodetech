import { api, homePath, type AuthUser, type UserRole } from "../auth";

export type GameStatus = "live" | "beta" | "coming_soon";
export type GameKind = "stake" | "spin" | "oracle" | "other";
export type GameId = string;

export interface GameManifest {
  id: GameId;
  nameVi: string;
  blurb: string;
  status: GameStatus;
  pathSuffix: string;
  kind: GameKind;
  spendLane: "play";
  vaultKey?: string;
  coverUrl?: string;
  sort: number;
  enabled: boolean;
}

const FALLBACK: GameManifest[] = [
  {
    id: "tarot",
    nameVi: "Tarot",
    blurb: "Dùng xu chơi — đoán lá · bàn chính SOFIAORE.",
    status: "live",
    pathSuffix: "play",
    kind: "stake",
    spendLane: "play",
    vaultKey: "tarot",
    coverUrl: "/assets/lobby/tarot.svg",
    sort: 10,
    enabled: true,
  },
  {
    id: "arcana",
    nameVi: "Arcana",
    blurb: "Bánh xe quay — spin xu chơi.",
    status: "live",
    pathSuffix: "arcana",
    kind: "spin",
    spendLane: "play",
    vaultKey: "arcana",
    coverUrl: "/assets/lobby/arcana.svg",
    sort: 20,
    enabled: true,
  },
  {
    id: "olympus",
    nameVi: "BoltPeak",
    blurb: "Slot tumble 6×5 · xu chơi · demo giáo dục SOFIAORE (original).",
    status: "live",
    pathSuffix: "olympus",
    kind: "spin",
    spendLane: "play",
    coverUrl: "/assets/lobby/olympus.svg",
    sort: 25,
    enabled: true,
  },
  {
    id: "oan-quan",
    nameVi: "Ô ăn quan",
    blurb: "Dân gian Việt — PvP / vs bot · rải dân ăn quan.",
    status: "live",
    pathSuffix: "oan-quan",
    kind: "other",
    spendLane: "play",
    coverUrl: "/assets/lobby/oan-quan.svg",
    sort: 27,
    enabled: true,
  },
  {
    id: "uno",
    nameVi: "HueRush",
    blurb: "Bài 4 màu · 112 lá · 2–10 người · chồng +2/+4 · demo SOFIAORE.",
    status: "live",
    pathSuffix: "uno",
    kind: "other",
    spendLane: "play",
    coverUrl: "/assets/lobby/uno.svg",
    sort: 26,
    enabled: true,
  },
  {
    id: "ludo",
    nameVi: "Cờ cá ngựa",
    blurb: "Bàn 2D/3D · 1v3 bot · lobby · demo SOFIAORE.",
    status: "live",
    pathSuffix: "ludo",
    kind: "other",
    spendLane: "play",
    coverUrl: "/assets/lobby/ludo.svg",
    sort: 28,
    enabled: true,
  },
  {
    id: "boi",
    nameVi: "Bói bài",
    blurb: "Theatre 78 lá — xào/rút thật, không cược · giải trí only.",
    status: "live",
    pathSuffix: "boi-bai",
    kind: "oracle",
    spendLane: "play",
    coverUrl: "/assets/lobby/boi.svg",
    sort: 30,
    enabled: true,
  },
];

let cache: GameManifest[] | null = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

export function gamePath(
  user: { role: UserRole; code?: string; id: string } | null | undefined,
  game: Pick<GameManifest, "pathSuffix"> | string,
): string {
  const suffix =
    typeof game === "string"
      ? game.replace(/^\/+/, "")
      : game.pathSuffix.replace(/^\/+/, "");
  if (!user) {
    if (suffix === "play") return "/play";
    return "/login";
  }
  return `${homePath(user)}/${suffix}`;
}

export function isGameOpen(game: GameManifest): boolean {
  return (
    game.enabled &&
    (game.status === "live" || game.status === "beta") &&
    !game.pathSuffix.startsWith("g/")
  );
}

export function getCachedPlatformGames(): GameManifest[] {
  return cache ?? FALLBACK;
}

export async function fetchPlatformGames(
  force = false,
): Promise<GameManifest[]> {
  if (!force && cache && Date.now() - cacheAt < CACHE_MS) return cache;
  try {
    const r = await api<{ ok: true; games: GameManifest[] }>(
      "/api/platform/games",
    );
    cache = Array.isArray(r.games) && r.games.length ? r.games : FALLBACK;
    cacheAt = Date.now();
    return cache;
  } catch {
    if (!cache) cache = FALLBACK;
    return cache;
  }
}

export function navActiveFromPath(
  pathname: string,
): "tarot" | "arcana" | "boi" | "olympus" | "home" | GameId {
  if (pathname.endsWith("/play") || pathname === "/play") return "tarot";
  if (pathname.includes("/arcana")) return "arcana";
  if (pathname.includes("/boi-bai")) return "boi";
  if (pathname.includes("/olympus")) return "olympus";
  if (pathname.includes("/oan-quan")) return "oan-quan";
  if (pathname.includes("/uno")) return "uno";
  if (pathname.includes("/ludo")) return "ludo";
  const m = pathname.match(/\/g\/([a-z0-9_-]+)/i);
  if (m) return m[1].toLowerCase();
  return "home";
}

/** Tiêu đề lobby — tránh «chọn bàn» (nghe sòng bài) trên copy user-facing US. */
export const LOBBY_PICK_TITLE = "Chọn trò chơi";
export const LOBBY_SWITCH_TITLE = "Đổi trò chơi";

export function lobbyCtaLabel(game: GameManifest): string {
  if (game.status === "coming_soon") return "Sắp mở";
  if (game.status === "beta") return `Thử ${game.nameVi}`;
  if (game.id === "arcana") return "Vào Bánh xe Arcana";
  if (game.id === "boi") return "Vào Bói bài";
  return `Chơi ${game.nameVi}`;
}

export type { AuthUser };
