import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { authStore, isStaff } from "./auth.js";
import { DEFAULT_AVATAR, normalizeAvatar } from "./avatars.js";
import { betStore } from "./betStore.js";
import {
  CARDS,
  getCard,
  houseProfitByCard,
  pickWinningCardWithUserBias,
  type UserRoundBias,
} from "./cards.js";
import { interStore, isPackMode, isPolicyMode } from "./interStore.js";
import {
  computeCardHeat,
  engagementAllowedForMode,
  feedJackpotFromStake,
  JACKPOT_MIN_STAKE,
  JACKPOT_START,
  PUBLIC_WIN_STREAK_MIN,
  rollJackpotPayout,
  WARM_MIN_LOSS_STREAK,
  type JackpotCandidate,
} from "./tarotEngagement.js";
import {
  CHASER_BOT_COUNT,
  createIdentityPool,
  randomBotBetAmount,
  randomBotBetsPerRound,
  randomCardId,
  randomChaserBetAmount,
  type BotIdentity,
} from "./bots.js";
import { vaultStore } from "./vaultStore.js";
import { guestPlayStore, GUEST_PLAY_LIMIT_MS } from "./guestPlayStore.js";
import { chatConfigStore } from "./chatConfigStore.js";
import {
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_LIMIT,
  SAINT_COOLDOWN_MS,
  containsBlockedWords,
  getShout,
  isChatMode,
  sanitizeChatText,
  type ChatMode,
  type ShoutEvent,
} from "./shouts.js";
import {
  BOT_LOG_LIMIT,
  HISTORY_LIMIT,
  LEADERBOARD_LIMIT,
  BET_STEP,
  MAX_BET,
  MAX_BOTS,
  MAX_CARDS_PER_ROUND,
  MIN_BET,
  MIN_BOTS,
  PHASE_MS,
  STARTING_BALANCE,
  TARGET_DISPLAY_CCU,
  todayKey,
  weekKey,
  type BotLogEntry,
  type BotPanelState,
  type BotPublic,
  type LeaderboardEntry,
  type OnlinePlayerPublic,
  type Phase,
  type PlayerSession,
  type PublicState,
  type RoundResult,
  type RoundTopWinner,
  type TarotStarEntry,
  type TopAcePreview,
} from "./types.js";

function readBotTargetCount(): number {
  const raw = process.env.BOT_TARGET_COUNT;
  if (raw != null && String(raw).trim() !== "") {
    const n = Math.floor(Number(raw));
    if (Number.isFinite(n)) {
      return Math.max(MIN_BOTS, Math.min(MAX_BOTS, n));
    }
  }
  return TARGET_DISPLAY_CCU;
}

type BroadcastFn = (state: PublicState, playerId?: string) => void;

function hiddenFromLeaderboards(userId?: string | null): boolean {
  return authStore.isHiddenFromLeaderboard(userId);
}

function isBotPlayerId(playerId: string): boolean {
  return playerId.startsWith("bot-");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const HISTORY_PATH = join(DATA_DIR, "history.json");
const HISTORY_TMP = join(DATA_DIR, "history.json.tmp");

interface PersistedWinner {
  playerId: string;
  name: string;
  profit: number;
  payout: number;
  stake: number;
  winningCardId: number;
  round: number;
  chosenCards: { cardId: number; amount: number }[];
}

interface HistoryFile {
  version: 1 | 2 | 3;
  nextRound: number;
  /** UTC day key (YYYY-MM-DD) — hết ngày thì ván về #1 */
  roundDayKey?: string;
  history: RoundResult[];
  vipPool?: number;
  vipBase?: number;
  jackpotPool?: number;
  lastJackpotWin?: { name: string; amount: number; round: number } | null;
  lastRoundWinners?: PersistedWinner[];
}

interface BotJob {
  at: number;
  botId: string;
  /** 0 = chọn lúc đặt (dí cầu lớn) */
  cardId: number;
  amount: number;
  chase?: boolean;
}

export class GameEngine {
  private phase: Phase = "betting";
  private phaseEndsAt = Date.now() + PHASE_MS.betting;
  private roundNumber = 1;
  /** Ngày UTC đang đếm thứ tự ván — đổi ngày → reset về 1 */
  private roundDayKey = todayKey();
  private winningCard: number | null = null;
  private history: RoundResult[] = [];

  private players = new Map<string, PlayerSession>();
  /** User disconnect giữa revealing/payout — vẫn nhận thưởng */
  private orphans = new Map<string, PlayerSession>();
  private realBets = new Array(CARDS.length).fill(0) as number[];
  private realBettors = new Array(CARDS.length).fill(0) as number[];
  private botBets = new Array(CARDS.length).fill(0) as number[];
  private botBettors = new Array(CARDS.length).fill(0) as number[];

  private identityPool = createIdentityPool(50);
  /** Số bot mong muốn (user chỉnh được) */
  private targetBotCount = readBotTargetCount();
  private activeBots: BotIdentity[] = [];
  /** botId -> cardId -> amount */
  private botRoundBets = new Map<string, Map<number, number>>();
  private botSchedule: BotJob[] = [];
  private botLogs: BotLogEntry[] = [];
  private botLogSeq = 0;
  private lastBotScaleAt = 0;
  private lastBroadcastAt = 0;
  private lastBroadcastBetDigest = "";
  private lastVipJitterAt = 0;
  /** Quỹ VIP cosmetic */
  private vipPool = 12_694;
  private vipBase = 12_694;
  /** Hũ Tarot — feed từ cược auth, trả bonus ngẫu nhiên */
  private jackpotPool = JACKPOT_START;
  private lastJackpotWin: { name: string; amount: number; round: number } | null =
    null;
  private streakHighlights: {
    name: string;
    streak: number;
    at: number;
    userId?: string;
  }[] = [];
  /** Người thắng vòng trước (snapshot lúc payout) */
  private lastRoundWinners: {
    playerId: string;
    userId?: string;
    name: string;
    profit: number;
    payout: number;
    stake: number;
    winningCardId: number;
    round: number;
    chosenCards: { cardId: number; amount: number }[];
  }[] = [];
  /** Top 3 ván hiện tại — snapshot lúc bắt đầu revealing */
  private roundTopWinnersRaw: {
    playerId: string;
    userId?: string;
    name: string;
    profit: number;
    payout: number;
    stake: number;
    winningCardId: number;
    isBot: boolean;
  }[] = [];

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private broadcast: BroadcastFn;
  /** Rate-limit chat: socketId -> last at */
  private shoutCooldown = new Map<string, number>();
  /** Saint cooldown theo userId */
  private saintCooldown = new Map<string, number>();
  /** Chat realtime trong phòng — reset theo ngày UTC */
  private chatLines: ShoutEvent[] = [];
  private chatDayKey = todayKey();
  private lastGuestPlayCheckAt = 0;

  constructor(broadcast: BroadcastFn) {
    this.broadcast = broadcast;
    this.loadHistoryFromDisk();
  }

  getChatLines(): ShoutEvent[] {
    this.ensureChatDay();
    return [...this.chatLines];
  }

  /** Hết ngày UTC → xóa lịch sử chat phòng. */
  private ensureChatDay(): boolean {
    const key = todayKey();
    if (this.chatDayKey === key) return false;
    this.chatDayKey = key;
    this.chatLines = [];
    return true;
  }

  start() {
    this.resetBettingPhase();
    this.tickTimer = setInterval(() => this.tick(), 250);
  }

  private loadHistoryFromDisk() {
    try {
      if (!existsSync(HISTORY_PATH)) return;
      const parsed = JSON.parse(readFileSync(HISTORY_PATH, "utf8")) as HistoryFile;
      if (
        (parsed?.version !== 1 &&
          parsed?.version !== 2 &&
          parsed?.version !== 3) ||
        !Array.isArray(parsed.history)
      ) {
        return;
      }
      const today = todayKey();
      const savedDay =
        typeof parsed.roundDayKey === "string" && parsed.roundDayKey
          ? parsed.roundDayKey
          : null;

      // Hết ngày (UTC) → thứ tự ván về 1, xóa strip kết quả cũ
      if (savedDay && savedDay !== today) {
        this.roundDayKey = today;
        this.roundNumber = 1;
        this.history = [];
        if (typeof parsed.vipPool === "number" && Number.isFinite(parsed.vipPool)) {
          this.vipPool = parsed.vipPool;
        }
        if (typeof parsed.vipBase === "number" && Number.isFinite(parsed.vipBase)) {
          this.vipBase = parsed.vipBase;
        }
        if (
          typeof parsed.jackpotPool === "number" &&
          Number.isFinite(parsed.jackpotPool)
        ) {
          this.jackpotPool = Math.max(0, parsed.jackpotPool);
        }
        console.log(
          `[game] Day rollover (${savedDay} → ${today}) · round #1`,
        );
        this.saveHistoryToDisk();
        return;
      }

      const rows: RoundResult[] = [];
      for (const row of parsed.history) {
        if (
          row &&
          typeof row.round === "number" &&
          typeof row.win === "number" &&
          row.win >= 1 &&
          row.win <= 8
        ) {
          rows.push({ round: row.round, win: row.win });
        }
      }
      this.history = rows.slice(0, HISTORY_LIMIT);
      this.roundDayKey = savedDay ?? today;
      const next = Math.floor(Number(parsed.nextRound));
      if (Number.isFinite(next) && next >= 1) {
        this.roundNumber = next;
      } else if (this.history.length > 0) {
        this.roundNumber = Math.max(...this.history.map((h) => h.round)) + 1;
      }
      if (typeof parsed.vipPool === "number" && Number.isFinite(parsed.vipPool)) {
        this.vipPool = parsed.vipPool;
      }
      if (typeof parsed.vipBase === "number" && Number.isFinite(parsed.vipBase)) {
        this.vipBase = parsed.vipBase;
      }
      if (
        typeof parsed.jackpotPool === "number" &&
        Number.isFinite(parsed.jackpotPool)
      ) {
        this.jackpotPool = Math.max(0, parsed.jackpotPool);
      }
      if (parsed.lastJackpotWin && typeof parsed.lastJackpotWin.name === "string") {
        this.lastJackpotWin = {
          name: parsed.lastJackpotWin.name,
          amount: Math.floor(Number(parsed.lastJackpotWin.amount) || 0),
          round: Math.floor(Number(parsed.lastJackpotWin.round) || 0),
        };
      }
      if (Array.isArray(parsed.lastRoundWinners)) {
        this.lastRoundWinners = parsed.lastRoundWinners
          .filter(
            (w) =>
              w &&
              typeof w.name === "string" &&
              typeof w.profit === "number" &&
              typeof w.payout === "number" &&
              !isBotPlayerId(String(w.playerId ?? "")),
          )
          .slice(0, 3)
          .map((w) => ({
            playerId: String(w.playerId ?? ""),
            name: w.name,
            profit: w.profit,
            payout: w.payout,
            stake: Number(w.stake) || 0,
            winningCardId: Number(w.winningCardId) || 1,
            round: Number(w.round) || 0,
            chosenCards: Array.isArray(w.chosenCards) ? w.chosenCards : [],
          }));
      }
      console.log(
        `[game] Loaded ${this.history.length} results · next round #${this.roundNumber} · day ${this.roundDayKey} · vip ${Math.round(this.vipPool)}`,
      );
    } catch (err) {
      console.warn("[game] Failed to load history.json:", err);
    }
  }

  private saveHistoryToDisk() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: HistoryFile = {
        version: 3,
        nextRound: this.roundNumber,
        roundDayKey: this.roundDayKey,
        history: this.history.slice(0, HISTORY_LIMIT),
        vipPool: this.vipPool,
        vipBase: this.vipBase,
        jackpotPool: this.jackpotPool,
        lastJackpotWin: this.lastJackpotWin,
        lastRoundWinners: this.lastRoundWinners.slice(0, 3),
      };
      writeFileSync(HISTORY_TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(HISTORY_TMP, HISTORY_PATH);
    } catch (err) {
      console.warn("[game] Failed to save history.json:", err);
    }
  }

  /** Hết ngày UTC → ván về #1. Trả true nếu vừa reset. */
  private ensureRoundDay(): boolean {
    const key = todayKey();
    if (this.roundDayKey === key) return false;
    const prev = this.roundDayKey;
    this.roundDayKey = key;
    this.roundNumber = 1;
    this.history = [];
    this.saveHistoryToDisk();
    console.log(`[game] Day rollover (${prev} → ${key}) · round #1`);
    this.emitToAll();
    return true;
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  /** Gắn / cập nhật userId cho session đang chơi (token hợp lệ). */
  linkAuth(
    socketId: string,
    userId: string,
  ): PlayerSession | null {
    const session = this.players.get(socketId);
    const linked = authStore.getById(userId);
    if (!session || !linked) return null;
    if (session.userId && session.userId !== linked.id) {
      // Đã gắn user khác — không ghi đè
      return session;
    }
    this.ensureDay(session);
    session.userId = linked.id;
    session.name = linked.username.slice(0, 20);
    session.avatar = normalizeAvatar(linked.avatar) || session.avatar;
    session.balance = linked.balance;
    session.winToday = linked.winToday;
    session.guessesToday = linked.guessesToday;
    session.stakeWeek = linked.stakeWeek ?? session.stakeWeek;
    const streaks = authStore.getTarotStreaks(linked.id);
    session.tarotLossStreak = streaks.loss;
    session.tarotWinStreak = streaks.win;
    return session;
  }

  join(
    socketId: string,
    opts?: {
      name?: string;
      userId?: string;
      avatar?: string;
      guestCode?: string;
      guestBalance?: number;
    },
  ):
    | {
        ok: true;
        session: PlayerSession;
        kickedSocketIds: string[];
        recoveredOrphan?: boolean;
        guestPlayExpired?: boolean;
        guestPlayRemainingMs?: number;
      }
    | { ok: false; reason: string } {
    if (opts?.userId && authStore.isBanned(opts.userId)) {
      const u = authStore.getById(opts.userId);
      return {
        ok: false,
        reason: u?.banReason
          ? `Tài khoản bị khóa: ${u.banReason}`
          : "Tài khoản bị khóa",
      };
    }
    const existing = this.players.get(socketId);
    if (existing) {
      // Re-join cùng socket: gắn auth nếu trước đó vào như khách
      if (opts?.userId && !existing.userId) {
        this.linkAuth(socketId, opts.userId);
      }
      return { ok: true, session: existing, kickedSocketIds: [] };
    }

    const linked = opts?.userId ? authStore.getById(opts.userId) : undefined;
    const guestCodeNorm = opts?.guestCode
      ? String(opts.guestCode).trim().toUpperCase()
      : "";
    const kickedSocketIds: string[] = [];
    let carried: PlayerSession | undefined;

    // Một session / userId — kick tab cũ (leave → orphan nếu đang mid-round)
    if (linked) {
      for (const [sid, s] of this.players) {
        if (s.userId === linked.id && sid !== socketId) {
          kickedSocketIds.push(sid);
          this.leave(sid, { replaced: true });
        }
      }
      for (const [oid, o] of [...this.orphans]) {
        if (o.userId === linked.id) {
          this.orphans.delete(oid);
          carried = o;
        }
      }
    } else if (guestCodeNorm && /^G[A-Z0-9]{7}$/.test(guestCodeNorm)) {
      for (const [oid, o] of [...this.orphans]) {
        if (!o.userId && o.guestCode === guestCodeNorm) {
          this.orphans.delete(oid);
          carried = o;
        }
      }
    }

    const recoveredOrphan =
      !!carried &&
      [...carried.bets.values()].some((v) => v > 0);

    let guestPlayExpired = false;
    let guestPlayRemainingMs = GUEST_PLAY_LIMIT_MS;
    if (!linked && guestCodeNorm && /^G[A-Z0-9]{7}$/.test(guestCodeNorm)) {
      const play = guestPlayStore.onGuestJoin(guestCodeNorm);
      guestPlayExpired = play.expired;
      guestPlayRemainingMs = play.remainingMs;
    }

    let guestBalanceHint =
      !linked &&
      opts?.guestBalance != null &&
      Number.isFinite(opts.guestBalance)
        ? Math.max(
            0,
            Math.min(Math.floor(opts.guestBalance), 50_000_000),
          )
        : undefined;

    if (guestPlayExpired) {
      guestBalanceHint = undefined;
      if (carried) {
        carried.balance = STARTING_BALANCE;
        carried.bets = new Map();
      }
    }

    const session: PlayerSession = carried
      ? {
          ...carried,
          id: socketId,
          userId: linked?.id ?? carried.userId,
          guestCode:
            carried.guestCode ||
            (guestCodeNorm && /^G[A-Z0-9]{7}$/.test(guestCodeNorm)
              ? guestCodeNorm
              : undefined),
          name: (
            linked?.username ||
            carried.name ||
            opts?.name?.trim() ||
            `Khach${Math.floor(Math.random() * 9000) + 1000}`
          ).slice(0, 20),
          avatar:
            normalizeAvatar(linked?.avatar) ||
            normalizeAvatar(carried.avatar) ||
            normalizeAvatar(opts?.avatar) ||
            DEFAULT_AVATAR,
          bets: new Map(carried.bets),
        }
      : {
          id: socketId,
          userId: linked?.id,
          guestCode:
            guestCodeNorm && /^G[A-Z0-9]{7}$/.test(guestCodeNorm)
              ? guestCodeNorm
              : undefined,
          name: (
            linked?.username ||
            opts?.name?.trim() ||
            `Khach${Math.floor(Math.random() * 9000) + 1000}`
          ).slice(0, 20),
          avatar:
            normalizeAvatar(linked?.avatar) ||
            normalizeAvatar(opts?.avatar) ||
            DEFAULT_AVATAR,
          balance:
            guestPlayExpired
              ? STARTING_BALANCE
              : linked?.balance ??
                guestBalanceHint ??
                STARTING_BALANCE,
          bets: new Map(),
          guessesToday: linked?.guessesToday ?? 0,
          winToday: linked?.winToday ?? 0,
          dayKey: todayKey(),
          stakeWeek: linked?.stakeWeek ?? 0,
          weekKey: linked?.weekKey ?? weekKey(),
          tarotLossStreak: linked
            ? authStore.getTarotStreaks(linked.id).loss
            : 0,
          tarotWinStreak: linked
            ? authStore.getTarotStreaks(linked.id).win
            : 0,
        };
    this.ensureWeek(session);
    this.players.set(socketId, session);
    if (session.userId) this.syncUser(session);
    this.emitToAll();
    return {
      ok: true,
      session,
      kickedSocketIds,
      recoveredOrphan: recoveredOrphan || undefined,
      guestPlayExpired: guestPlayExpired || undefined,
      guestPlayRemainingMs,
    };
  }

  /** Socket ids của user đang online — để kick khi ban. */
  getSocketIdsForUser(userId: string): string[] {
    const out: string[] = [];
    for (const [sid, s] of this.players) {
      if (s.userId === userId) out.push(sid);
    }
    return out;
  }

  /**
   * Rời bàn:
   * - Có cược → giữ orphan đến hết ván (trả thưởng / ghi lịch sử), không hoàn khi mất socket
   * - Không cược → chỉ gỡ khỏi phòng
   */
  leave(socketId: string, opts?: { replaced?: boolean }) {
    const session = this.players.get(socketId);
    if (!session) return;

    const hasBets = [...session.bets.values()].some((v) => v > 0);

    if (hasBets) {
      if (session.userId) {
        for (const [k, o] of this.orphans) {
          if (o.userId === session.userId) this.orphans.delete(k);
        }
      } else if (session.guestCode) {
        for (const [k, o] of this.orphans) {
          if (!o.userId && o.guestCode === session.guestCode) {
            this.orphans.delete(k);
          }
        }
      }
      this.orphans.set(session.id, session);
    }

    if (session.userId) {
      authStore.syncPlayStats(
        session.userId,
        session.balance,
        session.winToday,
        session.guessesToday,
        session.stakeWeek,
      );
    }
    this.players.delete(socketId);
    if (!opts?.replaced) {
      this.scaleBots();
      this.emitToAll();
    }
  }

  private refundSessionBets(session: PlayerSession) {
    let refunded = 0;
    for (const [cardId, amount] of session.bets.entries()) {
      if (amount <= 0) continue;
      const idx = cardId - 1;
      session.balance += amount;
      refunded += amount;
      this.realBets[idx] = Math.max(0, this.realBets[idx]! - amount);
      this.realBettors[idx] = Math.max(0, this.realBettors[idx]! - 1);
      session.stakeWeek = Math.max(0, session.stakeWeek - amount);
      if (session.guessesToday > 0) session.guessesToday -= 1;
    }
    session.bets.clear();
    if (refunded > 0 && session.userId) {
      vaultStore.recordStakeRefund(refunded, session.name, session.userId);
    }
    if (refunded > 0) {
      console.log(
        `[game] Refund ${refunded} xu → ${session.name} (leave betting)`,
      );
    }
  }

  /** Khách đang trong bàn (online hoặc orphan ván) — cho admin. */
  listLiveGuestsForAdmin(): {
    socketId: string;
    guestCode?: string;
    name: string;
    balance: number;
    inOrphan: boolean;
  }[] {
    const rows: {
      socketId: string;
      guestCode?: string;
      name: string;
      balance: number;
      inOrphan: boolean;
    }[] = [];
    for (const p of this.players.values()) {
      if (p.userId) continue;
      rows.push({
        socketId: p.id,
        guestCode: p.guestCode,
        name: p.name,
        balance: p.balance,
        inOrphan: false,
      });
    }
    for (const p of this.orphans.values()) {
      if (p.userId) continue;
      if (this.players.has(p.id)) continue;
      rows.push({
        socketId: p.id,
        guestCode: p.guestCode,
        name: p.name,
        balance: p.balance,
        inOrphan: true,
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return rows;
  }

  private findGuestSession(opts: {
    socketId?: string;
    guestCode?: string;
  }): PlayerSession | undefined {
    const sid = opts.socketId ? String(opts.socketId).trim() : "";
    if (sid) {
      const live = this.players.get(sid);
      if (live && !live.userId) return live;
      const orphan = this.orphans.get(sid);
      if (orphan && !orphan.userId) return orphan;
    }
    const code = opts.guestCode
      ? String(opts.guestCode).trim().toUpperCase()
      : "";
    if (code && /^G[A-Z0-9]{7}$/.test(code)) {
      for (const p of this.players.values()) {
        if (!p.userId && p.guestCode === code) return p;
      }
      for (const p of this.orphans.values()) {
        if (!p.userId && p.guestCode === code) return p;
      }
    }
    return undefined;
  }

  /** Admin cộng/trừ xu session khách (Tarot bàn hiện tại). */
  adjustGuestBalance(opts: {
    socketId?: string;
    guestCode?: string;
    delta: number;
  }):
    | {
        ok: true;
        balance: number;
        name: string;
        guestCode?: string;
        socketIds: string[];
      }
    | { ok: false; reason: string } {
    const session = this.findGuestSession(opts);
    if (!session) {
      return { ok: false, reason: "Không tìm thấy khách (online/orphan)" };
    }
    if (session.userId) {
      return { ok: false, reason: "Đây là tài khoản đăng nhập — dùng adjust user" };
    }
    const delta = Math.floor(opts.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return { ok: false, reason: "Delta không hợp lệ" };
    }
    session.balance = Math.max(0, session.balance + delta);
    const socketIds: string[] = [];
    if (this.players.has(session.id)) {
      socketIds.push(session.id);
      this.broadcast(this.getStateFor(session.id), session.id);
    }
    return {
      ok: true,
      balance: session.balance,
      name: session.name,
      guestCode: session.guestCode,
      socketIds,
    };
  }

  /** Admin chỉnh xu auth → đồng bộ session đang online (trả socket ids đã cập nhật). */
  applyAuthBalance(
    userId: string,
    balance: number,
  ): { socketIds: string[]; balance: number } {
    const next = Math.max(0, Math.floor(balance));
    const socketIds: string[] = [];
    for (const session of this.players.values()) {
      if (session.userId !== userId) continue;
      session.balance = next;
      socketIds.push(session.id);
      this.broadcast(this.getStateFor(session.id), session.id);
    }
    return { socketIds, balance: next };
  }

  /** Đổi avatar auth → đồng bộ session online. */
  applyAuthAvatar(
    userId: string,
    avatar: string,
  ): { socketIds: string[]; avatar: string } {
    const next = normalizeAvatar(avatar);
    const socketIds: string[] = [];
    for (const session of this.players.values()) {
      if (session.userId !== userId) continue;
      session.avatar = next;
      socketIds.push(session.id);
      this.broadcast(this.getStateFor(session.id), session.id);
    }
    return { socketIds, avatar: next };
  }

  /** Đổi avatar phiên hiện tại (khách hoặc đã login trên socket). */
  setSessionAvatar(
    socketId: string,
    avatar: string,
  ): { ok: true; avatar: string } | { ok: false; reason: string } {
    const session = this.players.get(socketId);
    if (!session) return { ok: false, reason: "Chưa vào bàn" };
    const next = normalizeAvatar(avatar);
    session.avatar = next;
    if (session.userId) {
      authStore.setAvatar(session.userId, next);
    }
    this.emitToAll();
    return { ok: true, avatar: next };
  }

  /** Đổi tên hiển thị — chỉ khách (user login giữ username). */
  setSessionName(
    socketId: string,
    name: string,
  ): { ok: true; name: string } | { ok: false; reason: string } {
    const session = this.players.get(socketId);
    if (!session) return { ok: false, reason: "Chưa vào bàn" };
    if (session.userId) {
      return { ok: false, reason: "Tài khoản dùng username cố định" };
    }
    const next = String(name ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
    if (next.length < 2) {
      return { ok: false, reason: "Tên 2–16 ký tự" };
    }
    session.name = next;
    this.emitToAll();
    return { ok: true, name: next };
  }

  private resolveAvatar(playerId: string, userId?: string): string {
    const live = this.players.get(playerId);
    if (live?.avatar) return normalizeAvatar(live.avatar);
    if (userId) {
      const u = authStore.getById(userId);
      if (u) return normalizeAvatar(u.avatar);
    }
    const bot = this.activeBots.find((b) => b.id === playerId);
    if (bot?.avatar) return normalizeAvatar(bot.avatar);
    return DEFAULT_AVATAR;
  }

  /** Snapshot online for admin */
  getOnlineStats() {
    return {
      realPlayers: this.players.size,
      displayOnline: this.players.size + this.activeBots.length,
      phase: this.phase,
      roundNumber: this.roundNumber,
      botTarget: this.targetBotCount,
      botActive: this.activeBots.length,
      vipPool: Math.round(this.vipPool),
    };
  }

  /** Stake mọi người chơi (kể cả khách) theo lá. */
  getRealBets(): number[] {
    return [...this.realBets];
  }

  /**
   * Stake chỉ user đăng nhập (có userId) — vào kho / Inter App·Fed·User.
   * Khách không tính vì không ghi vault.
   */
  getAuthBets(): number[] {
    const bets = new Array(CARDS.length).fill(0) as number[];
    const add = (p: PlayerSession) => {
      if (!p.userId) return;
      for (const [cardId, amt] of p.bets.entries()) {
        if (amt > 0) bets[cardId - 1]! += amt;
      }
    };
    for (const p of this.players.values()) add(p);
    for (const p of this.orphans.values()) add(p);
    return bets;
  }

  private emptyBotPanel(): BotPanelState {
    return {
      targetCount: this.targetBotCount,
      activeCount: this.activeBots.length,
      bots: [],
      logs: [],
      botBetsTotal: new Array(CARDS.length).fill(0),
    };
  }

  /** Lưu lượng bàn hiện tại (mainadmin). */
  getLiveTraffic() {
    const realStake = this.realBets.reduce((a, b) => a + b, 0);
    const botStake = this.botBets.reduce((a, b) => a + b, 0);
    const realBettors = this.realBettors.reduce((a, b) => a + b, 0);
    const botBettors = this.botBettors.reduce((a, b) => a + b, 0);
    let loggedInOnline = 0;
    let guestOnline = 0;
    for (const p of this.players.values()) {
      if (p.userId) loggedInOnline += 1;
      else guestOnline += 1;
    }
    return {
      realStakeRound: realStake,
      botStakeRound: botStake,
      displayStakeRound: realStake + botStake,
      realBettorsRound: realBettors,
      botBettorsRound: botBettors,
      loggedInOnline,
      guestOnline,
      historyRounds: this.history.length,
      nextRound: this.roundNumber,
    };
  }

  private syncUser(session: PlayerSession) {
    if (!session.userId) return;
    authStore.syncPlayStats(
      session.userId,
      session.balance,
      session.winToday,
      session.guessesToday,
      session.stakeWeek,
    );
  }

  setBotCount(
    count: number,
  ): { ok: true; targetCount: number; activeCount: number } | { ok: false; reason: string } {
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n < MIN_BOTS || n > MAX_BOTS) {
      return { ok: false, reason: `Số bot phải từ ${MIN_BOTS}–${MAX_BOTS}` };
    }
    const prev = this.targetBotCount;
    this.targetBotCount = n;
    this.scaleBots();
    this.pushLog({
      botId: "system",
      botName: "System",
      cardId: 0,
      amount: 0,
      action: "scale",
      message: `Đổi số bot: ${prev} → ${n} (đang active ${this.activeBots.length})`,
    });
    // Nếu đang betting, lên lịch lại cho số bot mới
    if (this.phase === "betting") {
      this.scheduleBotBets(false);
    }
    this.emitToAll();
    return {
      ok: true,
      targetCount: this.targetBotCount,
      activeCount: this.activeBots.length,
    };
  }

  placeBet(
    socketId: string,
    cardId: number,
    amount: number,
    roundId?: number,
  ): { ok: true; balance: number } | { ok: false; reason: string } {
    if (this.phase !== "betting") {
      return { ok: false, reason: "Đã hết giờ đặt cược" };
    }
    if (
      roundId != null &&
      Number.isFinite(roundId) &&
      Math.floor(roundId) !== this.roundNumber
    ) {
      return { ok: false, reason: "Ván đã đổi — đặt lại cược" };
    }
    if (!getCard(cardId)) {
      return { ok: false, reason: "Lá bài không hợp lệ" };
    }

    const amt = Math.floor(Number(amount));
    if (
      !Number.isFinite(amt) ||
      amt < MIN_BET ||
      amt > MAX_BET ||
      amt % BET_STEP !== 0
    ) {
      return {
        ok: false,
        reason: `Số xu không hợp lệ (tối đa ${MAX_BET.toLocaleString("vi-VN")} / 1 lá)`,
      };
    }

    const player = this.players.get(socketId);
    if (!player) return { ok: false, reason: "Chưa vào phòng" };
    if (player.userId && authStore.isBanned(player.userId)) {
      return { ok: false, reason: "Tài khoản bị khóa" };
    }

    this.ensureDay(player);
    this.ensureWeek(player);

    if (player.balance < amt) {
      return { ok: false, reason: "Số dư không đủ" };
    }

    const prev = player.bets.get(cardId) ?? 0;
    if (prev + amt > MAX_BET) {
      return {
        ok: false,
        reason: `Mỗi lá tối đa ${MAX_BET.toLocaleString("vi-VN")} xu (đã đặt ${prev.toLocaleString("vi-VN")})`,
      };
    }
    if (prev <= 0) {
      let distinct = 0;
      for (const v of player.bets.values()) {
        if (v > 0) distinct += 1;
      }
      if (distinct >= MAX_CARDS_PER_ROUND) {
        return {
          ok: false,
          reason: `Mỗi lượt chỉ được đặt tối đa ${MAX_CARDS_PER_ROUND} lá`,
        };
      }
    }

    const idx = cardId - 1;
    player.balance -= amt;
    player.bets.set(cardId, prev + amt);
    player.guessesToday += 1;
    player.stakeWeek += amt;
    this.realBets[idx] += amt;
    if (prev === 0) this.realBettors[idx] += 1;

    if (player.userId) {
      vaultStore.recordStakeIn(amt, player.name, player.userId);
    }

    this.syncUser(player);
    this.emitToAll();
    return { ok: true, balance: player.balance };
  }

  /**
   * Chat / slang phòng.
   * mode: no (10) | vip (50, cần VIP) | saint (10000, toàn màn)
   */
  sendShout(
    socketId: string,
    opts: {
      id?: string;
      text?: string;
      userId?: string;
      mode?: ChatMode;
      /** Legacy */
      vipFly?: boolean;
    },
  ):
    | { ok: true; balance: number; event: ShoutEvent }
    | { ok: false; reason: string } {
    let player = this.players.get(socketId);
    if (!player) return { ok: false, reason: "Chưa vào phòng" };
    if (!player.userId && opts.userId) {
      player = this.linkAuth(socketId, opts.userId) ?? player;
    }
    if (!player.userId) {
      return { ok: false, reason: "Cần đăng nhập lại để chat" };
    }
    if (authStore.isBanned(player.userId)) {
      return { ok: false, reason: "Tài khoản bị khóa" };
    }
    if (authStore.isMuted(player.userId)) {
      const sec = Math.ceil(authStore.getMuteRemainingMs(player.userId) / 1000);
      return {
        ok: false,
        reason:
          sec > 86400 * 365
            ? "Bạn bị cấm chat"
            : `Bạn bị mute còn ${sec}s`,
      };
    }

    let mode: ChatMode = "no";
    if (isChatMode(opts.mode)) mode = opts.mode;
    else if (opts.vipFly) mode = "vip";

    if (mode === "vip" && !authStore.isVipUser(player.userId)) {
      return { ok: false, reason: "Cần VIP để chat bay màn hình" };
    }
    const cost = chatConfigStore.costForMode(mode);

    let text: string | null = null;
    const sid = String(opts.id ?? "").trim();
    if (sid) {
      const def = getShout(sid);
      if (!def) return { ok: false, reason: "Slang không hợp lệ" };
      text = def.text;
    } else {
      text = sanitizeChatText(opts.text ?? "");
      if (!text) return { ok: false, reason: "Nhập nội dung chat" };
      if (containsBlockedWords(text)) {
        return { ok: false, reason: "Nội dung không phù hợp" };
      }
    }

    const now = Date.now();
    const last = this.shoutCooldown.get(socketId) ?? 0;
    if (now - last < CHAT_COOLDOWN_MS) {
      return { ok: false, reason: "Chờ giây lát rồi gửi tiếp" };
    }
    if (mode === "saint") {
      const lastSaint = this.saintCooldown.get(player.userId) ?? 0;
      const wait = SAINT_COOLDOWN_MS - (now - lastSaint);
      if (wait > 0) {
        const sec = Math.ceil(wait / 1000);
        return {
          ok: false,
          reason: `Saint chờ ${sec}s nữa`,
        };
      }
    }

    if (player.balance < cost) {
      return { ok: false, reason: `Cần ${cost.toLocaleString("vi-VN")} xu để chat` };
    }

    player.balance -= cost;
    this.shoutCooldown.set(socketId, now);
    if (mode === "saint") {
      this.saintCooldown.set(player.userId, now);
    }
    this.syncUser(player);
    this.broadcast(this.getStateFor(socketId), socketId);

    const event: ShoutEvent = {
      name: player.name,
      avatar: normalizeAvatar(player.avatar),
      text,
      cost,
      at: now,
      mode,
      fly: mode === "vip",
      saint: mode === "saint",
    };
    this.ensureChatDay();
    this.chatLines.push(event);
    if (this.chatLines.length > CHAT_HISTORY_LIMIT) {
      this.chatLines = this.chatLines.slice(-CHAT_HISTORY_LIMIT);
    }
    return { ok: true, balance: player.balance, event };
  }

  getHistory(limit = HISTORY_LIMIT): RoundResult[] {
    return this.history.slice(0, Math.min(limit, HISTORY_LIMIT));
  }

  getLeaderboard(viewerId?: string): LeaderboardEntry[] {
    const day = todayKey();
    type DayRow = {
      id: string;
      name: string;
      avatar: string;
      winToday: number;
      dayKey: string;
      userId?: string;
    };
    const humanRows: DayRow[] = [...this.players.values()].map((p) => {
      this.ensureDay(p);
      return {
        id: p.id,
        name: p.name,
        avatar: normalizeAvatar(p.avatar),
        winToday: p.winToday,
        dayKey: p.dayKey,
        userId: p.userId,
      };
    });
    const rows = humanRows
      .filter((p) => p.dayKey === day && p.winToday > 0)
      .filter((p) => !hiddenFromLeaderboards(p.userId))
      .sort((a, b) => b.winToday - a.winToday)
      .slice(0, LEADERBOARD_LIMIT);

    return rows.map((p, i) => ({
      rank: i + 1,
      name: p.name,
      avatar: p.avatar,
      winToday: p.winToday,
      isYou: p.id === viewerId,
    }));
  }

  getTopAces(viewerId?: string): TopAcePreview[] {
    const visible = this.lastRoundWinners.filter((w) => {
      if (isBotPlayerId(w.playerId)) return false;
      const uid = w.userId ?? this.players.get(w.playerId)?.userId;
      return !hiddenFromLeaderboards(uid);
    });
    return visible.map((w, i) => {
      // Người thắng vòng trước — hiện lá đang cược ván này nếu có
      const live = this.players.get(w.playerId);
      const currentPicks: { cardId: number; amount: number }[] = [];
      if (live) {
        for (const [cardId, amount] of live.bets.entries()) {
          if (amount > 0) currentPicks.push({ cardId, amount });
        }
        currentPicks.sort((a, b) => a.cardId - b.cardId);
      }

      const linkedUserId = w.userId ?? live?.userId;
      const linked = linkedUserId
        ? authStore.getById(linkedUserId)
        : undefined;

      return {
        rank: i + 1,
        name: w.name,
        avatar: this.resolveAvatar(w.playerId),
        // Thưởng vòng trước = số xu nhận từ lá thắng (stake × hệ số)
        winToday: w.payout,
        isYou: w.playerId === viewerId,
        userId: linked?.id,
        code: linked?.code,
        isVip: linked ? authStore.isVipUser(linked.id) : undefined,
        // Chỉ hiện lá đã đặt cho ván mới; chưa đặt → rỗng
        chosenCards: currentPicks,
      };
    });
  }

  getBotPanel(): BotPanelState {
    const bots: BotPublic[] = this.activeBots.map((b) => {
      const map = this.botRoundBets.get(b.id);
      const bets: { cardId: number; amount: number }[] = [];
      if (map) {
        for (const [cardId, amount] of map.entries()) {
          if (amount > 0) bets.push({ cardId, amount });
        }
        bets.sort((a, c) => a.cardId - c.cardId);
      }
      return {
        id: b.id,
        name: b.name,
        isVip: b.isVip,
        isChaser: b.isChaser,
        bets,
      };
    });

    return {
      targetCount: this.targetBotCount,
      activeCount: this.activeBots.length,
      bots,
      logs: [...this.botLogs],
      botBetsTotal: [...this.botBets],
    };
  }

  getRoundTopWinners(viewerId?: string): RoundTopWinner[] {
    const visible = this.roundTopWinnersRaw.filter((w) => {
      if (w.isBot || isBotPlayerId(w.playerId)) return false;
      const uid = w.userId ?? this.players.get(w.playerId)?.userId;
      return !hiddenFromLeaderboards(uid);
    });
    return visible.map((w, i) => ({
      rank: i + 1,
      name: w.name,
      avatar: this.resolveAvatar(w.playerId),
      profit: w.profit,
      stake: w.stake,
      payout: w.payout,
      winningCardId: w.winningCardId,
      isYou: w.playerId === viewerId,
    }));
  }

  getOnlinePlayers(opts?: { forStaff?: boolean }): OnlinePlayerPublic[] {
    const forStaff = !!opts?.forStaff;
    const humans: OnlinePlayerPublic[] = [];
    for (const p of this.players.values()) {
      this.ensureDay(p);
      const linked = p.userId ? authStore.getById(p.userId) : undefined;
      const row: OnlinePlayerPublic = {
        id: p.id,
        name: p.name,
        avatar: normalizeAvatar(p.avatar),
        isBot: false,
        code: linked?.code,
        winToday: p.winToday,
        guessesToday: p.guessesToday,
        userId: linked?.id,
        isVip: linked ? authStore.isVipUser(linked.id) : undefined,
        roundsPlayed: linked
          ? authStore.getRoundsPlayed(linked.id)
          : undefined,
        vipGranted: linked ? !!linked.vipGranted : undefined,
      };
      if (forStaff && linked) {
        row.balance = linked.balance;
        row.outcomeMode = authStore.getOutcomeMode(linked.id);
      } else if (forStaff && !linked) {
        row.balance = p.balance;
        if (p.guestCode) row.guestCode = p.guestCode;
      }
      humans.push(row);
    }
    humans.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    // Không hiện bot trong list online
    return humans;
  }

  /** Bias win/lose từ user đăng nhập đang có cược (kèm orphan). */
  private collectUserBiases(): UserRoundBias[] {
    const biases: UserRoundBias[] = [];
    const consider = (p: PlayerSession) => {
      if (!p.userId) return;
      const mode = authStore.getOutcomeMode(p.userId);
      if (mode === "normal") return;
      const bets = CARDS.map((c) => p.bets.get(c.id) ?? 0);
      if (!bets.some((x) => x > 0)) return;
      biases.push({ bets, mode });
    };
    for (const p of this.players.values()) consider(p);
    for (const p of this.orphans.values()) consider(p);
    return biases;
  }

  private collectWarmStreakBiases() {
    const out: { bets: number[]; lossStreak: number }[] = [];
    const consider = (p: PlayerSession) => {
      const loss = p.tarotLossStreak ?? 0;
      if (loss < WARM_MIN_LOSS_STREAK) return;
      const bets = CARDS.map((c) => p.bets.get(c.id) ?? 0);
      if (!bets.some((x) => x > 0)) return;
      out.push({ bets, lossStreak: loss });
    };
    for (const p of this.players.values()) consider(p);
    for (const p of this.orphans.values()) consider(p);
    return out;
  }

  private settleTarotStreaksForPlayer(player: PlayerSession) {
    let hadBet = false;
    for (const amt of player.bets.values()) {
      if (amt > 0) {
        hadBet = true;
        break;
      }
    }
    if (!hadBet || this.winningCard == null) return;
    const won = (player.bets.get(this.winningCard) ?? 0) > 0;
    if (won) {
      player.tarotWinStreak = (player.tarotWinStreak ?? 0) + 1;
      player.tarotLossStreak = 0;
      if (player.tarotWinStreak >= PUBLIC_WIN_STREAK_MIN) {
        if (!hiddenFromLeaderboards(player.userId)) {
          this.streakHighlights.unshift({
            name: player.name,
            streak: player.tarotWinStreak,
            at: Date.now(),
            userId: player.userId,
          });
          if (this.streakHighlights.length > 12) {
            this.streakHighlights.length = 12;
          }
        }
      }
    } else {
      player.tarotLossStreak = (player.tarotLossStreak ?? 0) + 1;
      player.tarotWinStreak = 0;
    }
    if (player.userId) {
      authStore.setTarotStreaks(
        player.userId,
        player.tarotLossStreak ?? 0,
        player.tarotWinStreak ?? 0,
      );
    }
  }

  private tryJackpotBonus() {
    if (this.winningCard == null) return;
    const candidates: JackpotCandidate[] = [];
    const collect = (player: PlayerSession) => {
      const stake = player.bets.get(this.winningCard!) ?? 0;
      if (stake < JACKPOT_MIN_STAKE) return;
      candidates.push({
        playerId: player.id,
        name: player.name,
        userId: player.userId,
        stake,
        balance: player.balance,
      });
    };
    for (const p of this.players.values()) collect(p);
    for (const p of this.orphans.values()) collect(p);
    const roll = rollJackpotPayout(this.jackpotPool, candidates);
    if (!roll) return;
    const { winner, amount } = roll;
    this.jackpotPool = Math.max(0, this.jackpotPool - amount);
    const creditPlayer = (p: PlayerSession) => {
      if (p.id !== winner.playerId) return;
      if (p.userId) {
        const adj = authStore.adjustBalance(p.userId, amount);
        if (adj.ok) p.balance = adj.user.balance;
        vaultStore.recordPayoutOut(amount, p.name, p.userId);
      } else {
        p.balance += amount;
      }
    };
    for (const p of this.players.values()) creditPlayer(p);
    for (const p of this.orphans.values()) creditPlayer(p);
    this.lastJackpotWin = {
      name: winner.name,
      amount,
      round: this.roundNumber,
    };
    this.pushLog({
      botId: "system",
      botName: "System",
      cardId: this.winningCard,
      amount,
      action: "round_reset",
      message: `Hũ Tarot · ${winner.name} +${amount} xu (ván #${this.roundNumber})`,
    });
  }

  getStateFor(playerId?: string): PublicState {
    const displayBets = this.realBets.map((v, i) => v + this.botBets[i]);
    const playerCounts = this.realBettors.map((v, i) => v + this.botBettors[i]);

    let forStaff = false;
    if (playerId) {
      const viewer = this.players.get(playerId);
      if (viewer?.userId) {
        const vu = authStore.getById(viewer.userId);
        if (vu && isStaff(vu)) forStaff = true;
      }
    }

    const base: PublicState = {
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      serverTime: Date.now(),
      roundNumber: this.roundNumber,
      roundId: this.roundNumber,
      displayBets,
      playerCounts,
      history: this.getHistory(10),
      winningCard: this.phase === "betting" ? null : this.winningCard,
      ...(forStaff
        ? {
            onlineReal: this.players.size,
            onlineDisplay: this.players.size,
            onlinePlayers: this.getOnlinePlayers({ forStaff: true }),
          }
        : {}),
      topAces: this.getTopAces(playerId),
      roundTopWinners: this.getRoundTopWinners(playerId),
      tarotStars: this.getTarotStars(playerId),
      vipPool: Math.round(this.vipPool),
      jackpotPool: Math.round(this.jackpotPool),
      lastJackpotWin: this.lastJackpotWin,
      cardHeat: computeCardHeat(this.history),
      streakHighlights: this.streakHighlights
        .filter((h) => !hiddenFromLeaderboards(h.userId))
        .slice(0, 8),
      chatLines: this.getChatLines(),
      chatCosts: chatConfigStore.getPublicCosts(),
      // Không lộ bot panel cho client thường — staff lấy qua socket getBotPanel
      botPanel: this.emptyBotPanel(),
    };

    if (playerId) {
      const p = this.players.get(playerId);
      if (p) {
        this.ensureDay(p);
        base.yourBalance = p.balance;
        base.yourAvatar = normalizeAvatar(p.avatar);
        base.yourBets = CARDS.map((c) => p.bets.get(c.id) ?? 0);
        base.guessesToday = p.guessesToday;
        base.winToday = p.winToday;
        if (p.userId) {
          const linked = authStore.getById(p.userId);
          if (linked) {
            base.viewerAuth = {
              code: linked.code,
              isVip: authStore.isVipUser(linked.id),
              roundsPlayed: authStore.getRoundsPlayed(linked.id),
              vipGranted: !!linked.vipGranted,
            };
          }
        }
        const loss = p.tarotLossStreak ?? 0;
        base.viewerEngagement = {
          lossStreak: loss,
          winStreak: p.tarotWinStreak ?? 0,
          warmActive: loss >= WARM_MIN_LOSS_STREAK,
        };
        if (!p.userId && p.guestCode) {
          base.guestPlayRemainingMs = guestPlayStore.getRemainingMs(
            p.guestCode,
          );
          base.guestPlayLimitMs = GUEST_PLAY_LIMIT_MS;
        }
      }
    }
    return base;
  }

  private ensureDay(player: PlayerSession) {
    const key = todayKey();
    if (player.dayKey !== key) {
      player.dayKey = key;
      player.guessesToday = 0;
      player.winToday = 0;
    }
  }

  private ensureWeek(player: PlayerSession) {
    const wk = weekKey();
    if (player.weekKey !== wk) {
      player.weekKey = wk;
      player.stakeWeek = 0;
    }
  }

  private ensureBotDay(bot: BotIdentity) {
    const key = todayKey();
    if (bot.dayKey !== key) {
      bot.dayKey = key;
      bot.guessesToday = 0;
      bot.winToday = 0;
    }
  }

  private ensureBotWeek(bot: BotIdentity) {
    const wk = weekKey();
    if (bot.weekKey !== wk) {
      bot.weekKey = wk;
      bot.stakeWeek = 0;
    }
  }

  getTarotStars(viewerId?: string): TarotStarEntry[] {
    const wk = weekKey();
    type Row = {
      key: string;
      name: string;
      avatar: string;
      stakeWeek: number;
      socketId?: string;
    };
    const byKey = new Map<string, Row>();

    for (const p of this.players.values()) {
      this.ensureWeek(p);
      if (p.weekKey !== wk || p.stakeWeek <= 0) continue;
      const key = p.userId ?? `socket:${p.id}`;
      byKey.set(key, {
        key,
        name: p.name,
        avatar: normalizeAvatar(p.avatar),
        stakeWeek: p.stakeWeek,
        socketId: p.id,
      });
    }

    for (const u of authStore.listWeeklyStakers()) {
      if (byKey.has(u.id)) continue;
      byKey.set(u.id, {
        key: u.id,
        name: u.username,
        avatar: u.avatar,
        stakeWeek: u.stakeWeek,
      });
    }

    return [...byKey.values()]
      .filter((row) => {
        let userId: string | undefined;
        if (!row.key.startsWith("socket:")) userId = row.key;
        else if (row.socketId) {
          userId = this.players.get(row.socketId)?.userId;
        }
        return !hiddenFromLeaderboards(userId);
      })
      .sort((a, b) => b.stakeWeek - a.stakeWeek)
      .slice(0, LEADERBOARD_LIMIT)
      .map((row, i) => {
        let userId: string | undefined;
        if (!row.key.startsWith("socket:")) {
          userId = row.key;
        } else if (row.socketId) {
          userId = this.players.get(row.socketId)?.userId;
        }
        const linked = userId ? authStore.getById(userId) : undefined;
        return {
          rank: i + 1,
          name: row.name,
          avatar: row.avatar,
          stakeWeek: row.stakeWeek,
          isYou: row.socketId === viewerId,
          userId: linked?.id,
          code: linked?.code,
          isVip: linked ? authStore.isVipUser(linked.id) : undefined,
        };
      });
  }

  private botStakeOnCard(botId: string, cardId: number): number {
    return this.botRoundBets.get(botId)?.get(cardId) ?? 0;
  }

  private botChosenCards(botId: string): { cardId: number; amount: number }[] {
    const map = this.botRoundBets.get(botId);
    if (!map) return [];
    const chosen: { cardId: number; amount: number }[] = [];
    for (const [cardId, amount] of map.entries()) {
      if (amount > 0) chosen.push({ cardId, amount });
    }
    chosen.sort((a, b) => a.cardId - b.cardId);
    return chosen;
  }

  /** Đẩy lại state (vd. sau khi admin đổi VIP). */
  refreshAllClients() {
    this.emitToAll();
  }

  private emitToAll() {
    for (const id of this.players.keys()) {
      this.broadcast(this.getStateFor(id), id);
    }
    this.broadcast(this.getStateFor(), undefined);
  }

  private tick() {
    const now = Date.now();
    interStore.tickRotation();
    this.ensureRoundDay();
    if (this.ensureChatDay()) {
      this.emitToAll();
    }

    if (now - this.lastBotScaleAt > 30_000) {
      this.scaleBots();
      this.lastBotScaleAt = now;
    }

    if (this.phase === "betting") {
      this.processBotSchedule(now);
    }

    if (now - this.lastVipJitterAt >= 400) {
      this.jitterVipPool();
      this.lastVipJitterAt = now;
    }

    if (now - this.lastGuestPlayCheckAt >= 5000) {
      this.lastGuestPlayCheckAt = now;
      this.enforceGuestPlayLimits();
    }

    if (now >= this.phaseEndsAt) {
      this.advancePhase();
      return;
    }

    const digest = `${this.realBets.join(",")}|${this.realBettors.join(",")}|${this.phase}`;
    const idle =
      this.phase === "betting" && digest === this.lastBroadcastBetDigest;
    const gap = idle ? 1000 : 500;
    if (now - this.lastBroadcastAt >= gap) {
      this.lastBroadcastAt = now;
      this.lastBroadcastBetDigest = digest;
      this.emitToAll();
    }
  }

  private enforceGuestPlayLimits() {
    for (const p of this.players.values()) {
      if (p.userId || !p.guestCode) continue;
      if (!guestPlayStore.forceExpireIfNeeded(p.guestCode)) continue;
      p.balance = STARTING_BALANCE;
      p.bets.clear();
      this.syncUser(p);
    }
  }

  private jitterVipPool() {
    const displaySum = this.realBets.reduce((a, b) => a + b, 0)
      + this.botBets.reduce((a, b) => a + b, 0);
    // Drift nhẹ theo tổng cược hiển thị + jitter ngẫu nhiên
    const target = this.vipBase + displaySum * 0.35 + this.activeBots.length * 12;
    const delta = (target - this.vipPool) * 0.08 + (Math.random() - 0.45) * 90;
    this.vipPool = Math.max(8_000, Math.min(250_000, this.vipPool + delta));
  }

  private advancePhase() {
    if (this.phase === "betting") {
      this.phase = "revealing";
      this.phaseEndsAt = Date.now() + PHASE_MS.revealing;
      const storedMode = interStore.getMode();
      const authBets = this.getAuthBets();
      const displayStake =
        this.realBets.reduce((a, b) => a + b, 0) +
        this.botBets.reduce((a, b) => a + b, 0);
      const authStake = authBets.reduce((a, b) => a + b, 0);
      const interMode = interStore.getEffectiveMode({
        authStake,
        displayStake,
      });
      const policyBets = isPolicyMode(interMode) ? authBets : this.realBets;
      const userBiases = this.collectUserBiases();
      const recentWins = this.getHistory(3).map((h) => h.win);
      const heatHistory = this.getHistory(20).map((h) => h.win);
      const warmPlayers = this.collectWarmStreakBiases();
      const engagement = engagementAllowedForMode(interMode)
        ? { heatHistory, warmPlayers }
        : undefined;
      this.jackpotPool = feedJackpotFromStake(authStake, this.jackpotPool);
      this.winningCard = pickWinningCardWithUserBias(
        interMode,
        policyBets,
        userBiases,
        recentWins,
        engagement,
      );
      const winIdx = (this.winningCard ?? 1) - 1;
      const profits = houseProfitByCard(authBets);
      const expectedHouse = profits[winIdx] ?? 0;
      this.snapshotRoundTopWinners();
      const modeLabel =
        storedMode === "all"
          ? `ALL→${interMode}`
          : isPackMode(storedMode)
            ? `${storedMode.toUpperCase()}→${interMode}`
            : interMode;
      const biasNote =
        userBiases.length > 0
          ? ` · userBias[${userBiases.map((b) => b.mode).join(",")}]`
          : "";
      this.pushLog({
        botId: "system",
        botName: "System",
        cardId: this.winningCard,
        amount: 0,
        action: "round_reset",
        message:
          `Khóa cược — lá thắng #${this.winningCard} (Inter: ${modeLabel}` +
          (isPolicyMode(interMode)
            ? ` · authStake ${authStake} · appProfit ~${Math.round(expectedHouse)}`
            : "") +
          `${biasNote})`,
      });
      if (
        isPolicyMode(interMode) ||
        storedMode === "all" ||
        isPackMode(storedMode) ||
        userBiases.length
      ) {
        console.log(
          `[inter:${modeLabel}] win=#${this.winningCard} authBets=[${authBets.join(",")}] profits=[${profits.map((p) => Math.round(p)).join(",")}] → house~${Math.round(expectedHouse)}${biasNote}`,
        );
      }
      this.emitToAll();
      return;
    }

    if (this.phase === "revealing") {
      this.phase = "payout";
      this.phaseEndsAt = Date.now() + PHASE_MS.payout;
      this.applyPayouts();
      if (this.winningCard != null) {
        this.history.unshift({ round: this.roundNumber, win: this.winningCard });
        if (this.history.length > HISTORY_LIMIT) this.history.pop();
        this.saveHistoryToDisk();
      }
      this.emitToAll();
      return;
    }

    // Kết thúc payout → ván mới. Hết ngày UTC thì về #1, không +1 thêm.
    const rolled = this.ensureRoundDay();
    if (!rolled) this.roundNumber += 1;
    this.saveHistoryToDisk();
    this.resetBettingPhase();
    this.emitToAll();
  }

  private snapshotRoundTopWinners() {
    if (this.winningCard == null) {
      this.roundTopWinnersRaw = [];
      return;
    }
    const card = getCard(this.winningCard);
    if (!card) {
      this.roundTopWinnersRaw = [];
      return;
    }

    const rows: typeof this.roundTopWinnersRaw = [];
    for (const player of this.players.values()) {
      const stake = player.bets.get(this.winningCard) ?? 0;
      if (stake <= 0) continue;
      const payout = stake * card.multiplier;
      rows.push({
        playerId: player.id,
        userId: player.userId,
        name: player.name,
        profit: payout - stake,
        payout,
        stake,
        winningCardId: this.winningCard,
        isBot: false,
      });
    }
    // Bot thắng cũng vào top ván (cùng list người chơi)
    for (const bot of this.activeBots) {
      const stake = this.botStakeOnCard(bot.id, this.winningCard);
      if (stake <= 0) continue;
      const payout = stake * card.multiplier;
      rows.push({
        playerId: bot.id,
        name: bot.name,
        profit: payout - stake,
        payout,
        stake,
        winningCardId: this.winningCard,
        isBot: true,
      });
    }
    rows.sort((a, b) => b.profit - a.profit);
    this.roundTopWinnersRaw = rows.slice(0, 3);
  }

  private applyPayouts() {
    if (this.winningCard == null) return;
    const card = getCard(this.winningCard);
    if (!card) return;

    const winners: typeof this.lastRoundWinners = [];

    const payHuman = (player: PlayerSession) => {
      this.ensureDay(player);
      const stake = player.bets.get(this.winningCard!) ?? 0;
      if (stake <= 0) return;
      const payout = stake * card!.multiplier;
      const profit = payout - stake;
      player.balance += payout;
      player.winToday += profit;

      const chosenCards: { cardId: number; amount: number }[] = [];
      for (const [cardId, amount] of player.bets.entries()) {
        if (amount > 0) chosenCards.push({ cardId, amount });
      }
      chosenCards.sort((a, b) => a.cardId - b.cardId);

      winners.push({
        playerId: player.id,
        userId: player.userId,
        name: player.name,
        profit,
        payout,
        stake,
        winningCardId: this.winningCard!,
        round: this.roundNumber,
        chosenCards,
      });
      if (player.userId) {
        vaultStore.recordPayoutOut(payout, player.name, player.userId);
        authStore.syncPlayStats(
          player.userId,
          player.balance,
          player.winToday,
          player.guessesToday,
          player.stakeWeek,
        );
      }
    };

    for (const player of this.players.values()) payHuman(player);
    for (const player of this.orphans.values()) {
      payHuman(player);
      this.syncUser(player);
    }

    for (const bot of this.activeBots) {
      this.ensureBotDay(bot);
      const stake = this.botStakeOnCard(bot.id, this.winningCard);
      if (stake <= 0) continue;
      const payout = stake * card.multiplier;
      const profit = payout - stake;
      bot.winToday += profit;
      winners.push({
        playerId: bot.id,
        name: bot.name,
        profit,
        payout,
        stake,
        winningCardId: this.winningCard,
        round: this.roundNumber,
        chosenCards: this.botChosenCards(bot.id),
      });
      this.pushLog({
        botId: bot.id,
        botName: bot.name,
        cardId: this.winningCard,
        amount: profit,
        action: "round_reset",
        message: `${bot.name} thắng +${profit} xu (cược ${stake} → nhận ${payout})`,
      });
    }

    winners.sort((a, b) => b.profit - a.profit);
    // Top 3 vòng trước — chỉ người thật (bot không lên Cao thủ)
    this.lastRoundWinners = winners
      .filter((w) => !isBotPlayerId(w.playerId))
      .slice(0, 3);

    const betRows: Parameters<typeof betStore.recordRoundBets>[0] = [];
    const recordBets = (player: PlayerSession) => {
      if (!player.userId) return;
      for (const [cardId, amount] of player.bets.entries()) {
        if (amount <= 0) continue;
        const isWin = cardId === this.winningCard;
        const payout = isWin ? amount * card.multiplier : 0;
        betRows.push({
          userId: player.userId,
          username: player.name,
          round: this.roundNumber,
          cardId,
          amount,
          result: isWin ? "win" : "lose",
          payout,
          profit: isWin ? payout - amount : -amount,
          winningCardId: this.winningCard!,
        });
      }
    };
    for (const player of this.players.values()) recordBets(player);
    for (const player of this.orphans.values()) recordBets(player);
    if (betRows.length > 0) {
      betStore.recordRoundBets(betRows);
    }

    // +1 ván lifetime nếu user đã đặt ít nhất 1 lá trong round
    const counted = new Set<string>();
    const countRound = (player: PlayerSession) => {
      if (!player.userId || counted.has(player.userId)) return;
      let hasBet = false;
      for (const amount of player.bets.values()) {
        if (amount > 0) {
          hasBet = true;
          break;
        }
      }
      if (!hasBet) return;
      counted.add(player.userId);
      authStore.recordRoundPlayed(player.userId);
    };
    for (const player of this.players.values()) countRound(player);
    for (const player of this.orphans.values()) countRound(player);

    for (const player of this.players.values()) {
      this.settleTarotStreaksForPlayer(player);
    }
    for (const player of this.orphans.values()) {
      this.settleTarotStreaksForPlayer(player);
    }
    this.tryJackpotBonus();
    this.saveHistoryToDisk();

    for (const player of this.players.values()) {
      this.syncUser(player);
    }
  }

  private resetBettingPhase() {
    this.phase = "betting";
    this.phaseEndsAt = Date.now() + PHASE_MS.betting;
    this.winningCard = null;
    this.realBets = new Array(CARDS.length).fill(0);
    this.realBettors = new Array(CARDS.length).fill(0);
    this.botBets = new Array(CARDS.length).fill(0);
    this.botBettors = new Array(CARDS.length).fill(0);
    this.botRoundBets.clear();
    this.orphans.clear();
    for (const p of this.players.values()) {
      p.bets.clear();
    }
    this.scaleBots();
    const chasers = this.activeBots.filter((b) => b.isChaser).length;
    this.pushLog({
      botId: "system",
      botName: "System",
      cardId: 0,
      amount: 0,
      action: "round_reset",
      message: `Ván #${this.roundNumber} — ${this.activeBots.length} bot (${chasers} dí cầu)`,
    });
    this.scheduleBotBets(false);
  }

  private scaleBots() {
    const n = Math.max(MIN_BOTS, Math.min(MAX_BOTS, this.targetBotCount));
    // Pool đã gắn 2 bot đầu là chaser — slice giữ họ khi n ≥ 2
    this.activeBots = this.identityPool.slice(0, n);
  }

  private scheduleBotBets(appendOnly: boolean) {
    if (!appendOnly) this.botSchedule = [];
    if (this.activeBots.length === 0) return;

    const start = Date.now();
    const remaining = Math.max(0, this.phaseEndsAt - start);
    const windowStart = Math.min(800, remaining * 0.08);
    const windowEnd = Math.max(windowStart + 400, remaining - 800);
    if (windowEnd <= windowStart) return;

    const normals = this.activeBots.filter((b) => !b.isChaser);
    const chasers = this.activeBots.filter((b) => b.isChaser).slice(0, CHASER_BOT_COUNT);

    // Bot thường — mỗi bot 1–4 lệnh, mệnh giá ngẫu nhiên, rải thời gian
    if (normals.length > 0) {
      for (const bot of normals) {
        const nBets = randomBotBetsPerRound();
        for (let j = 0; j < nBets; j++) {
          const t =
            start +
            windowStart +
            ((j + Math.random() * 0.85) / Math.max(1, nBets)) *
              (windowEnd - windowStart);
          this.botSchedule.push({
            at: t,
            botId: bot.id,
            cardId: randomCardId(),
            amount: randomBotBetAmount(),
          });
        }
      }
    }

    // Luôn có tối đa 2 bot dí cầu lớn — vào muộn hơn để “soi” pool
    if (chasers.length > 0) {
      const chaseStart = start + remaining * 0.28;
      const chaseEnd = start + Math.max(remaining * 0.28 + 600, remaining - 1200);
      const chaseWindow = Math.max(400, chaseEnd - chaseStart);
      const betsPerChaser = 2 + Math.floor(Math.random() * 3);
      for (const bot of chasers) {
        for (let i = 0; i < betsPerChaser; i++) {
          const t = chaseStart + ((i + 0.15 + Math.random() * 0.7) / betsPerChaser) * chaseWindow;
          this.botSchedule.push({
            at: Math.min(t, start + remaining - 400),
            botId: bot.id,
            cardId: 0,
            amount: randomChaserBetAmount(),
            chase: true,
          });
        }
      }
    }

    // Ít bot (vault mode): mỗi bot ít nhất 1 lệnh cược/ván
    if (this.activeBots.length <= 2) {
      const scheduled = new Set(this.botSchedule.map((j) => j.botId));
      for (const bot of this.activeBots) {
        if (scheduled.has(bot.id)) continue;
        this.botSchedule.push({
          at: start + windowStart + 200 + Math.random() * 400,
          botId: bot.id,
          cardId: randomCardId(),
          amount: Math.max(MIN_BET, randomBotBetAmount()),
        });
      }
    }

    this.botSchedule.sort((a, b) => a.at - b.at);
  }

  /** Chọn lá đang có tổng stake lớn nhất (ưu tiên top 1–2). */
  private pickChaseCardId(): number {
    const ranked = this.realBets
      .map((real, i) => ({
        cardId: i + 1,
        amount: real + this.botBets[i]!,
      }))
      .sort((a, b) => b.amount - a.amount);

    const top = ranked[0];
    if (!top || top.amount <= 0) return randomCardId();

    const second = ranked[1];
    if (second && second.amount > 0 && Math.random() < 0.32) {
      return second.cardId;
    }
    return top.cardId;
  }

  private processBotSchedule(now: number) {
    while (this.botSchedule.length && this.botSchedule[0]!.at <= now) {
      const job = this.botSchedule.shift()!;
      const bot = this.activeBots.find((b) => b.id === job.botId);
      if (!bot) continue;

      let map = this.botRoundBets.get(bot.id);
      if (!map) {
        map = new Map();
        this.botRoundBets.set(bot.id, map);
      }

      let cardId = job.chase ? this.pickChaseCardId() : job.cardId;
      if (!cardId || cardId < 1 || cardId > CARDS.length) cardId = randomCardId();

      const prevOnCard = map.get(cardId) ?? 0;
      if (prevOnCard <= 0) {
        let distinct = 0;
        for (const v of map.values()) {
          if (v > 0) distinct += 1;
        }
        if (distinct >= MAX_CARDS_PER_ROUND) {
          // Đã đủ 5 lá — cộng thêm vào 1 lá đã đặt thay vì mở lá mới
          const existing = [...map.entries()].filter(([, v]) => v > 0);
          if (existing.length === 0) continue;
          if (job.chase) {
            // Dí cầu: ưu tiên lá đã đặt nếu đang nằm trong top stake
            const topId = this.pickChaseCardId();
            const hit = existing.find(([id]) => id === topId);
            cardId = hit ? hit[0] : existing[Math.floor(Math.random() * existing.length)]![0];
          } else {
            cardId = existing[Math.floor(Math.random() * existing.length)]![0];
          }
        }
      }

      const prev = map.get(cardId) ?? 0;
      const room = MAX_BET - prev;
      if (room < MIN_BET) continue;
      const betAmt = Math.min(job.amount, room);
      if (betAmt < MIN_BET) continue;

      const idx = cardId - 1;
      this.botBets[idx]! += betAmt;
      this.botBettors[idx]! += 1;

      map.set(cardId, prev + betAmt);
      this.ensureBotDay(bot);
      this.ensureBotWeek(bot);
      bot.guessesToday += 1;
      bot.stakeWeek += betAmt;

      const card = getCard(cardId);
      this.pushLog({
        botId: bot.id,
        botName: bot.name,
        cardId,
        amount: betAmt,
        action: "bet",
        message: job.chase
          ? `${bot.name} dí cầu ${betAmt.toLocaleString("vi-VN")} xu → ${card?.nameVi ?? `#${cardId}`}`
          : `${bot.name} đặt ${betAmt.toLocaleString("vi-VN")} xu → ${card?.nameVi ?? `#${cardId}`}`,
      });
    }
  }

  private pushLog(
    partial: Omit<BotLogEntry, "id" | "at" | "round"> & { at?: number },
  ) {
    this.botLogSeq += 1;
    this.botLogs.unshift({
      id: `log-${this.botLogSeq}`,
      at: partial.at ?? Date.now(),
      round: this.roundNumber,
      botId: partial.botId,
      botName: partial.botName,
      cardId: partial.cardId,
      amount: partial.amount,
      action: partial.action,
      message: partial.message,
    });
    if (this.botLogs.length > BOT_LOG_LIMIT) {
      this.botLogs.length = BOT_LOG_LIMIT;
    }
  }
}

export { CARDS };
