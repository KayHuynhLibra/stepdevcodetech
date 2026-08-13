import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { authStore } from "./auth.js";
import { DEFAULT_AVATAR, normalizeAvatar } from "./avatars.js";
import {
  applyDraw,
  applyPlay,
  applyUnoForgotPenalty,
  dealGame,
  pickBotCard,
  playableCards,
  UNO_CATCH_MS,
  type UnoCard,
  type UnoColor,
  MAX_SEATS,
  MIN_PLAYERS,
} from "./unoEngine.js";
import { unoDecorStore } from "./unoDecorStore.js";
import { xuLevelsStore } from "./xuLevelsStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "uno-rooms.json");
const TMP = join(DATA_DIR, "uno-rooms.json.tmp");

const TURN_MS = 25_000;
const MAX_STRIKES = 3;
const BOT_WIN_MULT = 1.8;
const STAKE_PRESETS = [0, 500, 1000, 5000] as const;
const BOT_NAMES = [
  "Bot Đỏ",
  "Bot Vàng",
  "Bot Lá",
  "Bot Lam",
  "Bot Tím",
  "Bot Cam",
  "Bot Bạc",
  "Bot Vàng",
  "Bot Ngọc",
];

export type UnoPlayer = {
  seat: number;
  userId: string | null;
  guestId: string | null;
  displayName: string;
  isBot: boolean;
  strikes: number;
  connected: boolean;
  avatar?: string | null;
  saidUno: boolean;
};

export type UnoPublicState = {
  roomId: string;
  status: "lobby" | "playing" | "finished";
  phase: "lobby" | "play" | "choose_color" | "finished";
  seats: UnoPlayer[];
  playerCount: number;
  topCard: UnoCard | null;
  activeColor: UnoColor;
  direction: 1 | -1;
  turnSeat: number;
  handCounts: number[];
  myHand: UnoCard[];
  playableCardIds: string[];
  drawPileCount: number;
  pendingDraw: number;
  lastEvent: string | null;
  lastDrawn: UnoCard[];
  moveSeq: number;
  stake: number;
  pot: number;
  settled: boolean;
  winnerSeat: number | null;
  turnDeadline: number;
  fillBots: boolean;
  hostUserId?: string | null;
  hostGuestId?: string | null;
  needsColorChoice: boolean;
  deckCount: number;
  unoRiskSeat: number | null;
  unoRiskUntil: number;
  cardBackClass: string;
  feltClass: string;
  catchableSeat: number | null;
};

type RoomInternal = {
  roomId: string;
  status: "lobby" | "playing" | "finished";
  phase: "lobby" | "play" | "choose_color" | "finished";
  seats: UnoPlayer[];
  playerCount: number;
  hands: UnoCard[][];
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  activeColor: UnoColor;
  direction: 1 | -1;
  turnSeat: number;
  pendingDraw: number;
  lastEvent: string | null;
  lastDrawn: UnoCard[];
  moveSeq: number;
  stake: number;
  pot: number;
  settled: boolean;
  winnerSeat: number | null;
  turnDeadline: number;
  fillBots: boolean;
  hostUserId: string | null;
  hostGuestId: string | null;
  stakesPaid: Record<string, number>;
  updatedAt: number;
  colorChooserSeat: number | null;
  pendingWildCardId: string | null;
  deckCount: number;
  unoRiskSeat: number | null;
  unoRiskUntil: number;
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

function avatarFor(userId: string | null | undefined): string {
  if (!userId) return DEFAULT_AVATAR;
  const u = authStore.getById?.(userId) ?? null;
  return normalizeAvatar(u?.avatar);
}

function seatColor(seat: number): UnoColor {
  const cols: UnoColor[] = ["red", "yellow", "green", "blue"];
  return cols[seat % 4]!;
}

class UnoRoomStore {
  private rooms = new Map<string, RoomInternal>();

  constructor() {
    this.load();
    setInterval(() => this.tickAll(), 500);
  }

  stakePresets(): number[] {
    const list = xuLevelsStore.forGame("uno");
    return list.length ? list : [...STAKE_PRESETS];
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const raw = JSON.parse(readFileSync(PATH, "utf8")) as {
        rooms?: RoomInternal[];
      };
      for (const r of raw.rooms ?? []) {
        if (r?.roomId) {
          r.pot = typeof r.pot === "number" ? r.pot : 0;
          r.settled = !!r.settled;
          r.moveSeq = typeof r.moveSeq === "number" ? r.moveSeq : 0;
          r.hands = Array.isArray(r.hands) ? r.hands : [];
          r.drawPile = Array.isArray(r.drawPile) ? r.drawPile : [];
          r.discardPile = Array.isArray(r.discardPile) ? r.discardPile : [];
          r.deckCount = typeof r.deckCount === "number" ? r.deckCount : 1;
          r.unoRiskSeat =
            typeof r.unoRiskSeat === "number" ? r.unoRiskSeat : null;
          r.unoRiskUntil =
            typeof r.unoRiskUntil === "number" ? r.unoRiskUntil : 0;
          this.rooms.set(r.roomId, r);
        }
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

  listOpen(): Omit<UnoPublicState, "myHand" | "playableCardIds">[] {
    return [...this.rooms.values()]
      .filter((r) => r.status === "lobby" && !r.fillBots)
      .map((r) => this.publicView(r, null));
  }

  listAdmin(
    limit = 60,
  ): (Omit<UnoPublicState, "myHand" | "playableCardIds"> & {
    updatedAt: number;
  })[] {
    return [...this.rooms.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, Math.min(200, limit)))
      .map((r) => ({ ...this.publicView(r, null), updatedAt: r.updatedAt }));
  }

  adminClose(
    roomId: string,
  ): Omit<UnoPublicState, "myHand" | "playableCardIds"> | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không tìm thấy phòng" };
    if (r.status === "finished") return this.publicView(r, null);
    r.status = "finished";
    r.lastEvent = "Admin đóng phòng";
    r.turnDeadline = Date.now();
    r.updatedAt = Date.now();
    this.save();
    return this.publicView(r, null);
  }

  get(
    roomId: string,
    actor?: { userId?: string | null; guestId?: string | null },
  ): UnoPublicState | null {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return null;
    this.ensureTurnClock(r);
    return this.publicView(r, actor ?? null);
  }

  private findActorSeat(
    r: RoomInternal,
    actor: { userId?: string | null; guestId?: string | null } | null,
  ): number | null {
    if (!actor) return null;
    const p = r.seats.find(
      (s) =>
        (actor.userId && s.userId === actor.userId) ||
        (actor.guestId && s.guestId === actor.guestId),
    );
    return p?.seat ?? null;
  }

  private publicView(
    r: RoomInternal,
    actor: { userId?: string | null; guestId?: string | null } | null,
  ): UnoPublicState {
    const actorSeat = this.findActorSeat(r, actor);
    const top = r.discardPile[r.discardPile.length - 1] ?? null;
    const myHand =
      actorSeat != null && r.hands[actorSeat]
        ? r.hands[actorSeat]!.map((c) => ({ ...c }))
        : [];
    let playableCardIds: string[] = [];
    if (
      r.status === "playing" &&
      r.phase === "play" &&
      actorSeat != null &&
      actorSeat === r.turnSeat &&
      top
    ) {
      playableCardIds = playableCards(
        r.hands[actorSeat] ?? [],
        top,
        r.activeColor,
        r.pendingDraw,
      ).map((c) => c.id);
    }
    const hostId = r.hostUserId ?? r.seats[0]?.userId ?? null;
    const actorDecor = unoDecorStore.cssForUser(
      actor?.userId ?? hostId,
    );
    const feltDecor = unoDecorStore.cssForUser(hostId);
    const catchableSeat =
      r.unoRiskSeat != null &&
      now() < r.unoRiskUntil &&
      actorSeat != null &&
      actorSeat !== r.unoRiskSeat &&
      (r.hands[r.unoRiskSeat]?.length ?? 0) === 1 &&
      !r.seats[r.unoRiskSeat]?.saidUno
        ? r.unoRiskSeat
        : null;
    return {
      roomId: r.roomId,
      status: r.status,
      phase: r.phase,
      seats: r.seats.slice(0, r.playerCount).map((s) => ({ ...s })),
      playerCount: r.playerCount,
      topCard: top ? { ...top } : null,
      activeColor: r.activeColor,
      direction: r.direction,
      turnSeat: r.turnSeat,
      handCounts: r.hands
        .slice(0, r.playerCount)
        .map((h) => h?.length ?? 0),
      myHand,
      playableCardIds,
      drawPileCount: r.drawPile.length,
      pendingDraw: r.pendingDraw,
      lastEvent: r.lastEvent,
      lastDrawn: [...(r.lastDrawn ?? [])],
      moveSeq: r.moveSeq,
      stake: r.stake,
      pot: r.pot,
      settled: r.settled,
      winnerSeat: r.winnerSeat,
      turnDeadline: r.turnDeadline,
      fillBots: r.fillBots,
      hostUserId: r.hostUserId,
      hostGuestId: r.hostGuestId,
      needsColorChoice:
        r.phase === "choose_color" &&
        actorSeat != null &&
        actorSeat === r.colorChooserSeat,
      deckCount: r.deckCount ?? 1,
      unoRiskSeat: r.unoRiskSeat,
      unoRiskUntil: r.unoRiskUntil ?? 0,
      cardBackClass: actorDecor.backClass,
      feltClass: feltDecor.feltClass,
      catchableSeat,
    };
  }

  createRoom(opts: {
    userId?: string | null;
    guestId?: string | null;
    displayName: string;
    stake?: number;
    playerCount?: number;
    fillBots?: boolean;
    autoStart?: boolean;
  }): UnoPublicState | { error: string } {
    const stake = Math.max(0, Math.floor(opts.stake ?? 0));
    const playerCount = Math.min(
      MAX_SEATS,
      Math.max(MIN_PLAYERS, Math.floor(opts.playerCount ?? 4)),
    );
    const fillBots = opts.fillBots !== false;
    const autoStart = opts.autoStart !== false && fillBots;

    const seats: UnoPlayer[] = [];
    for (let i = 0; i < playerCount; i++) {
      if (i === 0) {
        seats.push({
          seat: i,
          userId: opts.userId ?? null,
          guestId: opts.guestId ?? null,
          displayName: opts.displayName.slice(0, 24) || "Bạn",
          isBot: false,
          strikes: 0,
          connected: true,
          avatar: avatarFor(opts.userId),
          saidUno: false,
        });
      } else if (fillBots) {
        seats.push({
          seat: i,
          userId: null,
          guestId: null,
          displayName: BOT_NAMES[i - 1] ?? `Bot ${i + 1}`,
          isBot: true,
          strikes: 0,
          connected: true,
          avatar: DEFAULT_AVATAR,
          saidUno: false,
        });
      } else {
        seats.push({
          seat: i,
          userId: null,
          guestId: null,
          displayName: "Chờ người",
          isBot: true,
          strikes: 0,
          connected: false,
          avatar: DEFAULT_AVATAR,
          saidUno: false,
        });
      }
    }

    const room: RoomInternal = {
      roomId: rid(),
      status: "lobby",
      phase: "lobby",
      seats,
      playerCount,
      hands: [],
      drawPile: [],
      discardPile: [],
      activeColor: "red",
      direction: 1,
      turnSeat: 0,
      pendingDraw: 0,
      lastEvent: fillBots
        ? `Phòng ${playerCount} người — bot sẵn sàng`
        : `Phòng PvP ${playerCount} chỗ — chờ người`,
      lastDrawn: [],
      moveSeq: 0,
      stake,
      pot: 0,
      settled: false,
      winnerSeat: null,
      turnDeadline: now() + TURN_MS,
      fillBots,
      hostUserId: opts.userId ?? null,
      hostGuestId: opts.guestId ?? null,
      stakesPaid: {},
      updatedAt: now(),
      colorChooserSeat: null,
      pendingWildCardId: null,
      deckCount: 1,
      unoRiskSeat: null,
      unoRiskUntil: 0,
    };

    this.rooms.set(room.roomId, room);
    if (autoStart) {
      const started = this.beginGame(room);
      if ("error" in started) {
        this.rooms.delete(room.roomId);
        return { error: started.error };
      }
    }
    this.save();
    return this.publicView(room, {
      userId: opts.userId,
      guestId: opts.guestId,
    });
  }

  joinRoom(
    roomId: string,
    opts: {
      userId?: string | null;
      guestId?: string | null;
      displayName: string;
    },
  ): UnoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status === "finished") return { error: "Ván đã kết thúc" };

    const existing = r.seats.find(
      (p) =>
        (opts.userId && p.userId === opts.userId) ||
        (opts.guestId && p.guestId === opts.guestId),
    );
    if (existing) {
      existing.connected = true;
      existing.isBot = false;
      existing.displayName =
        opts.displayName.slice(0, 24) || existing.displayName;
      existing.userId = opts.userId ?? existing.userId;
      existing.guestId = opts.guestId ?? existing.guestId;
      existing.avatar = avatarFor(existing.userId);
      r.updatedAt = now();
      this.save();
      return this.publicView(r, opts);
    }

    if (r.fillBots && r.status !== "lobby") {
      return { error: "Phòng bot — không join thêm" };
    }

    const open = r.seats.find(
      (s, i) =>
        i < r.playerCount &&
        s.isBot &&
        !s.userId &&
        !s.guestId &&
        (s.displayName.startsWith("Chờ") || s.displayName.startsWith("Bot")),
    );
    if (!open) return { error: "Phòng đầy" };

    open.userId = opts.userId ?? null;
    open.guestId = opts.guestId ?? null;
    open.displayName = opts.displayName.slice(0, 24) || "Bạn";
    open.isBot = false;
    open.connected = true;
    open.strikes = 0;
    open.avatar = avatarFor(opts.userId);
    r.fillBots = false;
    r.lastEvent = `${open.displayName} vào ghế ${open.seat + 1}`;
    r.updatedAt = now();
    this.save();
    return this.publicView(r, opts);
  }

  startRoom(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): UnoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status !== "lobby") return { error: "Ván đã bắt đầu" };
    const hostOk =
      (opts.userId && r.hostUserId && opts.userId === r.hostUserId) ||
      (opts.guestId && r.hostGuestId && opts.guestId === r.hostGuestId) ||
      (opts.userId && r.seats[0]?.userId === opts.userId) ||
      (opts.guestId && r.seats[0]?.guestId === opts.guestId);
    if (!hostOk) return { error: "Chỉ chủ phòng được bắt đầu" };

    const humans = r.seats
      .slice(0, r.playerCount)
      .filter((s) => !s.isBot && (s.userId || s.guestId));
    if (humans.length < MIN_PLAYERS && !r.fillBots) {
      return { error: `Cần ít nhất ${MIN_PLAYERS} người` };
    }

    if (r.fillBots) {
      for (let i = 1; i < r.playerCount; i++) {
        const s = r.seats[i]!;
        if (!s.userId && !s.guestId) {
          s.isBot = true;
          s.connected = true;
          s.displayName = BOT_NAMES[i - 1] ?? `Bot ${i + 1}`;
        }
      }
    }

    const out = this.beginGame(r);
    if ("error" in out) return out;
    this.save();
    return this.publicView(r, opts);
  }

  private beginGame(r: RoomInternal): { ok: true } | { error: string } {
    const stake = Math.max(0, Math.floor(r.stake || 0));
    const humans = r.seats
      .slice(0, r.playerCount)
      .filter((p) => !p.isBot && p.userId);
    r.stakesPaid = {};
    r.pot = 0;

    if (stake > 0) {
      for (const p of humans) {
        const uid = p.userId!;
        const user = authStore.getById?.(uid);
        const bal = user?.balance ?? 0;
        if (bal < stake) {
          return { error: `${p.displayName} không đủ ${stake} xu chơi` };
        }
      }
      for (const p of humans) {
        const uid = p.userId!;
        const adj = authStore.adjustBalance(uid, -stake, {
          lane: "play",
          reason: `uno_stake:${r.roomId}`,
          gameId: "uno",
        });
        if (!adj.ok) {
          for (const [paidId, amt] of Object.entries(r.stakesPaid)) {
            authStore.adjustBalance(paidId, amt, {
              lane: "play",
              reason: `uno_stake_refund:${r.roomId}`,
              gameId: "uno",
            });
          }
          r.stakesPaid = {};
          return { error: adj.reason };
        }
        r.stakesPaid[uid] = stake;
        r.pot += stake;
      }
    }

    const deal = dealGame(r.playerCount);
    if ("error" in deal) return { error: deal.error };

    r.hands = deal.hands;
    r.drawPile = deal.drawPile;
    r.discardPile = deal.discardPile;
    r.activeColor = deal.activeColor;
    r.direction = deal.direction;
    r.turnSeat = 0;
    r.pendingDraw = 0;
    r.status = "playing";
    r.phase = "play";
    r.winnerSeat = null;
    r.settled = false;
    r.moveSeq = 0;
    r.lastDrawn = [];
    r.colorChooserSeat = null;
    r.unoRiskSeat = null;
    r.unoRiskUntil = 0;
    for (const s of r.seats) s.saidUno = false;

    r.deckCount = deal.deckCount;

    const top = r.discardPile[r.discardPile.length - 1];
    if (top?.value === "skip") {
      r.turnSeat = 1 % r.playerCount;
      r.lastEvent = "Lá đầu Skip — ghế 2 đi";
    } else if (top?.value === "reverse" && r.playerCount > 2) {
      r.direction = -1;
      r.lastEvent = "Lá đầu Reverse — ngược chiều";
    } else if (top?.value === "draw2") {
      r.pendingDraw = 2;
      r.turnSeat = 1 % r.playerCount;
      r.lastEvent = "Lá đầu +2 — ghế 2 bị phạt";
    } else if (top?.value === "wild" || top?.color === "wild") {
      r.activeColor = seatColor(0);
    }

    r.turnDeadline = now() + TURN_MS;
    r.lastEvent =
      stake > 0
        ? `Bắt đầu HueRush — cược ${stake} · hũ ${r.pot} xu`
        : `Bắt đầu HueRush ${r.playerCount} người — ghế 1 đi trước`;
    r.updatedAt = now();
    return { ok: true };
  }

  playCard(
    roomId: string,
    cardId: string,
    chosenColor: UnoColor | undefined,
    opts: { userId?: string | null; guestId?: string | null; auto?: boolean },
  ): UnoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status !== "playing") return { error: "Ván chưa chơi / đã xong" };
    this.maybeResolveUnoRisk(r);

    const finishingColorChoice =
      r.phase === "choose_color" &&
      !!chosenColor &&
      (cardId === r.pendingWildCardId || opts.auto);

    if (r.phase === "choose_color" && !finishingColorChoice) {
      return { error: "Chọn màu trước" };
    }
    if (r.phase !== "play" && r.phase !== "choose_color") {
      return { error: "Không thể đánh lúc này" };
    }

    const p = r.seats[r.turnSeat];
    if (!p) return { error: "Không có người chơi" };
    if (!opts.auto && !this.actorOwns(p, opts)) {
      return { error: "Không phải lượt của bạn" };
    }

    const top = r.discardPile[r.discardPile.length - 1];
    if (!top) return { error: "Chưa có lá úp" };

    const hand = r.hands[r.turnSeat] ?? [];
    const card = hand.find((c) => c.id === cardId);
    if (!card) return { error: "Không có lá này" };

    if (card.color === "wild" && !chosenColor && !opts.auto) {
      r.phase = "choose_color";
      r.colorChooserSeat = r.turnSeat;
      r.pendingWildCardId = cardId;
      r.lastEvent = `${p.displayName} chơi Wild — chọn màu`;
      r.updatedAt = now();
      this.save();
      return this.publicView(r, opts);
    }

    // Clear choose_color gate before applying the wild play
    if (finishingColorChoice) {
      r.phase = "play";
    }

    const result = applyPlay(
      {
        hands: r.hands,
        drawPile: r.drawPile,
        discardPile: r.discardPile,
        activeColor: r.activeColor,
        direction: r.direction,
        turnSeat: r.turnSeat,
        playerCount: r.playerCount,
        pendingDraw: r.pendingDraw,
      },
      cardId,
      chosenColor ?? (opts.auto ? seatColor(r.turnSeat) : undefined),
    );
    if ("error" in result) {
      if (finishingColorChoice) {
        r.phase = "choose_color";
      }
      return { error: result.error };
    }

    const playedSeat = r.turnSeat;
    r.hands = result.hands;
    r.drawPile = result.drawPile;
    r.discardPile = result.discardPile;
    r.activeColor = result.activeColor;
    r.direction = result.direction;
    r.pendingDraw = result.pendingDraw;
    r.lastDrawn = [];
    r.moveSeq += 1;
    r.lastEvent = result.event;
    r.colorChooserSeat = null;
    r.pendingWildCardId = null;
    r.phase = "play";

    const remaining = r.hands[playedSeat]?.length ?? 0;
    if (remaining === 1) {
      if (opts.auto || p.isBot) {
        p.saidUno = true;
      } else if (!p.saidUno) {
        r.unoRiskSeat = playedSeat;
        r.unoRiskUntil = now() + UNO_CATCH_MS;
      }
    }
    if (remaining > 1) p.saidUno = false;

    if (result.winnerSeat != null) {
      r.winnerSeat = result.winnerSeat;
      this.finishGame(r, `${p.displayName} hết bài — Rush!`);
      this.save();
      return this.publicView(r, opts);
    }

    r.turnSeat = result.nextSeat;
    r.turnDeadline = now() + TURN_MS;
    r.updatedAt = now();
    this.save();
    return this.publicView(r, opts);
  }

  chooseColor(
    roomId: string,
    color: UnoColor,
    opts: { userId?: string | null; guestId?: string | null },
  ): UnoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.phase !== "choose_color") return { error: "Không cần chọn màu" };
    const seat = r.colorChooserSeat;
    if (seat == null) return { error: "Không có người chọn màu" };
    const p = r.seats[seat];
    if (!p || !this.actorOwns(p, opts)) {
      return { error: "Không phải lượt của bạn" };
    }

    const hand = r.hands[seat] ?? [];
    const wildId = r.pendingWildCardId;
    const wild = wildId
      ? hand.find((c) => c.id === wildId)
      : hand.find((c) => c.color === "wild");
    if (!wild) {
      return { error: "Không tìm thấy lá Wild trên tay" };
    }

    return this.playCard(r.roomId, wild.id, color, { ...opts });
  }

  drawCard(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null; auto?: boolean },
  ): UnoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status !== "playing" || r.phase !== "play") {
      return { error: "Không thể rút bài lúc này" };
    }
    this.maybeResolveUnoRisk(r);

    const p = r.seats[r.turnSeat];
    if (!p) return { error: "Không có người chơi" };
    if (!opts.auto && !this.actorOwns(p, opts)) {
      return { error: "Không phải lượt của bạn" };
    }

    const result = applyDraw({
      hands: r.hands,
      drawPile: r.drawPile,
      discardPile: r.discardPile,
      activeColor: r.activeColor,
      turnSeat: r.turnSeat,
      playerCount: r.playerCount,
      direction: r.direction,
      pendingDraw: r.pendingDraw,
    });
    if ("error" in result) return { error: result.error };

    r.hands = result.hands;
    r.drawPile = result.drawPile;
    r.discardPile = result.discardPile;
    r.pendingDraw = 0;
    r.lastDrawn = result.drawn;
    r.moveSeq += 1;
    r.lastEvent = result.event;
    r.turnSeat = result.nextSeat;
    r.turnDeadline = now() + TURN_MS;
    r.updatedAt = now();
    this.save();
    return this.publicView(r, opts);
  }

  callUno(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): UnoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    const seat = this.findActorSeat(r, opts);
    if (seat == null) return { error: "Bạn không trong phòng" };
    const p = r.seats[seat];
    if (!p) return { error: "Ghế không hợp lệ" };
    const count = r.hands[seat]?.length ?? 0;
    if (count !== 1 && count !== 2) {
      return { error: "Gọi Rush khi còn 1–2 lá" };
    }
    p.saidUno = true;
    if (r.unoRiskSeat === seat) {
      r.unoRiskSeat = null;
      r.unoRiskUntil = 0;
    }
    r.lastEvent = `${p.displayName} gọi Rush!`;
    r.updatedAt = now();
    this.save();
    return this.publicView(r, opts);
  }

  catchUno(
    roomId: string,
    targetSeat: number,
    opts: { userId?: string | null; guestId?: string | null },
  ): UnoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status !== "playing") return { error: "Ván không chơi" };
    const catcher = this.findActorSeat(r, opts);
    if (catcher == null) return { error: "Bạn không trong phòng" };
    const target = Math.floor(targetSeat);
    if (target === catcher) return { error: "Không bắt chính mình" };
    if (r.unoRiskSeat !== target) {
      return { error: "Không ai bị bắt Rush lúc này" };
    }
    if (now() > r.unoRiskUntil) {
      return { error: "Hết thời gian bắt Rush" };
    }
    const p = r.seats[target];
    if (!p || p.saidUno || (r.hands[target]?.length ?? 0) !== 1) {
      return { error: "Người này không bị phạt" };
    }
    const catcherName = r.seats[catcher]?.displayName ?? "?";
    const pen = applyUnoForgotPenalty(
      {
        hands: r.hands,
        drawPile: r.drawPile,
        discardPile: r.discardPile,
      },
      target,
    );
    r.hands = pen.hands;
    r.drawPile = pen.drawPile;
    r.discardPile = pen.discardPile;
    r.moveSeq += 1;
    r.lastEvent = `${catcherName} bắt ${p.displayName} quên Rush — +${pen.drawn} lá`;
    r.unoRiskSeat = null;
    r.unoRiskUntil = 0;
    p.saidUno = false;
    r.updatedAt = now();
    this.save();
    return this.publicView(r, opts);
  }

  private maybeResolveUnoRisk(r: RoomInternal): boolean {
    if (r.unoRiskSeat == null) return false;
    if (now() < r.unoRiskUntil) return false;
    const seat = r.unoRiskSeat;
    const p = r.seats[seat];
    if (!p || p.saidUno || (r.hands[seat]?.length ?? 0) !== 1) {
      r.unoRiskSeat = null;
      r.unoRiskUntil = 0;
      return false;
    }
    const pen = applyUnoForgotPenalty(
      {
        hands: r.hands,
        drawPile: r.drawPile,
        discardPile: r.discardPile,
      },
      seat,
    );
    r.hands = pen.hands;
    r.drawPile = pen.drawPile;
    r.discardPile = pen.discardPile;
    r.moveSeq += 1;
    r.lastEvent = `${p.displayName} quên Rush — phạt +${pen.drawn} lá`;
    r.unoRiskSeat = null;
    r.unoRiskUntil = 0;
    p.saidUno = false;
    r.updatedAt = now();
    return true;
  }

  private finishGame(r: RoomInternal, reason: string) {
    if (r.status === "finished") return;
    r.status = "finished";
    r.phase = "finished";
    if (r.winnerSeat == null) r.winnerSeat = r.turnSeat;
    r.turnDeadline = now();
    r.lastEvent = reason;
    this.settle(r);
    r.updatedAt = now();
  }

  private settle(r: RoomInternal) {
    if (r.settled) return;
    r.settled = true;
    const stake = Math.max(0, Math.floor(r.stake || 0));
    const winner =
      r.winnerSeat != null ? r.seats[r.winnerSeat] ?? null : null;
    const humans = r.seats.filter((p) => !p.isBot && p.userId);

    if (stake <= 0) {
      r.lastEvent = `${winner?.displayName ?? "?"} thắng HueRush!`;
      return;
    }

    if (winner && !winner.isBot && winner.userId) {
      let payout = r.pot || 0;
      if (humans.length <= 1) {
        payout = Math.floor(stake * BOT_WIN_MULT);
      }
      const adj = authStore.adjustBalance(winner.userId, payout, {
        lane: "play",
        reason: `uno_win:${r.roomId}`,
        gameId: "uno",
      });
      r.lastEvent = adj.ok
        ? `${winner.displayName} thắng HueRush! +${payout} xu`
        : `${winner.displayName} thắng! (lỗi cộng xu)`;
      r.pot = 0;
      return;
    }

    r.pot = 0;
    r.lastEvent = `${winner?.displayName ?? "Bot"} thắng — bạn mất cược`;
  }

  private actorOwns(
    p: UnoPlayer,
    opts: { userId?: string | null; guestId?: string | null },
  ): boolean {
    if (p.isBot) return false;
    if (opts.userId && p.userId === opts.userId) return true;
    if (opts.guestId && p.guestId === opts.guestId) return true;
    return false;
  }

  reconnect(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): UnoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    const p = r.seats.find(
      (s) =>
        (opts.userId && s.userId === opts.userId) ||
        (opts.guestId && s.guestId === opts.guestId),
    );
    if (!p) return { error: "Bạn không trong phòng" };
    p.connected = true;
    r.updatedAt = now();
    this.save();
    return this.publicView(r, opts);
  }

  private ensureTurnClock(r: RoomInternal) {
    if (r.status !== "playing") return;
    if (now() < r.turnDeadline) return;
    this.handleTimeout(r);
  }

  private handleTimeout(r: RoomInternal) {
    if (r.status !== "playing") return;
    const p = r.seats[r.turnSeat];
    if (!p) return;

    if (r.phase === "choose_color") {
      const col = seatColor(r.turnSeat);
      const hand = r.hands[r.turnSeat] ?? [];
      const wildId = r.pendingWildCardId;
      const wild = wildId
        ? hand.find((c) => c.id === wildId)
        : hand.find((c) => c.color === "wild");
      if (wild) {
        this.playCard(r.roomId, wild.id, col, { auto: true });
      }
      return;
    }

    const top = r.discardPile[r.discardPile.length - 1];
    if (!top) return;

    const pick = pickBotCard(
      r.hands[r.turnSeat] ?? [],
      top,
      r.activeColor,
      r.pendingDraw,
    );

    if (pick) {
      if (!p.isBot) {
        p.strikes += 1;
        r.lastEvent = `${p.displayName} hết giờ — máy đánh`;
        if (p.strikes >= MAX_STRIKES) {
          p.isBot = true;
          p.displayName = `Bot ghế ${p.seat + 1}`;
          p.userId = null;
          p.guestId = null;
        }
      }
      this.playCard(r.roomId, pick.card.id, pick.chosenColor, {
        auto: true,
      });
      return;
    }

    if (!p.isBot) {
      p.strikes += 1;
      r.lastEvent = `${p.displayName} hết giờ — rút bài`;
    }
    this.drawCard(r.roomId, { auto: true });
  }

  private tickAll() {
    for (const r of this.rooms.values()) {
      if (r.status !== "playing") continue;
      if (this.maybeResolveUnoRisk(r)) {
        this.save();
        continue;
      }
      if (now() >= r.turnDeadline) {
        this.handleTimeout(r);
        continue;
      }
      const p = r.seats[r.turnSeat];
      if (!p?.isBot || now() <= r.updatedAt + 900) continue;

      if (r.phase === "choose_color") {
        const col = seatColor(r.turnSeat);
        const hand = r.hands[r.turnSeat] ?? [];
        const wild = hand.find((c) => c.color === "wild");
        if (wild) {
          this.playCard(r.roomId, wild.id, col, { auto: true });
        }
        continue;
      }

      const top = r.discardPile[r.discardPile.length - 1];
      if (!top) continue;
      const pick = pickBotCard(
        r.hands[r.turnSeat] ?? [],
        top,
        r.activeColor,
        r.pendingDraw,
      );
      if (pick) {
        this.playCard(r.roomId, pick.card.id, pick.chosenColor, {
          auto: true,
        });
      } else {
        this.drawCard(r.roomId, { auto: true });
      }
    }
  }
}

export const unoRoomStore = new UnoRoomStore();
