import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  CHAT_COST,
  SAINT_CHAT_COST,
  VIP_CHAT_COST,
  type ChatMode,
} from "./shouts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "chat-config.json");
const TMP = join(DATA_DIR, "chat-config.json.tmp");

const MIN_NO_VIP = 1;
const MAX_NO_VIP = 100_000;
const MIN_SAINT = 100;
const MAX_SAINT = 1_000_000;

interface ChatConfigFileV1 {
  version: 1;
  saintCost: number;
  updatedAt: number;
  updatedBy?: string;
}

interface ChatConfigFile {
  version: 2;
  noCost: number;
  vipCost: number;
  saintCost: number;
  updatedAt: number;
  updatedBy?: string;
}

function clampNoVip(n: number): number {
  return Math.max(MIN_NO_VIP, Math.min(MAX_NO_VIP, Math.floor(n)));
}

function clampSaint(n: number): number {
  return Math.max(MIN_SAINT, Math.min(MAX_SAINT, Math.floor(n)));
}

class ChatConfigStore {
  private noCost = CHAT_COST;
  private vipCost = VIP_CHAT_COST;
  private saintCost = SAINT_CHAT_COST;
  private updatedAt = 0;
  private updatedBy = "";

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as
        | ChatConfigFile
        | ChatConfigFileV1;
      if (parsed?.version === 2) {
        this.noCost = clampNoVip(Number(parsed.noCost) || CHAT_COST);
        this.vipCost = clampNoVip(Number(parsed.vipCost) || VIP_CHAT_COST);
        this.saintCost = clampSaint(Number(parsed.saintCost) || SAINT_CHAT_COST);
        this.updatedAt = Number(parsed.updatedAt) || 0;
        this.updatedBy = String(parsed.updatedBy ?? "");
        return;
      }
      if (parsed?.version === 1) {
        const v1 = parsed as ChatConfigFileV1;
        this.saintCost = clampSaint(Number(v1.saintCost) || SAINT_CHAT_COST);
        this.updatedAt = Number(v1.updatedAt) || 0;
        this.updatedBy = String(v1.updatedBy ?? "");
      }
    } catch (err) {
      console.warn("[chat-config] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const body: ChatConfigFile = {
      version: 2,
      noCost: this.noCost,
      vipCost: this.vipCost,
      saintCost: this.saintCost,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
    writeFileSync(TMP, JSON.stringify(body, null, 2), "utf8");
    renameSync(TMP, PATH);
  }

  costForMode(mode: ChatMode): number {
    if (mode === "saint") return this.saintCost;
    if (mode === "vip") return this.vipCost;
    return this.noCost;
  }

  getSnapshot() {
    return {
      noCost: this.noCost,
      vipCost: this.vipCost,
      saintCost: this.saintCost,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }

  getPublicCosts() {
    return {
      no: this.noCost,
      vip: this.vipCost,
      saint: this.saintCost,
    };
  }

  updateConfig(
    patch: { noCost?: unknown; vipCost?: unknown; saintCost?: unknown },
    byUsername: string,
  ): { ok: true; config: ReturnType<ChatConfigStore["getSnapshot"]> } | {
    ok: false;
    reason: string;
  } {
    if (patch.noCost != null) {
      const n = Math.floor(Number(patch.noCost));
      if (!Number.isFinite(n) || n < MIN_NO_VIP || n > MAX_NO_VIP) {
        return {
          ok: false,
          reason: `No cost: ${MIN_NO_VIP}–${MAX_NO_VIP} xu`,
        };
      }
      this.noCost = n;
    }
    if (patch.vipCost != null) {
      const n = Math.floor(Number(patch.vipCost));
      if (!Number.isFinite(n) || n < MIN_NO_VIP || n > MAX_NO_VIP) {
        return {
          ok: false,
          reason: `VIP cost: ${MIN_NO_VIP}–${MAX_NO_VIP} xu`,
        };
      }
      this.vipCost = n;
    }
    if (patch.saintCost != null) {
      const n = Math.floor(Number(patch.saintCost));
      if (!Number.isFinite(n) || n < MIN_SAINT || n > MAX_SAINT) {
        return {
          ok: false,
          reason: `Saint cost: ${MIN_SAINT.toLocaleString("vi-VN")}–${MAX_SAINT.toLocaleString("vi-VN")} xu`,
        };
      }
      this.saintCost = n;
    }
    this.updatedAt = Date.now();
    this.updatedBy = byUsername;
    this.save();
    return { ok: true, config: this.getSnapshot() };
  }
}

export const chatConfigStore = new ChatConfigStore();
