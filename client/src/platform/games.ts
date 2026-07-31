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
    blurb: "Đặt xu đoán lá — bàn chính SOFIAORE.",
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
    nameVi: "Olympus",
    blurb: "Slot tumble 6×5 — xu chơi · demo giáo dục SOFIAORE.",
    status: "live",
    pathSuffix: "olympus",
    kind: "spin",
    spendLane: "play",
    coverUrl: "/assets/lobby/olympus.svg",
    sort: 25,
    enabled: true,
  },
  {
    id: "boi",
    nameVi: "Bói bài",
    blurb: "Tarot & chiêm tinh — tra nghĩa, không cược.",
    status: "live",
    pathSuffix: "boi-bai",
    kind: "oracle",
    spendLane: "play",
    coverUrl: "/assets/lobby/boi.svg",
    sort: 30,
    enabled: true,
  },
  {
    id: "ludo",
    nameVi: "Ludo",
    blurb: "Cờ cá ngựa isometric — 1v3 bot · demo.",
    status: "beta",
    pathSuffix: "ludo",
    kind: "other",
    spendLane: "play",
    coverUrl: "/assets/lobby/ludo.svg",
    sort: 28,
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
  if (pathname.includes("/ludo")) return "ludo";
  const m = pathname.match(/\/g\/([a-z0-9_-]+)/i);
  if (m) return m[1].toLowerCase();
  return "home";
}

export function lobbyCtaLabel(game: GameManifest): string {
  if (game.status === "coming_soon") return "Sắp mở";
  if (game.status === "beta") return `Thử ${game.nameVi}`;
  return `Vào ${game.nameVi}`;
}

export type { AuthUser };
