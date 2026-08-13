/**
 * Unified stake / xu levels for all games — mainadmin editable.
 * Persists be/data/xu-levels.json
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "xu-levels.json");
const TMP = join(DATA_DIR, "xu-levels.json.tmp");

export type XuGameId =
  | "ludo"
  | "uno"
  | "oanQuan"
  | "olympus"
  | "arcana"
  | "tarot";

export const XU_GAME_IDS: XuGameId[] = [
  "ludo",
  "uno",
  "oanQuan",
  "olympus",
  "arcana",
  "tarot",
];

export const XU_GAME_LABEL: Record<XuGameId, string> = {
  ludo: "Cờ cá ngựa",
  uno: "HueRush",
  oanQuan: "Ô ăn quan",
  olympus: "BoltPeak",
  arcana: "Bánh xe Arcana",
  tarot: "Tarot (quick-add)",
};

const DEFAULT_ROOM = [0, 500, 1000, 5000];
const DEFAULT_OLYMPUS = [20, 50, 100, 200, 500, 1000, 2000, 5000];
const DEFAULT_ARCANA = [300, 800, 1500, 3000, 10_000, 30_000, 100_000, 1_000_000];
const DEFAULT_TAROT_QUICK = [10, 100, 1000, 10_000, 100_000, 1_000_000];

export type XuLevelsSnap = {
  version: 1;
  /** Default for room games when byGame missing */
  presets: number[];
  /** Tarot quick-add chips (free-form stake still allowed) */
  quickAdds: number[];
  byGame: Partial<Record<XuGameId, number[]>>;
  updatedAt: number;
  updatedBy?: string;
};

function atomicWrite(data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, PATH);
}

function clampStake(n: unknown, allowZero: boolean): number | null {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return null;
  if (allowZero ? v < 0 : v <= 0) return null;
  return Math.min(v, 10_000_000);
}

function normalizeList(
  raw: unknown,
  fallback: number[],
  opts: { allowZero: boolean; forceZero?: boolean },
): number[] {
  const src = Array.isArray(raw) ? raw : fallback;
  const list = [
    ...new Set(
      src
        .map((n) => clampStake(n, opts.allowZero))
        .filter((n): n is number => n != null),
    ),
  ].sort((a, b) => a - b);
  if (!list.length) return [...fallback];
  if (opts.forceZero && !list.includes(0)) list.unshift(0);
  return list;
}

function defaults(): XuLevelsSnap {
  return {
    version: 1,
    presets: [...DEFAULT_ROOM],
    quickAdds: [...DEFAULT_TAROT_QUICK],
    byGame: {
      ludo: [...DEFAULT_ROOM],
      uno: [...DEFAULT_ROOM],
      oanQuan: [...DEFAULT_ROOM],
      olympus: [...DEFAULT_OLYMPUS],
      arcana: [...DEFAULT_ARCANA],
      tarot: [...DEFAULT_TAROT_QUICK],
    },
    updatedAt: 0,
  };
}

class XuLevelsStore {
  private snap: XuLevelsSnap = defaults();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as Partial<XuLevelsSnap>;
      this.snap = this.normalize(raw);
    } catch {
      /* ignore */
    }
  }

  private save() {
    try {
      this.snap.updatedAt = Date.now();
      atomicWrite(this.snap);
    } catch {
      /* ignore */
    }
  }

  private normalize(raw: Partial<XuLevelsSnap> | null | undefined): XuLevelsSnap {
    const base = defaults();
    const presets = normalizeList(raw?.presets, base.presets, {
      allowZero: true,
      forceZero: true,
    });
    const quickAdds = normalizeList(raw?.quickAdds, base.quickAdds, {
      allowZero: false,
    });
    const byGame: Partial<Record<XuGameId, number[]>> = {};
    const src = raw?.byGame && typeof raw.byGame === "object" ? raw.byGame : {};
    for (const id of XU_GAME_IDS) {
      const fallback =
        id === "olympus"
          ? DEFAULT_OLYMPUS
          : id === "arcana"
            ? DEFAULT_ARCANA
            : id === "tarot"
              ? DEFAULT_TAROT_QUICK
              : presets;
      const allowZero = id === "ludo" || id === "uno" || id === "oanQuan";
      if (Array.isArray(src[id]) && (src[id] as number[]).length) {
        byGame[id] = normalizeList(src[id], fallback, {
          allowZero,
          forceZero: allowZero,
        });
      } else if (base.byGame[id]) {
        byGame[id] = [...(base.byGame[id] as number[])];
      }
    }
    return {
      version: 1,
      presets,
      quickAdds,
      byGame,
      updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : 0,
      updatedBy:
        typeof raw?.updatedBy === "string" ? raw.updatedBy.slice(0, 64) : undefined,
    };
  }

  get(): XuLevelsSnap {
    return {
      ...this.snap,
      presets: [...this.snap.presets],
      quickAdds: [...this.snap.quickAdds],
      byGame: Object.fromEntries(
        Object.entries(this.snap.byGame).map(([k, v]) => [k, [...(v || [])]]),
      ) as XuLevelsSnap["byGame"],
    };
  }

  publicView() {
    const g = this.get();
    return {
      ok: true as const,
      presets: g.presets,
      quickAdds: g.quickAdds,
      byGame: g.byGame,
      updatedAt: g.updatedAt,
    };
  }

  forGame(game: XuGameId): number[] {
    const list = this.snap.byGame[game];
    if (list?.length) return [...list];
    if (game === "tarot") return [...this.snap.quickAdds];
    if (game === "olympus") return [...DEFAULT_OLYMPUS];
    if (game === "arcana") return [...DEFAULT_ARCANA];
    return [...this.snap.presets];
  }

  isAllowed(game: XuGameId, stake: number): boolean {
    const n = Math.floor(Number(stake));
    if (!Number.isFinite(n)) return false;
    return this.forGame(game).includes(n);
  }

  patch(
    body: {
      presets?: unknown;
      quickAdds?: unknown;
      byGame?: Partial<Record<XuGameId, unknown>>;
      reset?: boolean;
      updatedBy?: string;
    },
  ): XuLevelsSnap {
    if (body.reset) {
      this.snap = defaults();
      this.snap.updatedBy = body.updatedBy?.slice(0, 64);
      this.save();
      return this.get();
    }
    const next: Partial<XuLevelsSnap> = {
      ...this.snap,
      byGame: { ...this.snap.byGame },
    };
    if (body.presets !== undefined) next.presets = body.presets as number[];
    if (body.quickAdds !== undefined) next.quickAdds = body.quickAdds as number[];
    if (body.byGame && typeof body.byGame === "object") {
      for (const id of XU_GAME_IDS) {
        if (body.byGame[id] !== undefined) {
          next.byGame![id] = body.byGame[id] as number[];
        }
      }
    }
    if (body.updatedBy) next.updatedBy = body.updatedBy.slice(0, 64);
    this.snap = this.normalize(next);
    this.save();
    return this.get();
  }

  reset(updatedBy?: string): XuLevelsSnap {
    return this.patch({ reset: true, updatedBy });
  }
}

export const xuLevelsStore = new XuLevelsStore();
