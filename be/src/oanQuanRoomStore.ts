import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { authStore } from "./auth.js";
import { DEFAULT_AVATAR, normalizeAvatar } from "./avatars.js";
import {
  applyRedistribute,
  applySow,
  bothQuanCaptured,
  createInitialPits,
  finalizeScores,
  pickBotPit,
  quanRemaining,
  sideEmpty,
  validPitIndexes,
  winnerSeatFromScores,
  type OanPit,
  type OanSeat,
  type SowStep,
} from "./oanQuanEngine.js";
import { xuLevelsStore } from "./xuLevelsStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "oan-quan-rooms.json");
const TMP = join(DATA_DIR, "oan-quan-rooms.json.tmp");

const TURN_MS = 20_000;
const MAX_STRIKES = 3;
const BOT_WIN_MULT = 1.8;
const STAKE_PRESETS = [0, 500, 1000, 5000] as const;
const BOT_NAME = "Bot Quan";

export type OanPlayer = {
  seat: OanSeat;
  userId: string | null;
  guestId: string | null;
  displayName: string;
  isBot: boolean;
  strikes: number;
  connected: boolean;
  avatar?: string | null;
};

export type OanPublicState = {
  roomId: string;
  status: "lobby" | "playing" | "finished";
  seats: OanPlayer[];
  pits: OanPit[];
  scores: [number, number];
  turnSeat: OanSeat;
  validPitIndexes: number[];
  lastEvent: string | null;
  lastSteps: SowStep[];
  moveSeq: number;
  stake: number;
  pot: number;
  settled: boolean;
  winnerSeat: number | null;
  turnDeadline: number;
  vsBot: boolean;
  hostUserId?: string | null;
  hostGuestId?: string | null;
};

type RoomInternal = OanPublicState & {
  updatedAt: number;
  stakesPaid?: Record<string, number>;
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

class OanQuanRoomStore {
  private rooms = new Map<string, RoomInternal>();

  constructor() {
    this.load();
    setInterval(() => this.tickAll(), 500);
  }

  stakePresets(): number[] {
    const list = xuLevelsStore.forGame("oanQuan");
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
          r.lastSteps = Array.isArray(r.lastSteps) ? r.lastSteps : [];
          r.scores = [
            Number(r.scores?.[0] ?? 0),
            Number(r.scores?.[1] ?? 0),
          ];
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

  listOpen(): OanPublicState[] {
    return [...this.rooms.values()]
      .filter((r) => r.status === "lobby" && !r.vsBot)
      .map((r) => this.publicView(r));
  }

  listAdmin(limit = 60): (OanPublicState & { updatedAt: number })[] {
    return [...this.rooms.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, Math.min(200, limit)))
      .map((r) => ({ ...this.publicView(r), updatedAt: r.updatedAt }));
  }

  adminClose(roomId: string): OanPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không tìm thấy phòng" };
    if (r.status === "finished") return this.publicView(r);
    r.status = "finished";
    r.lastEvent = "Admin đóng phòng";
    r.turnDeadline = Date.now();
    r.updatedAt = Date.now();
    this.save();
    return this.publicView(r);
  }

  get(roomId: string): OanPublicState | null {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return null;
    this.ensureTurnClock(r);
    return this.publicView(r);
  }

  private publicView(r: RoomInternal): OanPublicState {
    const { updatedAt: _, stakesPaid: __, ...rest } = r;
    return {
      ...rest,
      pot: r.pot ?? 0,
      settled: !!r.settled,
      pits: r.pits.map((p) => ({ dan: p.dan, quan: p.quan })),
      seats: r.seats.map((s) => ({ ...s })),
      scores: [r.scores[0], r.scores[1]],
      lastSteps: Array.isArray(r.lastSteps) ? [...r.lastSteps] : [],
      validPitIndexes: [...(r.validPitIndexes ?? [])],
    };
  }

  createRoom(opts: {
    userId?: string | null;
    guestId?: string | null;
    displayName: string;
    stake?: number;
    vsBot?: boolean;
    autoStart?: boolean;
  }): OanPublicState | { error: string } {
    const stake = Math.max(0, Math.floor(opts.stake ?? 0));
    const vsBot = opts.vsBot !== false;
    const autoStart = opts.autoStart !== false && vsBot;

    const seats: OanPlayer[] = [
      {
        seat: 0,
        userId: opts.userId ?? null,
        guestId: opts.guestId ?? null,
        displayName: opts.displayName.slice(0, 24) || "Bạn",
        isBot: false,
        strikes: 0,
        connected: true,
        avatar: avatarFor(opts.userId),
      },
      {
        seat: 1,
        userId: null,
        guestId: null,
        displayName: vsBot ? BOT_NAME : "Chờ đối thủ",
        isBot: vsBot,
        strikes: 0,
        connected: vsBot,
        avatar: DEFAULT_AVATAR,
      },
    ];

    const room: RoomInternal = {
      roomId: rid(),
      status: "lobby",
      seats,
      pits: createInitialPits(),
      scores: [0, 0],
      turnSeat: 0,
      validPitIndexes: [],
      lastEvent: vsBot
        ? "Phòng vs bot — sẵn sàng"
        : "Phòng PvP — chờ người thứ hai",
      lastSteps: [],
      moveSeq: 0,
      stake,
      pot: 0,
      settled: false,
      winnerSeat: null,
      turnDeadline: now() + TURN_MS,
      vsBot,
      hostUserId: opts.userId ?? null,
      hostGuestId: opts.guestId ?? null,
      stakesPaid: {},
      updatedAt: now(),
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
    return this.publicView(room);
  }

  joinRoom(
    roomId: string,
    opts: {
      userId?: string | null;
      guestId?: string | null;
      displayName: string;
    },
  ): OanPublicState | { error: string } {
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
      return this.publicView(r);
    }

    // New joiner always takes seat 1
    if (r.vsBot && r.status !== "lobby") {
      return { error: "Phòng vs bot — không join thêm" };
    }
    const s1 = r.seats[1]!;
    if (!s1.isBot && s1.connected && (s1.userId || s1.guestId)) {
      return { error: "Phòng đầy" };
    }

    s1.userId = opts.userId ?? null;
    s1.guestId = opts.guestId ?? null;
    s1.displayName = opts.displayName.slice(0, 24) || "Bạn";
    s1.isBot = false;
    s1.connected = true;
    s1.strikes = 0;
    s1.avatar = avatarFor(opts.userId);
    r.vsBot = false;
    r.lastEvent = `${s1.displayName} vào ghế 2`;
    r.updatedAt = now();
    this.save();
    return this.publicView(r);
  }

  startRoom(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): OanPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status !== "lobby") return { error: "Ván đã bắt đầu" };
    const hostOk =
      (opts.userId && r.hostUserId && opts.userId === r.hostUserId) ||
      (opts.guestId && r.hostGuestId && opts.guestId === r.hostGuestId) ||
      (opts.userId && r.seats[0]?.userId === opts.userId) ||
      (opts.guestId && r.seats[0]?.guestId === opts.guestId);
    if (!hostOk) return { error: "Chỉ chủ phòng được bắt đầu" };

    const s1 = r.seats[1]!;
    if (!r.vsBot && (s1.isBot || (!s1.userId && !s1.guestId))) {
      return { error: "Cần đủ 2 người" };
    }
    if (r.vsBot) {
      s1.isBot = true;
      s1.connected = true;
      s1.displayName = BOT_NAME;
      s1.userId = null;
      s1.guestId = null;
    }

    const out = this.beginGame(r);
    if ("error" in out) return out;
    this.save();
    return this.publicView(r);
  }

  private beginGame(r: RoomInternal): { ok: true } | { error: string } {
    const stake = Math.max(0, Math.floor(r.stake || 0));
    const humans = r.seats.filter((p) => !p.isBot && p.userId);
    r.stakesPaid = {};
    r.pot = 0;
    r.settled = false;

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
          reason: `oan_quan_stake:${r.roomId}`,
          gameId: "oan-quan",
        });
        if (!adj.ok) {
          for (const [paidId, amt] of Object.entries(r.stakesPaid)) {
            authStore.adjustBalance(paidId, amt, {
              lane: "play",
              reason: `oan_quan_stake_refund:${r.roomId}`,
              gameId: "oan-quan",
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
    r.pits = createInitialPits();
    r.scores = [0, 0];
    r.turnSeat = 0;
    r.lastSteps = [];
    r.moveSeq = 0;
    r.winnerSeat = null;
    r.turnDeadline = now() + TURN_MS;
    this.refreshValid(r);
    this.ensureSideCanMove(r);
    r.lastEvent =
      stake > 0
        ? `Bắt đầu — cược ${stake} · hũ ${r.pot} xu`
        : "Bắt đầu — ghế 1 rải trước";
    r.updatedAt = now();
    return { ok: true };
  }

  private refreshValid(r: RoomInternal) {
    if (r.status !== "playing") {
      r.validPitIndexes = [];
      return;
    }
    r.validPitIndexes = validPitIndexes(r.pits, r.turnSeat);
  }

  /** If current seat empty but quan remain → redistribute from opponent score. */
  private ensureSideCanMove(r: RoomInternal): boolean {
    if (r.status !== "playing") return false;
    if (bothQuanCaptured(r.pits)) {
      this.finishGame(r, "Cả hai quan đã bị ăn");
      return false;
    }
    if (!sideEmpty(r.pits, r.turnSeat)) {
      this.refreshValid(r);
      return true;
    }
    if (quanRemaining(r.pits) <= 0) {
      this.finishGame(r, "Hết quan — kết thúc");
      return false;
    }
    const redist = applyRedistribute(r.pits, r.scores, r.turnSeat);
    if ("error" in redist) {
      this.finishGame(r, "Không đủ điểm rải lại — kết thúc sớm");
      return false;
    }
    r.pits = redist.pits;
    r.scores = redist.scores;
    r.lastEvent = `Rải lại ${redist.lent} viên cho ghế ${r.turnSeat + 1}`;
    this.refreshValid(r);
    if (!r.validPitIndexes.length) {
      this.finishGame(r, "Không còn nước đi");
      return false;
    }
    return true;
  }

  private finishGame(r: RoomInternal, reason: string) {
    if (r.status === "finished") return;
    const fin = finalizeScores(r.pits, r.scores);
    r.pits = fin.pits;
    r.scores = fin.scores;
    r.winnerSeat = winnerSeatFromScores(r.scores);
    r.status = "finished";
    r.validPitIndexes = [];
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
    const humanCount = humans.length;

    if (stake <= 0) {
      if (r.winnerSeat == null) {
        r.lastEvent = `${r.lastEvent || "Hết ván"} — hòa ${r.scores[0]}:${r.scores[1]}`;
      } else {
        r.lastEvent = `${winner?.displayName ?? "?"} thắng ${r.scores[0]}:${r.scores[1]}`;
      }
      return;
    }

    if (r.winnerSeat == null) {
      // Draw — refund stakes
      for (const [paidId, amt] of Object.entries(r.stakesPaid ?? {})) {
        authStore.adjustBalance(paidId, amt, {
          lane: "play",
          reason: `oan_quan_draw_refund:${r.roomId}`,
          gameId: "oan-quan",
        });
      }
      r.pot = 0;
      r.lastEvent = `Hòa ${r.scores[0]}:${r.scores[1]} — hoàn cược`;
      return;
    }

    if (winner && !winner.isBot && winner.userId) {
      let payout = r.pot || 0;
      if (humanCount <= 1) {
        payout = Math.floor(stake * BOT_WIN_MULT);
      }
      const adj = authStore.adjustBalance(winner.userId, payout, {
        lane: "play",
        reason: `oan_quan_win:${r.roomId}`,
        gameId: "oan-quan",
      });
      r.lastEvent = adj.ok
        ? `${winner.displayName} thắng ${r.scores[0]}:${r.scores[1]}! +${payout} xu`
        : `${winner.displayName} thắng! (lỗi cộng xu)`;
      r.pot = 0;
      return;
    }

    r.pot = 0;
    r.lastEvent = `${winner?.displayName ?? "Bot"} thắng ${r.scores[0]}:${r.scores[1]} — bạn mất cược`;
  }

  private currentPlayer(r: RoomInternal): OanPlayer {
    return r.seats[r.turnSeat]!;
  }

  private actorOwns(
    p: OanPlayer,
    opts: { userId?: string | null; guestId?: string | null },
  ): boolean {
    if (p.isBot) return false;
    if (opts.userId && p.userId === opts.userId) return true;
    if (opts.guestId && p.guestId === opts.guestId) return true;
    return false;
  }

  sow(
    roomId: string,
    pitIndex: number,
    opts: { userId?: string | null; guestId?: string | null; auto?: boolean },
  ): OanPublicState | { error: string } {
    const r = this.rooms.get(roomId.toUpperCase());
    if (!r) return { error: "Không thấy phòng" };
    if (r.status !== "playing") return { error: "Ván chưa chơi / đã xong" };

    const p = this.currentPlayer(r);
    if (!opts.auto && !this.actorOwns(p, opts)) {
      return { error: "Không phải lượt của bạn" };
    }
    if (opts.auto && !p.isBot && !opts.userId && !opts.guestId) {
      // timeout / bot path ok
    }

    if (!this.ensureSideCanMove(r)) {
      this.save();
      return this.publicView(r);
    }

    const pit = Math.floor(Number(pitIndex));
    if (!r.validPitIndexes.includes(pit)) {
      return { error: "Ô không hợp lệ" };
    }

    const result = applySow(r.pits, r.scores, r.turnSeat, pit);
    if ("error" in result) return { error: result.error };

    r.pits = result.pits;
    r.scores = result.scores;
    r.lastSteps = result.steps;
    r.moveSeq += 1;
    r.lastEvent =
      result.captured > 0
        ? `${p.displayName} rải ô ${pit} · ăn +${result.captured}`
        : `${p.displayName} rải ô ${pit}`;

    if (result.bothQuanGone) {
      this.finishGame(r, "Cả hai quan đã bị ăn");
      this.save();
      return this.publicView(r);
    }

    this.advanceTurn(r);
    if (!this.ensureSideCanMove(r)) {
      this.save();
      return this.publicView(r);
    }
    r.updatedAt = now();
    this.save();
    return this.publicView(r);
  }

  private advanceTurn(r: RoomInternal) {
    r.turnSeat = (r.turnSeat === 0 ? 1 : 0) as OanSeat;
    r.turnDeadline = now() + TURN_MS;
    this.refreshValid(r);
    r.updatedAt = now();
  }

  reconnect(
    roomId: string,
    opts: { userId?: string | null; guestId?: string | null },
  ): OanPublicState | { error: string } {
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
    return this.publicView(r);
  }

  private ensureTurnClock(r: RoomInternal) {
    if (r.status !== "playing") return;
    if (now() < r.turnDeadline) return;
    this.handleTimeout(r);
  }

  private handleTimeout(r: RoomInternal) {
    if (r.status !== "playing") return;
    const p = this.currentPlayer(r);
    if (!this.ensureSideCanMove(r)) {
      this.save();
      return;
    }
    const pick =
      r.validPitIndexes[0] ??
      pickBotPit(r.pits, r.turnSeat);
    if (pick == null) {
      this.finishGame(r, "Không còn nước đi");
      this.save();
      return;
    }
    if (!p.isBot) {
      p.strikes += 1;
      r.lastEvent = `${p.displayName} hết giờ — máy rải ô ${pick}`;
      if (p.strikes >= MAX_STRIKES) {
        p.isBot = true;
        p.displayName = `Bot ghế ${p.seat + 1}`;
        p.userId = null;
        p.guestId = null;
      }
    }
    this.sow(r.roomId, pick, { auto: true });
  }

  private tickAll() {
    for (const r of this.rooms.values()) {
      if (r.status !== "playing") continue;
      if (now() >= r.turnDeadline) {
        this.handleTimeout(r);
        continue;
      }
      const p = this.currentPlayer(r);
      if (p.isBot && now() > r.updatedAt + 800) {
        if (!this.ensureSideCanMove(r)) continue;
        const pick = pickBotPit(r.pits, r.turnSeat);
        if (pick == null) {
          this.finishGame(r, "Bot hết nước");
          this.save();
          continue;
        }
        this.sow(r.roomId, pick, { auto: true });
      }
    }
  }
}

export const oanQuanRoomStore = new OanQuanRoomStore();
