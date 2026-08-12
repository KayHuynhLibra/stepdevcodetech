/**
 * Per-player Ludo decor inventory (frames + pawn skins + boards).
 * JSON repository — not the global play-media-presets.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  boardDecorIdForTheme,
  isFreeLudoTheme,
  type LudoThemeId,
  LUDO_THEME_IDS,
  normalizeLudoThemeId,
} from "./ludoEngine.js";
import { ludoEconomyStore } from "./ludoEconomyStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "ludo-decor.json");
const TMP = join(DATA_DIR, "ludo-decor.json.tmp");

export type LudoDecorKind = "frame" | "pawn" | "board";

export type LudoDecorItem = {
  id: string;
  nameVi: string;
  kind: LudoDecorKind;
  priceXu: number;
  /** Gem — skin premium, không đụng xu stake */
  priceGem?: number;
  /** Bậc Quý tộc tối thiểu để mua */
  minNobility?: number;
  /** CSS class / tint token */
  cssClass: string;
  /** Board themes map to room themeId */
  themeId?: LudoThemeId;
  /** Optional 2D sprite accent */
  preview2d?: string;
  freeStarter?: boolean;
};

export type LudoDecorUser = {
  ownedIds: string[];
  equippedFrame: string | null;
  equippedPawn: string | null;
  equippedBoard: string | null;
};

const FREE_BOARD_IDS = LUDO_THEME_IDS.filter((t) => isFreeLudoTheme(t)).map(
  (t) => boardDecorIdForTheme(t),
);

const CATALOG: LudoDecorItem[] = [
  {
    id: "frame-classic",
    nameVi: "Khung cổ điển",
    kind: "frame",
    priceXu: 0,
    cssClass: "ludo-frame--classic",
    freeStarter: true,
  },
  {
    id: "frame-gold",
    nameVi: "Khung vàng",
    kind: "frame",
    priceXu: 0,
    priceGem: 35,
    cssClass: "ludo-frame--gold",
  },
  {
    id: "frame-neon",
    nameVi: "Khung neon",
    kind: "frame",
    priceXu: 0,
    priceGem: 90,
    cssClass: "ludo-frame--neon",
  },
  {
    id: "frame-royal",
    nameVi: "Khung hoàng gia",
    kind: "frame",
    priceXu: 0,
    priceGem: 160,
    minNobility: 3,
    cssClass: "ludo-frame--royal",
  },
  {
    id: "pawn-classic",
    nameVi: "Quân cổ điển",
    kind: "pawn",
    priceXu: 0,
    cssClass: "ludo-pawn--classic",
    freeStarter: true,
  },
  {
    id: "pawn-gem",
    nameVi: "Quân gem",
    kind: "pawn",
    priceXu: 0,
    priceGem: 55,
    cssClass: "ludo-pawn--gem",
  },
  {
    id: "pawn-crown",
    nameVi: "Quân vương miện",
    kind: "pawn",
    priceXu: 0,
    priceGem: 120,
    minNobility: 2,
    cssClass: "ludo-pawn--crown",
  },
  {
    id: "pawn-bolt",
    nameVi: "Quân sét",
    kind: "pawn",
    priceXu: 0,
    priceGem: 200,
    minNobility: 4,
    cssClass: "ludo-pawn--bolt",
  },
  {
    id: "board-classic",
    nameVi: "Bàn cổ điển",
    kind: "board",
    themeId: "classic",
    priceXu: 0,
    cssClass: "ludo-board-skin--classic",
    freeStarter: true,
  },
  {
    id: "board-soccer",
    nameVi: "Bàn sân bóng",
    kind: "board",
    themeId: "soccer",
    priceXu: 0,
    cssClass: "ludo-board-skin--soccer",
    freeStarter: true,
  },
  {
    id: "board-arena",
    nameVi: "Bàn đấu trường",
    kind: "board",
    themeId: "arena",
    priceXu: 0,
    cssClass: "ludo-board-skin--arena",
    freeStarter: true,
  },
  {
    id: "board-garden",
    nameVi: "Bàn vườn",
    kind: "board",
    themeId: "garden",
    priceXu: 0,
    priceGem: 110,
    minNobility: 1,
    cssClass: "ludo-board-skin--garden",
  },
  {
    id: "board-neon",
    nameVi: "Bàn neon đêm",
    kind: "board",
    themeId: "neon",
    priceXu: 0,
    priceGem: 180,
    minNobility: 2,
    cssClass: "ludo-board-skin--neon",
  },
  {
    id: "board-frost",
    nameVi: "Bàn băng tuyết",
    kind: "board",
    themeId: "frost",
    priceXu: 0,
    priceGem: 180,
    minNobility: 2,
    cssClass: "ludo-board-skin--frost",
  },
];

function atomicWrite(data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, PATH);
}

function emptyUser(): LudoDecorUser {
  return {
    ownedIds: ["frame-classic", "pawn-classic", ...FREE_BOARD_IDS],
    equippedFrame: "frame-classic",
    equippedPawn: "pawn-classic",
    equippedBoard: "board-classic",
  };
}

class LudoDecorStore {
  private byUser = new Map<string, LudoDecorUser>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as {
        users?: Record<string, LudoDecorUser>;
      };
      for (const [id, u] of Object.entries(raw.users ?? {})) {
        this.byUser.set(id, this.normalize(u));
      }
    } catch {
      /* ignore */
    }
  }

  private save() {
    try {
      const users: Record<string, LudoDecorUser> = {};
      for (const [id, u] of this.byUser) users[id] = u;
      atomicWrite({ version: 2, users, updatedAt: Date.now() });
    } catch {
      /* ignore */
    }
  }

  private normalize(u: Partial<LudoDecorUser> | null | undefined): LudoDecorUser {
    const base = emptyUser();
    const owned = Array.isArray(u?.ownedIds)
      ? [...new Set([...base.ownedIds, ...u!.ownedIds.map(String)])]
      : base.ownedIds;
    let frame = u?.equippedFrame ? String(u.equippedFrame) : base.equippedFrame;
    let pawn = u?.equippedPawn ? String(u.equippedPawn) : base.equippedPawn;
    let board = u?.equippedBoard ? String(u.equippedBoard) : base.equippedBoard;
    if (frame && !owned.includes(frame)) frame = "frame-classic";
    if (pawn && !owned.includes(pawn)) pawn = "pawn-classic";
    if (board && !owned.includes(board)) board = "board-classic";
    return {
      ownedIds: owned,
      equippedFrame: frame,
      equippedPawn: pawn,
      equippedBoard: board,
    };
  }

  catalog(): LudoDecorItem[] {
    return CATALOG.map((c) => ({
      ...c,
      priceXu: ludoEconomyStore.priceFor(c.id, c.priceXu),
    }));
  }

  getItem(id: string): LudoDecorItem | null {
    const base = CATALOG.find((c) => c.id === id);
    if (!base) return null;
    return {
      ...base,
      priceXu: ludoEconomyStore.priceFor(base.id, base.priceXu),
    };
  }

  getBoardItemForTheme(themeId: LudoThemeId): LudoDecorItem | null {
    return CATALOG.find((c) => c.kind === "board" && c.themeId === themeId) ?? null;
  }

  ensureUser(userId: string): LudoDecorUser {
    let u = this.byUser.get(userId);
    if (!u) {
      u = emptyUser();
      this.byUser.set(userId, u);
      this.save();
    } else {
      /* Migrate: always ensure free boards owned */
      let dirty = false;
      for (const id of FREE_BOARD_IDS) {
        if (!u.ownedIds.includes(id)) {
          u.ownedIds.push(id);
          dirty = true;
        }
      }
      if (!u.equippedBoard) {
        u.equippedBoard = "board-classic";
        dirty = true;
      }
      if (dirty) {
        this.byUser.set(userId, u);
        this.save();
      }
    }
    return u;
  }

  snapshot(userId: string): {
    catalog: LudoDecorItem[];
    ownedIds: string[];
    equippedFrame: string | null;
    equippedPawn: string | null;
    equippedBoard: string | null;
  } {
    const u = this.ensureUser(userId);
    return {
      catalog: this.catalog(),
      ownedIds: [...u.ownedIds],
      equippedFrame: u.equippedFrame,
      equippedPawn: u.equippedPawn,
      equippedBoard: u.equippedBoard,
    };
  }

  ownsTheme(userId: string | null | undefined, themeRaw: unknown): boolean {
    const themeId = normalizeLudoThemeId(themeRaw);
    if (isFreeLudoTheme(themeId)) return true;
    if (!userId) return false;
    const item = this.getBoardItemForTheme(themeId);
    if (!item) return false;
    if (item.priceXu <= 0 || item.freeStarter) return true;
    const u = this.ensureUser(userId);
    return u.ownedIds.includes(item.id);
  }

  /** Call after balance debit succeeds. */
  grantOwned(userId: string, itemId: string): { ok: true } | { ok: false; reason: string } {
    const item = this.getItem(itemId);
    if (!item) return { ok: false, reason: "Không có vật phẩm" };
    const u = this.ensureUser(userId);
    if (u.ownedIds.includes(itemId)) {
      return { ok: false, reason: "Đã sở hữu" };
    }
    u.ownedIds.push(itemId);
    this.save();
    return { ok: true };
  }

  equip(
    userId: string,
    opts: {
      frameId?: string | null;
      pawnId?: string | null;
      boardId?: string | null;
    },
  ): { ok: true; user: LudoDecorUser } | { ok: false; reason: string } {
    const u = this.ensureUser(userId);
    if (opts.frameId !== undefined) {
      if (opts.frameId === null || opts.frameId === "none") {
        u.equippedFrame = "frame-classic";
      } else {
        if (!u.ownedIds.includes(opts.frameId)) {
          return { ok: false, reason: "Chưa sở hữu khung này" };
        }
        const item = this.getItem(opts.frameId);
        if (!item || item.kind !== "frame") {
          return { ok: false, reason: "Không phải khung" };
        }
        u.equippedFrame = opts.frameId;
      }
    }
    if (opts.pawnId !== undefined) {
      if (opts.pawnId === null || opts.pawnId === "none") {
        u.equippedPawn = "pawn-classic";
      } else {
        if (!u.ownedIds.includes(opts.pawnId)) {
          return { ok: false, reason: "Chưa sở hữu quân này" };
        }
        const item = this.getItem(opts.pawnId);
        if (!item || item.kind !== "pawn") {
          return { ok: false, reason: "Không phải quân" };
        }
        u.equippedPawn = opts.pawnId;
      }
    }
    if (opts.boardId !== undefined) {
      if (opts.boardId === null || opts.boardId === "none") {
        u.equippedBoard = "board-classic";
      } else {
        if (!u.ownedIds.includes(opts.boardId)) {
          return { ok: false, reason: "Chưa sở hữu bàn này" };
        }
        const item = this.getItem(opts.boardId);
        if (!item || item.kind !== "board") {
          return { ok: false, reason: "Không phải bàn" };
        }
        u.equippedBoard = opts.boardId;
      }
    }
    this.save();
    return {
      ok: true,
      user: {
        ...u,
        ownedIds: [...u.ownedIds],
      },
    };
  }
}

export const ludoDecorStore = new LudoDecorStore();
/** @deprecated use ludoEconomyStore.botWinMult() */
export const LUDO_BOT_WIN_MULT = 2;
/** @deprecated use ludoEconomyStore.stakePresets() */
export const LUDO_STAKE_PRESETS = [0, 500, 1000, 5000] as const;
