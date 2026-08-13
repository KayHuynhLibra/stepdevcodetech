/**
 * Per-player HueRush cosmetics — card backs + table felts.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "uno-decor.json");
const TMP = join(DATA_DIR, "uno-decor.json.tmp");

export type UnoDecorKind = "back" | "felt";

export type UnoDecorItem = {
  id: string;
  nameVi: string;
  kind: UnoDecorKind;
  /** Xu chơi (có thể 0 nếu chỉ bán Gem) */
  priceXu: number;
  /** Gem — skin premium, không đụng xu stake */
  priceGem?: number;
  /** Bậc Quý tộc tối thiểu để mua */
  minNobility?: number;
  cssClass: string;
  freeStarter?: boolean;
};

export type UnoDecorUser = {
  ownedIds: string[];
  equippedBack: string | null;
  equippedFelt: string | null;
};

const CATALOG: UnoDecorItem[] = [
  {
    id: "back-classic",
    nameVi: "Lá úp cổ điển",
    kind: "back",
    priceXu: 0,
    cssClass: "uno-card-back--classic",
    freeStarter: true,
  },
  {
    id: "back-neon",
    nameVi: "Lá úp neon",
    kind: "back",
    priceXu: 0,
    priceGem: 40,
    cssClass: "uno-card-back--neon",
  },
  {
    id: "back-gold",
    nameVi: "Lá úp vàng",
    kind: "back",
    priceXu: 0,
    priceGem: 80,
    minNobility: 1,
    cssClass: "uno-card-back--gold",
  },
  {
    id: "back-cosmic",
    nameVi: "Lá úp vũ trụ",
    kind: "back",
    priceXu: 0,
    priceGem: 150,
    minNobility: 3,
    cssClass: "uno-card-back--cosmic",
  },
  {
    id: "back-retro",
    nameVi: "Lá úp retro 70s",
    kind: "back",
    priceXu: 0,
    priceGem: 100,
    minNobility: 2,
    cssClass: "uno-card-back--retro",
  },
  {
    id: "felt-classic",
    nameVi: "Nỉ xanh cổ điển",
    kind: "felt",
    priceXu: 0,
    cssClass: "uno-felt--classic",
    freeStarter: true,
  },
  {
    id: "felt-neon",
    nameVi: "Nỉ neon casino",
    kind: "felt",
    priceXu: 0,
    priceGem: 50,
    cssClass: "uno-felt--neon",
  },
  {
    id: "felt-royal",
    nameVi: "Nỉ hoàng gia",
    kind: "felt",
    priceXu: 0,
    priceGem: 90,
    minNobility: 2,
    cssClass: "uno-felt--royal",
  },
  {
    id: "felt-midnight",
    nameVi: "Nỉ nửa đêm",
    kind: "felt",
    priceXu: 0,
    priceGem: 120,
    minNobility: 3,
    cssClass: "uno-felt--midnight",
  },
];

type StoreFile = {
  users: Record<string, UnoDecorUser>;
  updatedAt: number;
};

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, path);
}

class UnoDecorStore {
  private users = new Map<string, UnoDecorUser>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as StoreFile;
      for (const [uid, u] of Object.entries(raw.users ?? {})) {
        this.users.set(uid, u);
      }
    } catch {
      /* ignore */
    }
  }

  private save() {
    try {
      atomicWrite(PATH, {
        users: Object.fromEntries(this.users),
        updatedAt: Date.now(),
      });
    } catch {
      /* ignore */
    }
  }

  catalog(): UnoDecorItem[] {
    return CATALOG.map((c) => ({ ...c }));
  }

  getItem(id: string): UnoDecorItem | null {
    return CATALOG.find((c) => c.id === id) ?? null;
  }

  defaultUser(): UnoDecorUser {
    const starters = CATALOG.filter((c) => c.freeStarter).map((c) => c.id);
    return {
      ownedIds: [...starters],
      equippedBack: "back-classic",
      equippedFelt: "felt-classic",
    };
  }

  ensureUser(userId: string): UnoDecorUser {
    let u = this.users.get(userId);
    if (!u) {
      u = this.defaultUser();
      this.users.set(userId, u);
      this.save();
    }
    return { ...u, ownedIds: [...u.ownedIds] };
  }

  snapshot(userId: string) {
    const u = this.ensureUser(userId);
    return {
      catalog: this.catalog(),
      ownedIds: [...u.ownedIds],
      equippedBack: u.equippedBack,
      equippedFelt: u.equippedFelt,
    };
  }

  cssForUser(userId: string | null | undefined): {
    backClass: string;
    feltClass: string;
  } {
    if (!userId) {
      return {
        backClass: "uno-card-back--classic",
        feltClass: "uno-felt--classic",
      };
    }
    const u = this.ensureUser(userId);
    const back = this.getItem(u.equippedBack ?? "back-classic");
    const felt = this.getItem(u.equippedFelt ?? "felt-classic");
    return {
      backClass: back?.cssClass ?? "uno-card-back--classic",
      feltClass: felt?.cssClass ?? "uno-felt--classic",
    };
  }

  grantOwned(userId: string, itemId: string): { ok: true } | { ok: false; reason: string } {
    const item = this.getItem(itemId);
    if (!item) return { ok: false, reason: "Không có vật phẩm" };
    const u = this.ensureUser(userId);
    if (u.ownedIds.includes(itemId)) {
      return { ok: false, reason: "Đã sở hữu" };
    }
    u.ownedIds.push(itemId);
    this.users.set(userId, u);
    this.save();
    return { ok: true };
  }

  equip(
    userId: string,
    opts: { backId?: string | null; feltId?: string | null },
  ): { ok: true } | { ok: false; reason: string } {
    const u = this.ensureUser(userId);
    if (opts.backId !== undefined && opts.backId !== null) {
      if (!u.ownedIds.includes(opts.backId)) {
        return { ok: false, reason: "Chưa sở hữu lá úp này" };
      }
      u.equippedBack = opts.backId;
    }
    if (opts.feltId !== undefined && opts.feltId !== null) {
      if (!u.ownedIds.includes(opts.feltId)) {
        return { ok: false, reason: "Chưa sở hữu nỉ này" };
      }
      u.equippedFelt = opts.feltId;
    }
    this.users.set(userId, u);
    this.save();
    return { ok: true };
  }
}

export const unoDecorStore = new UnoDecorStore();
