import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "platform-games.json");
const TMP = join(DATA_DIR, "platform-games.json.tmp");

export type GameStatus = "live" | "beta" | "coming_soon";
export type GameKind = "stake" | "spin" | "oracle" | "other";
export type SpendLane = "play";

export interface GameManifest {
  id: string;
  nameVi: string;
  blurb: string;
  status: GameStatus;
  pathSuffix: string;
  kind: GameKind;
  spendLane: SpendLane;
  vaultKey?: string;
  /** Ảnh cover Lobby */
  coverUrl?: string;
  sort: number;
  enabled: boolean;
}

interface GamesFile {
  version: 1;
  games: GameManifest[];
  updatedAt: number;
}

const SEED: GameManifest[] = [
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
    id: "dice",
    nameVi: "Xúc xắc",
    blurb: "Sắp mở — bàn xúc xắc ảo.",
    status: "coming_soon",
    pathSuffix: "g/dice",
    kind: "stake",
    spendLane: "play",
    vaultKey: "dice",
    coverUrl: "/assets/lobby/soon.svg",
    sort: 40,
    enabled: true,
  },
  {
    id: "slots",
    nameVi: "Máy xu",
    blurb: "Sắp mở — slot giải trí ảo.",
    status: "coming_soon",
    pathSuffix: "g/slots",
    kind: "spin",
    spendLane: "play",
    vaultKey: "slots",
    coverUrl: "/assets/lobby/soon.svg",
    sort: 50,
    enabled: true,
  },
  {
    id: "quiz",
    nameVi: "Đố vui",
    blurb: "Sắp mở — quiz cộng đồng.",
    status: "coming_soon",
    pathSuffix: "g/quiz",
    kind: "other",
    spendLane: "play",
    coverUrl: "/assets/lobby/soon.svg",
    sort: 60,
    enabled: true,
  },
];

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, path);
}

function normalizeId(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizeStatus(raw: unknown): GameStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "live" || s === "beta" || s === "coming_soon") return s;
  return "coming_soon";
}

function normalizeKind(raw: unknown): GameKind {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "stake" || s === "spin" || s === "oracle" || s === "other") return s;
  return "other";
}

function normalizeManifest(raw: unknown): GameManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<GameManifest>;
  const id = normalizeId(g.id);
  if (!id) return null;
  const sort = Math.floor(Number(g.sort));
  return {
    id,
    nameVi: String(g.nameVi ?? id).trim().slice(0, 48) || id,
    blurb: String(g.blurb ?? "").trim().slice(0, 160),
    status: normalizeStatus(g.status),
    pathSuffix: String(g.pathSuffix ?? `g/${id}`)
      .trim()
      .replace(/^\/+/, "")
      .slice(0, 64) || `g/${id}`,
    kind: normalizeKind(g.kind),
    spendLane: "play",
    vaultKey: g.vaultKey
      ? String(g.vaultKey).trim().toLowerCase().slice(0, 32)
      : undefined,
    coverUrl: g.coverUrl
      ? String(g.coverUrl).trim().slice(0, 200)
      : undefined,
    sort: Number.isFinite(sort) ? sort : 100,
    enabled: g.enabled !== false,
  };
}

function mergeSeed(existing: GameManifest[]): GameManifest[] {
  const byId = new Map(existing.map((g) => [g.id, g]));
  for (const s of SEED) {
    const cur = byId.get(s.id);
    if (!cur) {
      byId.set(s.id, s);
      continue;
    }
    if (!cur.coverUrl && s.coverUrl) {
      byId.set(s.id, { ...cur, coverUrl: s.coverUrl });
    }
  }
  return [...byId.values()].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
}

class PlatformGamesStore {
  private games: GameManifest[] = [...SEED];
  private updatedAt = Date.now();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.persist();
        return;
      }
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as GamesFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.games)) {
        this.persist();
        return;
      }
      const normalized = parsed.games
        .map(normalizeManifest)
        .filter((g): g is GameManifest => !!g);
      this.games = mergeSeed(normalized);
      this.updatedAt = Number(parsed.updatedAt) || Date.now();
      this.persist();
    } catch (err) {
      console.warn("[platformGames] load failed:", err);
      this.games = [...SEED];
      this.persist();
    }
  }

  private persist() {
    this.updatedAt = Date.now();
    atomicWrite(PATH, {
      version: 1,
      games: this.games,
      updatedAt: this.updatedAt,
    } satisfies GamesFile);
  }

  listPublic(): GameManifest[] {
    return this.games
      .filter((g) => g.enabled)
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  }

  listAdmin(): GameManifest[] {
    return this.games
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  }

  get(id: string): GameManifest | undefined {
    const key = normalizeId(id);
    return this.games.find((g) => g.id === key);
  }

  upsert(
    raw: unknown,
  ): { ok: true; game: GameManifest } | { ok: false; reason: string } {
    const game = normalizeManifest(raw);
    if (!game) return { ok: false, reason: "Manifest không hợp lệ" };
    const idx = this.games.findIndex((g) => g.id === game.id);
    if (idx >= 0) this.games[idx] = game;
    else this.games.push(game);
    this.games.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    this.persist();
    return { ok: true, game };
  }

  patch(
    id: string,
    patch: Partial<{
      nameVi: string;
      blurb: string;
      status: GameStatus;
      pathSuffix: string;
      kind: GameKind;
      vaultKey: string | null;
      sort: number;
      enabled: boolean;
      coverUrl: string;
    }>,
  ): { ok: true; game: GameManifest } | { ok: false; reason: string } {
    const key = normalizeId(id);
    const cur = this.games.find((g) => g.id === key);
    if (!cur) return { ok: false, reason: "Không tìm thấy game" };
    const next = normalizeManifest({
      ...cur,
      ...patch,
      id: key,
      vaultKey:
        patch.vaultKey === null
          ? undefined
          : patch.vaultKey !== undefined
            ? patch.vaultKey
            : cur.vaultKey,
    });
    if (!next) return { ok: false, reason: "Patch không hợp lệ" };
    const idx = this.games.findIndex((g) => g.id === key);
    this.games[idx] = next;
    this.games.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    this.persist();
    return { ok: true, game: next };
  }

  snapshot() {
    return {
      games: this.listAdmin(),
      updatedAt: this.updatedAt,
    };
  }
}

export const platformGamesStore = new PlatformGamesStore();
