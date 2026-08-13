import { randomBytes, randomInt } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { authStore } from "./auth.js";
import { DEFAULT_AVATAR, normalizeAvatar } from "./avatars.js";
import {
  applyMove,
  colorFinished,
  createTokens,
  earnsExtraTurn,
  LUDO_COLORS,
  normalizeLudoDiceMode,
  normalizeLudoThemeId,
  type LudoDiceMode,
  type LudoPlayer,
  type LudoPublicState,
  type LudoThemeId,
  pickAutoToken,
  validTokenIds,
} from "./ludoEngine.js";
import {
  LUDO_BOT_WIN_MULT,
  ludoDecorStore,
} from "./ludoDecorStore.js";
import { ludoEconomyStore } from "./ludoEconomyStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "ludo-rooms.json");
const TMP = join(DATA_DIR, "ludo-rooms.json.tmp");

const TURN_MS = 15_000;
const MAX_STRIKES = 3;
const BOT_NAMES = ["Bot Ruby", "Bot Jade", "Bot Gold", "Bot Azure"];

type RoomInternal = LudoPublicState & {
  updatedAt: number;
  stakesPaid?: Record<string, number>;
  /** Accrue extra turn while resolving dual-dice pending faces. */
  turnExtra?: boolean;
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

function identityFromUser(userId: string | null | undefined): {
  avatar: string;
  avatarFrame: string | null;
  pawnDecorId: string | null;
} {
  if (!userId) {
    return {
      avatar: DEFAULT_AVATAR,
      avatarFrame: "frame-classic",
      pawnDecorId: "pawn-classic",
    };
  }
  const u = authStore.getById?.(userId) ?? null;
  const snap = ludoDecorStore.ensureUser(userId);
  return {
    avatar: normalizeAvatar(u?.avatar),
    avatarFrame: snap.equippedFrame,
    pawnDecorId: snap.equippedPawn,
  };
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
        if (r?.roomId) {
          r.pot = typeof r.pot === "number" ? r.pot : 0;
          r.settled = !!r.settled;
          r.lastDice = typeof r.lastDice === "number" ? r.lastDice : null;
          r.rollSeq = typeof r.rollSeq === "number" ? r.rollSeq : 0;
          r.lastRollSeat =
            typeof r.lastRollSeat === "number" ? r.lastRollSeat : null;
          r.diceMode = normalizeLudoDiceMode(r.diceMode);
          r.diceFaces = Array.isArray(r.diceFaces) ? r.diceFaces : [];
          r.lastDiceFaces = Array.isArray(r.lastDiceFaces)
            ? r.lastDiceFaces
            : [];
          r.pendingDice = Array.isArray(r.pendingDice) ? r.pendingDice : [];
          r.turnExtra = !!r.turnExtra;
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

  listOpen(): LudoPublicState[] {
    return [...this.rooms.values()]
      .filter((r) => r.status === "lobby")
      .map((r) => this.publicView(r));
  }

  /** Admin: all rooms (lobby/playing/finished), newest first. */
  listAdmin(limit = 60): (LudoPublicState & { updatedAt: number })[] {
    return [...this.rooms.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, Math.min(200, limit)))
      .map((r) => ({ ...this.publicView(r), updatedAt: r.updatedAt }));
  }

  /** Admin force-close — settle unfinished pot stays (no payout if unsettled). */
  adminClose(roomId: string): LudoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không tìm thấy phòng" };
    if (r.status === "finished") return this.publicView(r);
    r.status = "finished";
    r.phase = "finished";
    r.lastEvent = "Admin đóng phòng";
    r.turnDeadline = now();
    r.updatedAt = now();
    this.save();
    return this.publicView(r);
  }

  get(roomId: string): LudoPublicState | null {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return null;
    this.ensureTurnClock(r);
    return this.publicView(r);
  }

  private publicView(r: RoomInternal): LudoPublicState {
    const { updatedAt: _, stakesPaid: __, turnExtra: ___, ...rest } = r;
    const pendingMoves = this.buildPendingMoves(r);
    return {
      ...rest,
      pot: r.pot ?? 0,
      settled: !!r.settled,
      themeId: normalizeLudoThemeId(r.themeId),
      diceMode: normalizeLudoDiceMode(r.diceMode),
      lastDice: typeof r.lastDice === "number" ? r.lastDice : null,
      diceFaces: Array.isArray(r.diceFaces) ? r.diceFaces.map(Number) : [],
      lastDiceFaces: Array.isArray(r.lastDiceFaces)
        ? r.lastDiceFaces.map(Number)
        : [],
      pendingDice: Array.isArray(r.pendingDice)
        ? r.pendingDice.map(Number)
        : [],
      pendingMoves,
      rollSeq: typeof r.rollSeq === "number" ? r.rollSeq : 0,
      lastRollSeat:
        typeof r.lastRollSeat === "number" ? r.lastRollSeat : null,
      tokens: r.tokens.map((t) => ({ ...t })),
      players: r.players.map((p) => ({ ...p })),
    };
  }

  private buildPendingMoves(r: RoomInternal): {
    dieIndex: number;
    face: number;
    tokenIds: string[];
  }[] {
    if (r.phase !== "wait_pick" || !r.pendingDice?.length) return [];
    const p = this.currentPlayer(r);
    return r.pendingDice
      .map((face, dieIndex) => ({
        dieIndex,
        face,
        tokenIds: validTokenIds(r.tokens, p.color, face),
      }))
      .filter((m) => m.tokenIds.length > 0);
  }

  createRoom(opts: {
    userId?: string | null;
    guestId?: string | null;
    displayName: string;
    stake?: number;
    fillBots?: boolean;
    autoStart?: boolean;
    themeId?: LudoThemeId | string;
    diceMode?: LudoDiceMode | number;
  }): LudoPublicState {
    const roomId = rid();
    const stake = Math.max(0, Math.floor(opts.stake ?? 0));
    const themeId = normalizeLudoThemeId(opts.themeId);
    const diceMode = normalizeLudoDiceMode(opts.diceMode);
    const fillBots = opts.fillBots !== false;
    const autoStart = opts.autoStart !== false && fillBots;
    const id = identityFromUser(opts.userId);

    const players: LudoPlayer[] = LUDO_COLORS.map((color, seat) => ({
      seat,
      color,
      userId: null,
      guestId: null,
      displayName: `Ghế ${color}`,
      isBot: true,
      strikes: 0,
      connected: false,
      avatar: DEFAULT_AVATAR,
      avatarFrame: null,
      pawnDecorId: null,
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
      avatar: id.avatar,
      avatarFrame: id.avatarFrame,
      pawnDecorId: id.pawnDecorId,
    };

    if (fillBots) {
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
          avatar: DEFAULT_AVATAR,
          avatarFrame: null,
          pawnDecorId: null,
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
      lastDice: null,
      diceFaces: [],
      lastDiceFaces: [],
      pendingDice: [],
      pendingMoves: [],
      diceMode,
      rollSeq: 0,
      lastRollSeat: null,
      validTokenIds: [],
      consecutiveSixes: 0,
      turnDeadline: now() + TURN_MS,
      winnerSeat: null,
      lastEvent: autoStart
        ? `Phòng tạo — ${diceMode === 2 ? "2 xúc xắc" : "1 xúc xắc"}`
        : "Phòng chờ — mời bạn bè / Bắt đầu",
      stake,
      pot: 0,
      settled: false,
      themeId,
      hostUserId: opts.userId ?? null,
      stakesPaid: {},
      turnExtra: false,
      updatedAt: now(),
    };

    this.rooms.set(roomId, room);
    if (autoStart) {
      const started = this.beginGame(room, { fillRemainingBots: false });
      if ("error" in started) {
        room.lastEvent = started.error;
      }
    }
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

    const id = identityFromUser(opts.userId);
    const existing = r.players.find(
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
      existing.avatar = id.avatar;
      existing.avatarFrame = id.avatarFrame;
      existing.pawnDecorId = id.pawnDecorId;
      r.updatedAt = now();
      this.save();
      return this.publicView(r);
    }

    if (r.status === "playing") {
      const seat = r.players.find((p) => p.isBot || !p.connected);
      if (!seat) return { error: "Phòng đầy" };
      seat.userId = opts.userId ?? null;
      seat.guestId = opts.guestId ?? null;
      seat.displayName = opts.displayName.slice(0, 24) || "Bạn";
      seat.isBot = false;
      seat.connected = true;
      seat.strikes = 0;
      seat.avatar = id.avatar;
      seat.avatarFrame = id.avatarFrame;
      seat.pawnDecorId = id.pawnDecorId;
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
    seat.avatar = id.avatar;
    seat.avatarFrame = id.avatarFrame;
    seat.pawnDecorId = id.pawnDecorId;
    r.lastEvent = `${seat.displayName} vào ghế ${seat.color}`;
    r.updatedAt = now();
    this.save();
    return this.publicView(r);
  }

  startRoom(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): LudoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status !== "lobby") return { error: "Ván đã bắt đầu" };
    const hostOk =
      (opts.userId && r.hostUserId && opts.userId === r.hostUserId) ||
      (opts.userId && r.players[0]?.userId === opts.userId) ||
      (opts.guestId && r.players[0]?.guestId === opts.guestId);
    if (!hostOk) return { error: "Chỉ chủ phòng được bắt đầu" };
    const out = this.beginGame(r, { fillRemainingBots: true });
    if ("error" in out) return out;
    this.save();
    return this.publicView(r);
  }

  /** Refresh cosmetics for a seated user from decor store. */
  syncPlayerDecor(
    roomId: string,
    userId: string,
  ): LudoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    const p = r.players.find((x) => x.userId === userId);
    if (!p) return { error: "Bạn không trong phòng" };
    const id = identityFromUser(userId);
    p.avatar = id.avatar;
    p.avatarFrame = id.avatarFrame;
    p.pawnDecorId = id.pawnDecorId;
    r.updatedAt = now();
    this.save();
    return this.publicView(r);
  }

  private beginGame(
    r: RoomInternal,
    opts: { fillRemainingBots: boolean },
  ): { ok: true } | { error: string } {
    if (opts.fillRemainingBots) {
      for (let i = 0; i < 4; i++) {
        const p = r.players[i]!;
        if (!p.connected && p.isBot) {
          p.displayName = BOT_NAMES[i]!;
          p.connected = true;
          p.isBot = true;
          p.userId = null;
          p.guestId = null;
        } else if (!p.userId && !p.guestId) {
          p.isBot = true;
          p.connected = true;
          p.displayName = BOT_NAMES[i]!;
        }
      }
    }

    const stake = Math.max(0, Math.floor(r.stake || 0));
    const humans = r.players.filter((p) => !p.isBot && p.userId);
    r.stakesPaid = {};
    r.pot = 0;
    r.settled = false;

    if (stake > 0) {
      for (const p of humans) {
        const uid = p.userId!;
        const user = authStore.getById?.(uid);
        const bal = user?.balance ?? 0;
        if (bal < stake) {
          return {
            error: `${p.displayName} không đủ ${stake} xu chơi`,
          };
        }
      }
      for (const p of humans) {
        const uid = p.userId!;
        const adj = authStore.adjustBalance(uid, -stake, {
          lane: "play",
          reason: `ludo_stake:${r.roomId}`,
        });
        if (!adj.ok) {
          for (const [paidId, amt] of Object.entries(r.stakesPaid)) {
            authStore.adjustBalance(paidId, amt, {
              lane: "play",
              reason: `ludo_stake_refund:${r.roomId}`,
            });
          }
          r.stakesPaid = {};
          return { error: adj.reason };
        }
        r.stakesPaid[uid] = stake;
        r.pot += stake;
      }
    }

    r.status = "playing";
    r.tokens = createTokens();
    r.turnSeat = 0;
    r.phase = "wait_roll";
    r.dice = null;
    r.diceFaces = [];
    r.pendingDice = [];
    r.turnExtra = false;
    r.validTokenIds = [];
    r.consecutiveSixes = 0;
    r.turnDeadline = now() + TURN_MS;
    r.winnerSeat = null;
    r.lastEvent =
      stake > 0
        ? `Bắt đầu — cược ${stake} · hũ ${r.pot} xu · ${
            r.diceMode === 2 ? "2 xúc xắc" : "1 xúc xắc"
          }`
        : `Bắt đầu — Đỏ tung trước · ${
            r.diceMode === 2 ? "2 xúc xắc" : "1 xúc xắc"
          }`;
    r.updatedAt = now();
    return { ok: true };
  }

  private settle(r: RoomInternal) {
    if (r.settled) return;
    r.settled = true;
    const stake = Math.max(0, Math.floor(r.stake || 0));
    const winner =
      r.winnerSeat != null ? r.players[r.winnerSeat] ?? null : null;
    const humans = r.players.filter((p) => !p.isBot && p.userId);
    const humanCount = humans.length;

    if (stake <= 0) {
      r.lastEvent = `${winner?.displayName ?? "?"} thắng!`;
      return;
    }

    if (winner && !winner.isBot && winner.userId) {
      let payout = r.pot || 0;
      if (humanCount <= 1) {
        payout = stake * ludoEconomyStore.botWinMult();
      }
      const adj = authStore.adjustBalance(winner.userId, payout, {
        lane: "play",
        reason: `ludo_win:${r.roomId}`,
      });
      if (adj.ok) {
        r.lastEvent = `${winner.displayName} thắng! +${payout} xu`;
      } else {
        r.lastEvent = `${winner.displayName} thắng! (lỗi cộng xu)`;
      }
      r.pot = 0;
      return;
    }

    // Bot thắng — human đã mất stake lúc start (không hoàn)
    r.pot = 0;
    r.lastEvent = `${winner?.displayName ?? "Bot"} thắng — bạn mất cược`;
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
    if (!p.isBot && !this.actorOwns(p, opts)) {
      return { error: "Không phải lượt bạn" };
    }

    const mode = normalizeLudoDiceMode(r.diceMode);
    r.diceMode = mode;
    const faces =
      mode === 2 ? [rollDie(), rollDie()] : [rollDie()];
    r.diceFaces = faces;
    r.lastDiceFaces = [...faces];
    r.rollSeq = (r.rollSeq || 0) + 1;
    r.lastRollSeat = p.seat;
    r.turnExtra = false;
    r.lastDice = faces[0]!;
    r.lastEvent =
      mode === 2
        ? `${p.displayName} tung ${faces[0]} · ${faces[1]}`
        : `${p.displayName} tung ${faces[0]}`;

    const sixCount = faces.filter((f) => f === 6).length;
    if (sixCount > 0) {
      r.consecutiveSixes += sixCount;
      if (r.consecutiveSixes >= 3) {
        r.lastEvent = `${p.displayName} tung 6 liên tiếp — mất lượt`;
        r.consecutiveSixes = 0;
        r.dice = null;
        r.pendingDice = [];
        r.validTokenIds = [];
        this.advanceTurn(r);
        this.save();
        return this.publicView(r);
      }
    } else {
      r.consecutiveSixes = 0;
    }

    const usable = faces.filter(
      (f) => validTokenIds(r.tokens, p.color, f).length > 0,
    );
    if (usable.length === 0) {
      r.lastEvent += " · không đi được — bỏ lượt";
      r.dice = null;
      r.pendingDice = [];
      r.validTokenIds = [];
      this.advanceTurn(r);
      this.save();
      return this.publicView(r);
    }

    r.pendingDice = [...usable];
    this.refreshValidForPending(r, p.color);
    r.phase = "wait_pick";
    r.turnDeadline = now() + TURN_MS;
    r.updatedAt = now();
    this.save();
    return this.publicView(r);
  }

  pick(
    roomId: string,
    tokenId: string,
    opts: {
      userId?: string | null;
      guestId?: string | null;
      dieIndex?: number | null;
    },
  ): LudoPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r || r.status !== "playing") return { error: "Không chơi được" };
    this.ensureTurnClock(r);
    const p = this.currentPlayer(r);
    if (r.phase !== "wait_pick") {
      return { error: "Chưa chọn được quân" };
    }
    if (!p.isBot && !this.actorOwns(p, opts)) {
      return { error: "Không phải lượt bạn" };
    }

    if (
      !p.isBot &&
      normalizeLudoDiceMode(r.diceMode) === 2 &&
      r.pendingDice.length > 1 &&
      (opts.dieIndex == null || !Number.isInteger(opts.dieIndex))
    ) {
      return { error: "Chọn xúc xắc trước" };
    }

    if (
      !this.preparePickFace(r, p.color, tokenId, opts.dieIndex ?? null)
    ) {
      return { error: "Quân không hợp lệ" };
    }
    return this.executePick(r, tokenId, { auto: false });
  }

  /** Pick which pending face to spend for this token; leave it at pendingDice[0]. */
  private preparePickFace(
    r: RoomInternal,
    color: LudoPlayer["color"],
    tokenId: string,
    dieIndex: number | null,
  ): boolean {
    let spendIx = -1;
    if (
      dieIndex != null &&
      Number.isInteger(dieIndex) &&
      dieIndex >= 0 &&
      dieIndex < r.pendingDice.length
    ) {
      const face = r.pendingDice[dieIndex]!;
      if (validTokenIds(r.tokens, color, face).includes(tokenId)) {
        spendIx = dieIndex;
      }
    }
    if (spendIx < 0) {
      for (let i = 0; i < r.pendingDice.length; i++) {
        const face = r.pendingDice[i]!;
        if (validTokenIds(r.tokens, color, face).includes(tokenId)) {
          spendIx = i;
          break;
        }
      }
    }
    if (spendIx < 0) return false;
    const chosen = r.pendingDice[spendIx]!;
    r.dice = chosen;
    r.lastDice = chosen;
    r.pendingDice = [
      chosen,
      ...r.pendingDice.filter((_, i) => i !== spendIx),
    ];
    return true;
  }

  /** Highlight any pawn movable with any remaining face; dice = preferred face. */
  private refreshValidForPending(
    r: RoomInternal,
    color: LudoPlayer["color"],
  ): boolean {
    const union = new Set<string>();
    const kept: number[] = [];
    for (const face of r.pendingDice) {
      const ids = validTokenIds(r.tokens, color, face);
      if (ids.length === 0) continue;
      kept.push(face);
      for (const id of ids) union.add(id);
    }
    r.pendingDice = kept;
    r.validTokenIds = [...union];
    if (kept.length === 0) {
      r.dice = null;
      return false;
    }
    r.dice = kept[0]!;
    r.lastDice = kept[0]!;
    return true;
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
      r.pendingDice = [];
      r.validTokenIds = [];
      r.turnExtra = false;
      this.advanceTurn(r);
      this.save();
      return this.publicView(r);
    }

    r.tokens = moved.tokens;
    p.strikes = 0;
    /* Consume the face just played */
    if (r.pendingDice[0] === dice) r.pendingDice.shift();
    else {
      const ix = r.pendingDice.indexOf(dice);
      if (ix >= 0) r.pendingDice.splice(ix, 1);
    }

    r.lastEvent = `${p.displayName} đi ${dice} → ${moved.dest}${
      moved.captured ? " · ăn quân" : ""
    }${moved.enteredHome ? " · về đích" : ""}`;

    if (earnsExtraTurn(dice, moved.captured, moved.enteredHome)) {
      r.turnExtra = true;
    }

    if (colorFinished(r.tokens, p.color)) {
      r.status = "finished";
      r.winnerSeat = p.seat;
      r.phase = "finished";
      r.dice = null;
      r.pendingDice = [];
      r.validTokenIds = [];
      r.turnExtra = false;
      this.settle(r);
      r.updatedAt = now();
      this.save();
      return this.publicView(r);
    }

    /* More faces left in dual-dice mode */
    if (this.refreshValidForPending(r, p.color)) {
      r.phase = "wait_pick";
      r.turnDeadline = now() + TURN_MS;
      r.lastEvent += ` · còn xúc ${r.pendingDice.join("·")}`;
      r.updatedAt = now();
      this.save();
      return this.publicView(r);
    }

    r.dice = null;
    r.pendingDice = [];
    r.validTokenIds = [];
    if (r.turnExtra) {
      r.turnExtra = false;
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
    r.pendingDice = [];
    r.validTokenIds = [];
    r.turnExtra = false;
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
    if (r.phase === "wait_pick" && r.pendingDice.length) {
      const pick = pickAutoToken(r.validTokenIds);
      if (pick && this.preparePickFace(r, p.color, pick, null)) {
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
      if (p.isBot && r.phase === "wait_roll" && now() > r.updatedAt + 700) {
        this.roll(r.roomId, {});
        dirty = true;
      } else if (
        p.isBot &&
        r.phase === "wait_pick" &&
        r.validTokenIds.length &&
        now() > r.updatedAt + 900
      ) {
        const pick = pickAutoToken(r.validTokenIds);
        if (pick && this.preparePickFace(r, p.color, pick, null)) {
          this.executePick(r, pick, { auto: true });
        }
        dirty = true;
      } else if (
        !p.isBot &&
        r.phase === "wait_pick" &&
        r.validTokenIds.length === 1 &&
        r.pendingDice.length <= 1 &&
        now() > r.updatedAt + 850
      ) {
        /* Auto-move sole legal pawn after dice FX (single face only) */
        const tid = r.validTokenIds[0]!;
        if (this.preparePickFace(r, p.color, tid, null)) {
          this.executePick(r, tid, { auto: true });
        }
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
      r.updatedAt = now();
      this.save();
    }
    this.ensureTurnClock(r);
    return this.publicView(r);
  }
}

export const ludoRoomStore = new LudoRoomStore();
