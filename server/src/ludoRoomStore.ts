import { randomBytes, randomInt } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  applyMove,
  colorFinished,
  createTokens,
  earnsExtraTurn,
  LUDO_COLORS,
  normalizeLudoThemeId,
  type LudoPlayer,
  type LudoPublicState,
  type LudoThemeId,
  pickAutoToken,
  validTokenIds,
} from "./ludoEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "ludo-rooms.json");
const TMP = join(DATA_DIR, "ludo-rooms.json.tmp");

const TURN_MS = 15_000;
const MAX_STRIKES = 3;
const BOT_NAMES = ["Bot Ruby", "Bot Jade", "Bot Gold", "Bot Azure"];

type RoomInternal = LudoPublicState & {
  updatedAt: number;
};

function rid(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

function atomicWrite(path: string, data: unknown) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP, path);
}

function now() {
  return Date.now();
}

function rollDie(): number {
  return randomInt(1, 7);
}

class LudoRoomStore {
  private rooms = new Map<string, RoomInternal>();

  constructor() {
    this.load();
    setInterval(() => this.tickAll(), 500);
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as {
        rooms?: RoomInternal[];
      };
      for (const r of raw.rooms ?? []) {
        if (r?.roomId) this.rooms.set(r.roomId, r);
      }
    } catch {
      /* ignore */
    }
  }

  private save() {
    try {
      atomicWrite(PATH, {
        rooms: [...this.rooms.values()].slice(-80),
        updatedAt: now(),
      });
    } catch {
      /* ignore */
    }
  }

  listOpen(): LudoPublicState[] {
    return [...this.rooms.values()]
      .filter((r) => r.status === "lobby")
      .map((r) => this.publicView(r));
  }

  get(roomId: string): LudoPublicState | null {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return null;
    this.ensureTurnClock(r);
    return this.publicView(r);
  }

  private publicView(r: RoomInternal): LudoPublicState {
    const { updatedAt: _, ...rest } = r;
    return {
      ...rest,
      themeId: normalizeLudoThemeId(r.themeId),
      tokens: r.tokens.map((t) => ({ ...t })),
    };
  }

  createRoom(opts: {
    userId?: string | null;
    guestId?: string | null;
    displayName: string;
    stake?: number;
    fillBots?: boolean;
    themeId?: LudoThemeId | string;
  }): LudoPublicState {
    const roomId = rid();
    const stake = Math.max(0, Math.floor(opts.stake ?? 0));
    const themeId = normalizeLudoThemeId(opts.themeId);
    const players: LudoPlayer[] = LUDO_COLORS.map((color, seat) => ({
      seat,
      color,
      userId: null,
      guestId: null,
      displayName: `Ghế ${color}`,
      isBot: true,
      strikes: 0,
      connected: false,
    }));

    players[0] = {
      seat: 0,
      color: "red",
      userId: opts.userId ?? null,
      guestId: opts.guestId ?? null,
      displayName: opts.displayName.slice(0, 24) || "Bạn",
      isBot: false,
      strikes: 0,
      connected: true,
    };

    if (opts.fillBots !== false) {
      for (let i = 1; i < 4; i++) {
        players[i] = {
          seat: i,
          color: LUDO_COLORS[i]!,
          userId: null,
          guestId: null,
          displayName: BOT_NAMES[i]!,
          isBot: true,
          strikes: 0,
          connected: true,
        };
      }
    }

    const room: RoomInternal = {
      roomId,
      status: "lobby",
      players,
      tokens: createTokens(),
      turnSeat: 0,
      phase: "wait_roll",
      dice: null,
      validTokenIds: [],
      consecutiveSixes: 0,
      turnDeadline: now() + TURN_MS,
      winnerSeat: null,
      lastEvent: "Phòng tạo — sẵn sàng bắt đầu",
      stake,
      themeId,
      updatedAt: now(),
    };

    this.rooms.set(roomId, room);
    this.startGame(room);
    this.save();
    return this.publicView(room);
  }

  joinRoom(
    roomId: string,
    opts: {
      userId?: string | null;
      guestId?: string | null;
      displayName: string;
    },
  ): LudoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status === "finished") return { error: "Ván đã kết thúc" };

    const existing = r.players.find(
      (p) =>
        (opts.userId && p.userId === opts.userId) ||
        (opts.guestId && p.guestId === opts.guestId),
    );
    if (existing) {
      existing.connected = true;
      existing.isBot = false;
      existing.displayName = opts.displayName.slice(0, 24) || existing.displayName;
      existing.userId = opts.userId ?? existing.userId;
      existing.guestId = opts.guestId ?? existing.guestId;
      r.updatedAt = now();
      this.save();
      return this.publicView(r);
    }

    const seat = r.players.find((p) => p.isBot || !p.connected);
    if (!seat) return { error: "Phòng đầy" };
    seat.userId = opts.userId ?? null;
    seat.guestId = opts.guestId ?? null;
    seat.displayName = opts.displayName.slice(0, 24) || "Bạn";
    seat.isBot = false;
    seat.connected = true;
    seat.strikes = 0;
    r.updatedAt = now();
    if (r.status === "lobby") this.startGame(r);
    this.save();
    return this.publicView(r);
  }

  private startGame(r: RoomInternal) {
    r.status = "playing";
    r.tokens = createTokens();
    r.turnSeat = 0;
    r.phase = "wait_roll";
    r.dice = null;
    r.validTokenIds = [];
    r.consecutiveSixes = 0;
    r.turnDeadline = now() + TURN_MS;
    r.winnerSeat = null;
    r.lastEvent = "Bắt đầu — Đỏ tung trước";
    r.updatedAt = now();
  }

  private currentPlayer(r: RoomInternal): LudoPlayer {
    return r.players[r.turnSeat]!;
  }

  private actorOwns(
    p: LudoPlayer,
    opts: { userId?: string | null; guestId?: string | null },
  ): boolean {
    if (p.isBot) return false;
    if (opts.userId && p.userId === opts.userId) return true;
    if (opts.guestId && p.guestId === opts.guestId) return true;
    return false;
  }

  roll(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): LudoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r || r.status !== "playing") return { error: "Không chơi được" };
    this.ensureTurnClock(r);
    const p = this.currentPlayer(r);
    if (r.phase !== "wait_roll") return { error: "Chưa tới lúc tung" };
    if (!p.isBot && !this.actorOwns(p, opts)) return { error: "Không phải lượt bạn" };

    const dice = rollDie();
    r.dice = dice;
    r.lastEvent = `${p.displayName} tung ${dice}`;

    if (dice === 6) {
      r.consecutiveSixes += 1;
      if (r.consecutiveSixes >= 3) {
        r.lastEvent = `${p.displayName} tung 6 ba lần — mất lượt`;
        r.consecutiveSixes = 0;
        r.dice = null;
        r.validTokenIds = [];
        this.advanceTurn(r);
        this.save();
        return this.publicView(r);
      }
    } else {
      r.consecutiveSixes = 0;
    }

    const valid = validTokenIds(r.tokens, p.color, dice);
    r.validTokenIds = valid;

    if (valid.length === 0) {
      r.lastEvent = `${p.displayName} không đi được — bỏ lượt`;
      r.dice = null;
      this.advanceTurn(r);
      this.save();
      return this.publicView(r);
    }

    if (valid.length === 1) {
      return this.executePick(r, valid[0]!, { auto: true });
    }

    r.phase = "wait_pick";
    r.turnDeadline = now() + TURN_MS;
    r.updatedAt = now();
    this.save();
    return this.publicView(r);
  }

  pick(
    roomId: string,
    tokenId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): LudoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r || r.status !== "playing") return { error: "Không chơi được" };
    this.ensureTurnClock(r);
    const p = this.currentPlayer(r);
    if (r.phase !== "wait_pick" || r.dice == null) {
      return { error: "Chưa chọn được quân" };
    }
    if (!p.isBot && !this.actorOwns(p, opts)) return { error: "Không phải lượt bạn" };
    if (!r.validTokenIds.includes(tokenId)) return { error: "Quân không hợp lệ" };
    return this.executePick(r, tokenId, { auto: false });
  }

  private executePick(
    r: RoomInternal,
    tokenId: string,
    _meta: { auto: boolean },
  ): LudoPublicState {
    const dice = r.dice!;
    const p = this.currentPlayer(r);
    const moved = applyMove(r.tokens, tokenId, dice);
    if (!moved) {
      r.lastEvent = "Nước đi lỗi — bỏ lượt";
      r.dice = null;
      r.validTokenIds = [];
      this.advanceTurn(r);
      this.save();
      return this.publicView(r);
    }

    r.tokens = moved.tokens;
    p.strikes = 0;
    r.lastEvent = `${p.displayName} đi → ${moved.dest}${
      moved.captured ? " · ăn quân" : ""
    }${moved.enteredHome ? " · về đích" : ""}`;

    if (colorFinished(r.tokens, p.color)) {
      r.status = "finished";
      r.winnerSeat = p.seat;
      r.phase = "finished";
      r.dice = null;
      r.validTokenIds = [];
      r.lastEvent = `${p.displayName} thắng!`;
      r.updatedAt = now();
      this.save();
      return this.publicView(r);
    }

    const extra = earnsExtraTurn(dice, moved.captured, moved.enteredHome);
    r.dice = null;
    r.validTokenIds = [];
    if (extra) {
      r.phase = "wait_roll";
      r.turnDeadline = now() + TURN_MS;
      r.lastEvent += " · thêm lượt";
    } else {
      r.consecutiveSixes = 0;
      this.advanceTurn(r);
    }
    r.updatedAt = now();
    this.save();
    return this.publicView(r);
  }

  private advanceTurn(r: RoomInternal) {
    r.turnSeat = (r.turnSeat + 1) % 4;
    r.phase = "wait_roll";
    r.dice = null;
    r.validTokenIds = [];
    r.consecutiveSixes = 0;
    r.turnDeadline = now() + TURN_MS;
    r.updatedAt = now();
  }

  private ensureTurnClock(r: RoomInternal) {
    if (r.status !== "playing") return;
    if (now() < r.turnDeadline) return;
    this.handleTimeout(r);
  }

  private handleTimeout(r: RoomInternal) {
    const p = this.currentPlayer(r);
    if (r.phase === "wait_roll") {
      if (!p.isBot) {
        p.strikes += 1;
        r.lastEvent = `${p.displayName} hết giờ tung (strike ${p.strikes})`;
        if (p.strikes >= MAX_STRIKES) this.convertToBot(r, p);
      }
      this.advanceTurn(r);
      this.save();
      return;
    }
    if (r.phase === "wait_pick" && r.dice != null) {
      const pick = pickAutoToken(r.validTokenIds);
      if (pick) {
        if (!p.isBot) {
          p.strikes += 1;
          r.lastEvent = `${p.displayName} hết giờ — máy chọn quân`;
          if (p.strikes >= MAX_STRIKES) this.convertToBot(r, p);
        }
        this.executePick(r, pick, { auto: true });
        return;
      }
      this.advanceTurn(r);
      this.save();
    }
  }

  private convertToBot(r: RoomInternal, p: LudoPlayer) {
    p.isBot = true;
    p.connected = true;
    p.displayName = `Bot ${p.color}`;
    p.userId = null;
    p.guestId = null;
    r.lastEvent = `${p.color} → bot (3 strike)`;
  }

  private tickAll() {
    let dirty = false;
    for (const r of this.rooms.values()) {
      if (r.status !== "playing") continue;
      if (now() >= r.turnDeadline) {
        this.handleTimeout(r);
        dirty = true;
      }
      const p = this.currentPlayer(r);
      if (p.isBot && r.phase === "wait_roll" && now() > r.updatedAt + 600) {
        this.roll(r.roomId, {});
        dirty = true;
      } else if (
        p.isBot &&
        r.phase === "wait_pick" &&
        r.validTokenIds.length &&
        now() > r.updatedAt + 500
      ) {
        const pick = pickAutoToken(r.validTokenIds);
        if (pick) this.executePick(r, pick, { auto: true });
        dirty = true;
      }
    }
    if (dirty) this.save();
  }

  reconnect(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): LudoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    const p = r.players.find(
      (x) =>
        (opts.userId && x.userId === opts.userId) ||
        (opts.guestId && x.guestId === opts.guestId),
    );
    if (p) {
      p.connected = true;
      if (p.isBot && (opts.userId || opts.guestId)) {
        /* still bot if kicked — only mark connected if was human seat reserved */
      }
      r.updatedAt = now();
      this.save();
    }
    this.ensureTurnClock(r);
    return this.publicView(r);
  }
}

export const ludoRoomStore = new LudoRoomStore();
