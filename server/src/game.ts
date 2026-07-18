import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { authStore } from "./auth.js";
import { DEFAULT_AVATAR, normalizeAvatar } from "./avatars.js";
import { betStore } from "./betStore.js";
import {
  CARDS,
  getCard,
  houseProfitByCard,
  pickWinningCard,
} from "./cards.js";
import { interStore, isPolicyMode } from "./interStore.js";
import {
  CHASER_BOT_COUNT,
  createIdentityPool,
  randomBotBetAmount,
  randomCardId,
  randomChaserBetAmount,
  type BotIdentity,
} from "./bots.js";
import { vaultStore } from "./vaultStore.js";
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
  type Phase,
  type PlayerSession,
  type PublicState,
  type RoundResult,
  type RoundTopWinner,
  type TarotStarEntry,
  type TopAcePreview,
} from "./types.js";

type BroadcastFn = (state: PublicState, playerId?: string) => void;

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
  version: 1 | 2;
  nextRound: number;
  history: RoundResult[];
  vipPool?: number;
  vipBase?: number;
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
  private winningCard: number | null = null;
  private history: RoundResult[] = [];

  private players = new Map<string, PlayerSession>();
  private realBets = new Array(8).fill(0) as number[];
  private realBettors = new Array(8).fill(0) as number[];
  private botBets = new Array(8).fill(0) as number[];
  private botBettors = new Array(8).fill(0) as number[];

  private identityPool = createIdentityPool(50);
  /** Số bot mong muốn (user chỉnh được) */
  private targetBotCount = TARGET_DISPLAY_CCU;
  private activeBots: BotIdentity[] = [];
  /** botId -> cardId -> amount */
  private botRoundBets = new Map<string, Map<number, number>>();
  private botSchedule: BotJob[] = [];
  private botLogs: BotLogEntry[] = [];
  private botLogSeq = 0;
  private lastBotScaleAt = 0;
  private lastBroadcastAt = 0;
  private lastVipJitterAt = 0;
  /** Quỹ VIP cosmetic */
  private vipPool = 12_694;
  private vipBase = 12_694;
  /** Người thắng vòng trước (snapshot lúc payout) */
  private lastRoundWinners: {
    playerId: string;
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
    name: string;
    profit: number;
    payout: number;
    stake: number;
    winningCardId: number;
    isBot: boolean;
  }[] = [];

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private broadcast: BroadcastFn;

  constructor(broadcast: BroadcastFn) {
    this.broadcast = broadcast;
    this.loadHistoryFromDisk();
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
        (parsed?.version !== 1 && parsed?.version !== 2) ||
        !Array.isArray(parsed.history)
      ) {
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
      if (Array.isArray(parsed.lastRoundWinners)) {
        this.lastRoundWinners = parsed.lastRoundWinners
          .filter(
            (w) =>
              w &&
              typeof w.name === "string" &&
              typeof w.profit === "number" &&
              typeof w.payout === "number",
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
        `[game] Loaded ${this.history.length} results · next round #${this.roundNumber} · vip ${Math.round(this.vipPool)}`,
      );
    } catch (err) {
      console.warn("[game] Failed to load history.json:", err);
    }
  }

  private saveHistoryToDisk() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: HistoryFile = {
        version: 2,
        nextRound: this.roundNumber,
        history: this.history.slice(0, HISTORY_LIMIT),
        vipPool: this.vipPool,
        vipBase: this.vipBase,
        lastRoundWinners: this.lastRoundWinners.slice(0, 3),
      };
      writeFileSync(HISTORY_TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(HISTORY_TMP, HISTORY_PATH);
    } catch (err) {
      console.warn("[game] Failed to save history.json:", err);
    }
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  join(
    socketId: string,
    opts?: { name?: string; userId?: string; avatar?: string },
  ): PlayerSession {
    const existing = this.players.get(socketId);
    if (existing) return existing;

    const linked = opts?.userId ? authStore.getById(opts.userId) : undefined;
    const session: PlayerSession = {
      id: socketId,
      userId: linked?.id,
      name: (
        linked?.username ||
        opts?.name?.trim() ||
        `Khach${Math.floor(Math.random() * 9000) + 1000}`
      ).slice(0, 20),
      avatar:
        normalizeAvatar(linked?.avatar) ||
        normalizeAvatar(opts?.avatar) ||
        DEFAULT_AVATAR,
      balance: linked?.balance ?? STARTING_BALANCE,
      bets: new Map(),
      guessesToday: linked?.guessesToday ?? 0,
      winToday: linked?.winToday ?? 0,
      dayKey: todayKey(),
      stakeWeek: linked?.stakeWeek ?? 0,
      weekKey: linked?.weekKey ?? weekKey(),
    };
    this.ensureWeek(session);
    this.players.set(socketId, session);
    this.emitToAll();
    return session;
  }

  leave(socketId: string) {
    const session = this.players.get(socketId);
    if (session?.userId) {
      authStore.syncPlayStats(
        session.userId,
        session.balance,
        session.winToday,
        session.guessesToday,
        session.stakeWeek,
      );
    }
    this.players.delete(socketId);
    this.scaleBots();
    this.emitToAll();
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
    const bets = new Array(8).fill(0) as number[];
    for (const p of this.players.values()) {
      if (!p.userId) continue;
      for (const [cardId, amt] of p.bets.entries()) {
        if (amt > 0) bets[cardId - 1]! += amt;
      }
    }
    return bets;
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
  ): { ok: true; balance: number } | { ok: false; reason: string } {
    if (this.phase !== "betting") {
      return { ok: false, reason: "Đã hết giờ đặt cược" };
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
        reason: `Số xu không hợp lệ (tối đa ${MAX_BET.toLocaleString("vi-VN")} / 1 cầu)`,
      };
    }

    const player = this.players.get(socketId);
    if (!player) return { ok: false, reason: "Chưa vào phòng" };

    this.ensureDay(player);
    this.ensureWeek(player);

    if (player.balance < amt) {
      return { ok: false, reason: "Số dư không đủ" };
    }

    const prev = player.bets.get(cardId) ?? 0;
    if (prev + amt > MAX_BET) {
      return {
        ok: false,
        reason: `Mỗi cầu tối đa ${MAX_BET.toLocaleString("vi-VN")} xu (đã đặt ${prev.toLocaleString("vi-VN")})`,
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

  getHistory(limit = HISTORY_LIMIT): RoundResult[] {
    return this.history.slice(0, Math.min(limit, HISTORY_LIMIT));
  }

  getLeaderboard(viewerId?: string): LeaderboardEntry[] {
    const day = todayKey();
    const humanRows = [...this.players.values()].map((p) => {
      this.ensureDay(p);
      return {
        id: p.id,
        name: p.name,
        avatar: normalizeAvatar(p.avatar),
        winToday: p.winToday,
        dayKey: p.dayKey,
      };
    });
    const botRows = this.activeBots.map((b) => {
      this.ensureBotDay(b);
      return {
        id: b.id,
        name: b.name,
        avatar: normalizeAvatar(b.avatar),
        winToday: b.winToday,
        dayKey: b.dayKey,
      };
    });

    const rows = [...humanRows, ...botRows]
      .filter((p) => p.dayKey === day && p.winToday > 0)
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
    return this.lastRoundWinners.map((w, i) => {
      // Người / bot thắng vòng trước — hiện lá đang cược ván này nếu có
      const live = this.players.get(w.playerId);
      const currentPicks: { cardId: number; amount: number }[] = [];
      if (live) {
        for (const [cardId, amount] of live.bets.entries()) {
          if (amount > 0) currentPicks.push({ cardId, amount });
        }
        currentPicks.sort((a, b) => a.cardId - b.cardId);
      } else {
        const botMap = this.botRoundBets.get(w.playerId);
        if (botMap) {
          for (const [cardId, amount] of botMap.entries()) {
            if (amount > 0) currentPicks.push({ cardId, amount });
          }
          currentPicks.sort((a, b) => a.cardId - b.cardId);
        }
      }

      return {
        rank: i + 1,
        name: w.name,
        avatar: this.resolveAvatar(w.playerId),
        // Thưởng vòng trước = số xu nhận từ lá thắng (stake × hệ số)
        winToday: w.payout,
        isYou: w.playerId === viewerId,
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
    return this.roundTopWinnersRaw.map((w, i) => ({
      rank: i + 1,
      name: w.name,
      avatar: this.resolveAvatar(w.playerId),
      profit: w.profit,
      stake: w.stake,
      payout: w.payout,
      winningCardId: w.winningCardId,
      isYou: w.playerId === viewerId,
      isBot: w.isBot,
    }));
  }

  getStateFor(playerId?: string): PublicState {
    const displayBets = this.realBets.map((v, i) => v + this.botBets[i]);
    const playerCounts = this.realBettors.map((v, i) => v + this.botBettors[i]);
    const onlineReal = this.players.size;
    const onlineDisplay = onlineReal + this.activeBots.length;

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
      onlineReal,
      onlineDisplay,
      topAces: this.getTopAces(playerId),
      roundTopWinners: this.getRoundTopWinners(playerId),
      tarotStars: this.getTarotStars(playerId),
      vipPool: Math.round(this.vipPool),
      botPanel: this.getBotPanel(),
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

    for (const b of this.activeBots) {
      this.ensureBotWeek(b);
      if (b.weekKey !== wk || b.stakeWeek <= 0) continue;
      byKey.set(b.id, {
        key: b.id,
        name: b.name,
        avatar: normalizeAvatar(b.avatar),
        stakeWeek: b.stakeWeek,
      });
    }

    return [...byKey.values()]
      .sort((a, b) => b.stakeWeek - a.stakeWeek)
      .slice(0, LEADERBOARD_LIMIT)
      .map((row, i) => ({
        rank: i + 1,
        name: row.name,
        avatar: row.avatar,
        stakeWeek: row.stakeWeek,
        isYou: row.socketId === viewerId,
      }));
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

  private emitToAll() {
    for (const id of this.players.keys()) {
      this.broadcast(this.getStateFor(id), id);
    }
    this.broadcast(this.getStateFor(), undefined);
  }

  private tick() {
    const now = Date.now();

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

    if (now >= this.phaseEndsAt) {
      this.advancePhase();
      return;
    }

    if (now - this.lastBroadcastAt >= 500) {
      this.lastBroadcastAt = now;
      this.emitToAll();
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
      const interMode = interStore.getMode();
      const authBets = this.getAuthBets();
      const policyBets = isPolicyMode(interMode) ? authBets : this.realBets;
      this.winningCard = pickWinningCard(interMode, policyBets);
      const winIdx = (this.winningCard ?? 1) - 1;
      const profits = houseProfitByCard(authBets);
      const expectedHouse = profits[winIdx] ?? 0;
      const authStake = authBets.reduce((a, b) => a + b, 0);
      this.snapshotRoundTopWinners();
      this.pushLog({
        botId: "system",
        botName: "System",
        cardId: this.winningCard,
        amount: 0,
        action: "round_reset",
        message:
          `Khóa cược — lá thắng #${this.winningCard} (Inter: ${interMode}` +
          (isPolicyMode(interMode)
            ? ` · authStake ${authStake} · appProfit ~${Math.round(expectedHouse)}`
            : "") +
          `)`,
      });
      if (isPolicyMode(interMode)) {
        console.log(
          `[inter:${interMode}] win=#${this.winningCard} authBets=[${authBets.join(",")}] profits=[${profits.map((p) => Math.round(p)).join(",")}] → house~${Math.round(expectedHouse)}`,
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

    this.roundNumber += 1;
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

    for (const player of this.players.values()) {
      this.ensureDay(player);
      const stake = player.bets.get(this.winningCard) ?? 0;
      if (stake > 0) {
        const payout = stake * card.multiplier;
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
          name: player.name,
          profit,
          payout,
          stake,
          winningCardId: this.winningCard,
          round: this.roundNumber,
          chosenCards,
        });
        if (player.userId) {
          vaultStore.recordPayoutOut(payout, player.name, player.userId);
        }
      }
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
    // Top 3 thắng vòng trước (người + bot) — hiện ở "Cao thủ dự đoán"
    this.lastRoundWinners = winners.slice(0, 3);

    const betRows: Parameters<typeof betStore.recordRoundBets>[0] = [];
    for (const player of this.players.values()) {
      if (!player.userId) continue;
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
          winningCardId: this.winningCard,
        });
      }
    }
    if (betRows.length > 0) {
      betStore.recordRoundBets(betRows);
    }

    for (const player of this.players.values()) {
      this.syncUser(player);
    }
  }

  private resetBettingPhase() {
    this.phase = "betting";
    this.phaseEndsAt = Date.now() + PHASE_MS.betting;
    this.winningCard = null;
    this.realBets = new Array(8).fill(0);
    this.realBettors = new Array(8).fill(0);
    this.botBets = new Array(8).fill(0);
    this.botBettors = new Array(8).fill(0);
    this.botRoundBets.clear();
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

    // Bot thường — rải đều trong cửa sổ đặt cược
    if (normals.length > 0) {
      const betCount = Math.max(normals.length, normals.length * 2);
      for (let i = 0; i < betCount; i++) {
        const bot = normals[i % normals.length]!;
        const t = start + windowStart + Math.random() * (windowEnd - windowStart);
        this.botSchedule.push({
          at: t,
          botId: bot.id,
          cardId: randomCardId(),
          amount: randomBotBetAmount(),
        });
      }
    }

    // Luôn có tối đa 2 bot dí cầu lớn — vào muộn hơn để “soi” pool
    if (chasers.length > 0) {
      const chaseStart = start + remaining * 0.28;
      const chaseEnd = start + Math.max(remaining * 0.28 + 600, remaining - 1200);
      const chaseWindow = Math.max(400, chaseEnd - chaseStart);
      const betsPerChaser = 4;
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
      if (!cardId || cardId < 1 || cardId > 8) cardId = randomCardId();

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
          ? `${bot.name} dí cầu lớn ${betAmt} xu → ${card?.nameVi ?? `#${cardId}`}`
          : `${bot.name} đặt ${betAmt} xu → ${card?.nameVi ?? `#${cardId}`}`,
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
