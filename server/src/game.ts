import { authStore } from "./auth.js";
import { CARDS, getCard, pickWinningCard } from "./cards.js";
import {
  createIdentityPool,
  randomBotBetAmount,
  randomCardId,
  type BotIdentity,
} from "./bots.js";
import {
  BOT_LOG_LIMIT,
  HISTORY_LIMIT,
  LEADERBOARD_LIMIT,
  MAX_BET,
  MAX_BOTS,
  MAX_CARDS_PER_ROUND,
  MIN_BET,
  MIN_BOTS,
  PHASE_MS,
  STARTING_BALANCE,
  TARGET_DISPLAY_CCU,
  todayKey,
  type BotLogEntry,
  type BotPanelState,
  type BotPublic,
  type LeaderboardEntry,
  type Phase,
  type PlayerSession,
  type PublicState,
  type RoundResult,
  type RoundTopWinner,
  type TopAcePreview,
} from "./types.js";

type BroadcastFn = (state: PublicState, playerId?: string) => void;

function maskName(name: string): string {
  if (name.length <= 3) return `${name[0]}***`;
  return `${name.slice(0, 2)}***${name.slice(-1)}`;
}

interface BotJob {
  at: number;
  botId: string;
  cardId: number;
  amount: number;
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
  private vipPool = 126_938;
  private vipBase = 126_938;
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
  }

  start() {
    this.resetBettingPhase();
    this.tickTimer = setInterval(() => this.tick(), 250);
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  join(
    socketId: string,
    opts?: { name?: string; userId?: string },
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
      balance: linked?.balance ?? STARTING_BALANCE,
      bets: new Map(),
      guessesToday: linked?.guessesToday ?? 0,
      winToday: linked?.winToday ?? 0,
      dayKey: todayKey(),
    };
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

  private syncUser(session: PlayerSession) {
    if (!session.userId) return;
    authStore.syncPlayStats(
      session.userId,
      session.balance,
      session.winToday,
      session.guessesToday,
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
    if (!Number.isFinite(amt) || amt < MIN_BET || amt > MAX_BET || amt % 100 !== 0) {
      return { ok: false, reason: "Số xu không hợp lệ" };
    }

    const player = this.players.get(socketId);
    if (!player) return { ok: false, reason: "Chưa vào phòng" };

    this.ensureDay(player);

    if (player.balance < amt) {
      return { ok: false, reason: "Số dư không đủ" };
    }

    const prev = player.bets.get(cardId) ?? 0;
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
    this.realBets[idx] += amt;
    if (prev === 0) this.realBettors[idx] += 1;

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
      return { id: p.id, name: p.name, winToday: p.winToday, dayKey: p.dayKey };
    });
    const botRows = this.activeBots.map((b) => {
      this.ensureBotDay(b);
      return { id: b.id, name: b.name, winToday: b.winToday, dayKey: b.dayKey };
    });

    const rows = [...humanRows, ...botRows]
      .filter((p) => p.dayKey === day && p.winToday > 0)
      .sort((a, b) => b.winToday - a.winToday)
      .slice(0, LEADERBOARD_LIMIT);

    return rows.map((p, i) => ({
      rank: i + 1,
      name: p.id === viewerId ? p.name : maskName(p.name),
      avatar: "/assets/ui/avatar-default.png",
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
        name: w.playerId === viewerId ? w.name : maskName(w.name),
        avatar: "/assets/ui/avatar-default.png",
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
      name: w.playerId === viewerId ? w.name : maskName(w.name),
      avatar: "/assets/ui/avatar-default.png",
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
      vipPool: Math.round(this.vipPool),
      botPanel: this.getBotPanel(),
    };

    if (playerId) {
      const p = this.players.get(playerId);
      if (p) {
        this.ensureDay(p);
        base.yourBalance = p.balance;
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

  private ensureBotDay(bot: BotIdentity) {
    const key = todayKey();
    if (bot.dayKey !== key) {
      bot.dayKey = key;
      bot.guessesToday = 0;
      bot.winToday = 0;
    }
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
    const target = this.vipBase + displaySum * 0.35 + this.activeBots.length * 120;
    const delta = (target - this.vipPool) * 0.08 + (Math.random() - 0.45) * 900;
    this.vipPool = Math.max(80_000, Math.min(2_500_000, this.vipPool + delta));
  }

  private advancePhase() {
    if (this.phase === "betting") {
      this.phase = "revealing";
      this.phaseEndsAt = Date.now() + PHASE_MS.revealing;
      this.winningCard = pickWinningCard();
      this.snapshotRoundTopWinners();
      this.pushLog({
        botId: "system",
        botName: "System",
        cardId: this.winningCard,
        amount: 0,
        action: "round_reset",
        message: `Khóa cược — lá thắng (weighted): #${this.winningCard}`,
      });
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
      }
      this.emitToAll();
      return;
    }

    this.roundNumber += 1;
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
    this.pushLog({
      botId: "system",
      botName: "System",
      cardId: 0,
      amount: 0,
      action: "round_reset",
      message: `Ván #${this.roundNumber} — ${this.activeBots.length} bot sẵn sàng`,
    });
    this.scheduleBotBets(false);
  }

  private scaleBots() {
    const n = Math.max(MIN_BOTS, Math.min(MAX_BOTS, this.targetBotCount));
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

    const betCount = Math.max(this.activeBots.length, this.activeBots.length * 2);

    for (let i = 0; i < betCount; i++) {
      const bot = this.activeBots[i % this.activeBots.length];
      const t = start + windowStart + Math.random() * (windowEnd - windowStart);
      this.botSchedule.push({
        at: t,
        botId: bot.id,
        cardId: randomCardId(),
        amount: randomBotBetAmount(),
      });
    }
    this.botSchedule.sort((a, b) => a.at - b.at);
  }

  private processBotSchedule(now: number) {
    while (this.botSchedule.length && this.botSchedule[0].at <= now) {
      const job = this.botSchedule.shift()!;
      const bot = this.activeBots.find((b) => b.id === job.botId);
      if (!bot) continue;

      let map = this.botRoundBets.get(bot.id);
      if (!map) {
        map = new Map();
        this.botRoundBets.set(bot.id, map);
      }

      let cardId = job.cardId;
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
          cardId = existing[Math.floor(Math.random() * existing.length)][0];
        }
      }

      const idx = cardId - 1;
      this.botBets[idx] += job.amount;
      this.botBettors[idx] += 1;

      const prev = map.get(cardId) ?? 0;
      map.set(cardId, prev + job.amount);
      this.ensureBotDay(bot);
      bot.guessesToday += 1;

      const card = getCard(cardId);
      this.pushLog({
        botId: bot.id,
        botName: bot.name,
        cardId,
        amount: job.amount,
        action: "bet",
        message: `${bot.name} đặt ${job.amount} xu → ${card?.nameVi ?? `#${cardId}`}`,
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
