import cors from "cors";
import express from "express";
import { existsSync } from "fs";
import { createServer } from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { authStore, isMainAdmin, isStaff } from "./auth.js";
import { AVATARS } from "./avatars.js";
import { betStore } from "./betStore.js";
import { couponStore } from "./couponStore.js";
import { cardProbabilities } from "./cards.js";
import { CARDS, GameEngine } from "./game.js";
import { interStore, isInterMode } from "./interStore.js";
import type { PublicState } from "./types.js";
import { vaultStore } from "./vaultStore.js";

const PORT = Number(process.env.PORT) || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = join(__dirname, "..", "..", "client", "dist");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true },
});

const engine = new GameEngine((state: PublicState, playerId?: string) => {
  if (playerId) {
    io.to(playerId).emit("state", state);
  } else {
    io.emit("roomState", {
      phase: state.phase,
      phaseEndsAt: state.phaseEndsAt,
      serverTime: state.serverTime,
      roundNumber: state.roundNumber,
      roundId: state.roundId,
      displayBets: state.displayBets,
      playerCounts: state.playerCounts,
      history: state.history,
      winningCard: state.winningCard,
      onlineDisplay: state.onlineDisplay,
      topAces: state.topAces,
      roundTopWinners: state.roundTopWinners,
      tarotStars: state.tarotStars,
      vipPool: state.vipPool,
    });
  }
});

function bearer(req: express.Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

function requireAuth(
  req: express.Request,
  res: express.Response,
): ReturnType<typeof authStore.resolveToken> {
  const user = authStore.resolveToken(bearer(req));
  if (!user) {
    res.status(401).json({ ok: false, reason: "Chưa đăng nhập" });
    return null;
  }
  return user;
}

function requireAdmin(
  req: express.Request,
  res: express.Response,
): ReturnType<typeof authStore.resolveToken> {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!isStaff(user)) {
    res.status(403).json({ ok: false, reason: "Chỉ admin" });
    return null;
  }
  return user;
}

function requireMainAdmin(
  req: express.Request,
  res: express.Response,
): ReturnType<typeof authStore.resolveToken> {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!isMainAdmin(user)) {
    res.status(403).json({ ok: false, reason: "Chỉ mainadmin" });
    return null;
  }
  return user;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, cards: CARDS.length });
});
app.get("/api/cards", (_req, res) => {
  res.json(CARDS);
});
app.get("/api/history", (req, res) => {
  const limit = Number(req.query.limit) || 30;
  res.json(engine.getHistory(limit));
});
app.get("/api/leaderboard", (_req, res) => {
  res.json(engine.getLeaderboard());
});

app.post("/api/auth/register", (req, res) => {
  const result = authStore.register(
    String(req.body?.username ?? ""),
    String(req.body?.password ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post("/api/auth/login", (req, res) => {
  const result = authStore.login(
    String(req.body?.username ?? ""),
    String(req.body?.password ?? ""),
  );
  if (!result.ok) return res.status(401).json(result);
  res.json(result);
});

app.get("/api/auth/me", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json({ ok: true, user });
});

app.get("/api/auth/bets", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const limit = Math.min(80, Math.max(1, Number(req.query.limit) || 30));
  res.json({ ok: true, bets: betStore.getByUser(user.id, limit) });
});

app.get("/api/auth/avatars", (_req, res) => {
  res.json({ ok: true, avatars: AVATARS });
});

app.post("/api/auth/avatar", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = authStore.setAvatar(user.id, String(req.body?.avatar ?? ""));
  if (!result.ok) return res.status(400).json(result);
  const live = engine.applyAuthAvatar(user.id, result.user.avatar);
  for (const sid of live.socketIds) {
    io.to(sid).emit("state", engine.getStateFor(sid));
  }
  res.json(result);
});

/** User đổi mã nạp xu — không trả danh sách coupon. */
app.post("/api/auth/redeem-coupon", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const code = String(req.body?.code ?? "");
  const preview = couponStore.previewRedeem(code, user.id);
  if (!preview.ok) return res.status(400).json(preview);

  const adj = authStore.adjustBalance(user.id, preview.amount);
  if (!adj.ok) {
    return res.status(400).json({ ok: false, reason: adj.reason });
  }
  couponStore.commitRedeem(
    preview.code,
    preview.amount,
    user.id,
    user.username,
  );
  const live = engine.applyAuthBalance(user.id, adj.user.balance);
  for (const sid of live.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: live.balance });
    io.to(sid).emit("state", engine.getStateFor(sid));
  }
  res.json({
    ok: true,
    amount: preview.amount,
    user: adj.user,
    message: `Đã nạp +${preview.amount.toLocaleString("vi-VN")} xu`,
  });
});

app.get("/api/admin/overview", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const recentBets = betStore.getRecent(40);
  const history = engine.getHistory(40);
  let stakeTotal = 0;
  let payoutTotal = 0;
  let winCount = 0;
  for (const b of recentBets) {
    stakeTotal += b.amount;
    payoutTotal += b.payout;
    if (b.result === "win") winCount += 1;
  }
  const payload: Record<string, unknown> = {
    ok: true,
    me: { id: me.id, username: me.username, role: me.role },
    stats: engine.getOnlineStats(),
    users: authStore.listUsers(),
    botPanel: engine.getBotPanel(),
    history,
    recentBets,
    betStats: {
      rows: recentBets.length,
      stakeTotal,
      payoutTotal,
      winCount,
      loseCount: recentBets.length - winCount,
    },
  };
  // Coupon ẩn: chỉ staff (admin/mainadmin) thấy mã + lịch sử đổi
  payload.coupons = couponStore.listForAdmin();
  payload.couponRedemptions = couponStore.recentRedemptions(40);

  if (isMainAdmin(me)) {
    const vault = vaultStore.getSnapshot();
    const bets = betStore.getTrafficStats();
    const accounts = authStore.getAccountStats();
    const live = engine.getLiveTraffic();
    const inter = interStore.getSnapshot();
    payload.vault = vault;
    payload.inter = {
      ...inter,
      probabilities: cardProbabilities(inter.mode),
      probabilitiesByMode: {
        auto: cardProbabilities("auto"),
        small: cardProbabilities("small"),
        big: cardProbabilities("big"),
      },
    };
    payload.traffic = {
      ...live,
      ...accounts,
      ...bets,
      vaultBalance: vault.balance,
      vaultStakeIn: vault.totalStakeIn,
      vaultPayoutOut: vault.totalPayoutOut,
      vaultNetHouse: vault.netHouse,
      houseEdgeXu: vault.totalStakeIn - vault.totalPayoutOut,
      interMode: inter.mode,
    };
  }
  res.json(payload);
});

app.get("/api/mainadmin/inter", (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  const inter = interStore.getSnapshot();
  res.json({
    ok: true,
    inter: {
      ...inter,
      probabilities: cardProbabilities(inter.mode),
      probabilitiesByMode: {
        auto: cardProbabilities("auto"),
        small: cardProbabilities("small"),
        big: cardProbabilities("big"),
      },
    },
  });
});

app.post("/api/mainadmin/inter", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const mode = req.body?.mode;
  if (!isInterMode(mode)) {
    return res.status(400).json({
      ok: false,
      reason: "mode phải là auto | small | big",
    });
  }
  interStore.setMode(mode, me.username);
  const inter = interStore.getSnapshot();
  res.json({
    ok: true,
    inter: {
      ...inter,
      probabilities: cardProbabilities(inter.mode),
      probabilitiesByMode: {
        auto: cardProbabilities("auto"),
        small: cardProbabilities("small"),
        big: cardProbabilities("big"),
      },
    },
  });
});

app.get("/api/mainadmin/vault", (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  res.json({ ok: true, vault: vaultStore.getSnapshot() });
});

app.post("/api/mainadmin/vault/adjust", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const result = vaultStore.adjust(
    Number(req.body?.delta),
    me.username,
    String(req.body?.note ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true, vault: vaultStore.getSnapshot() });
});

app.post("/api/mainadmin/vault/set", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const result = vaultStore.setBalance(
    Number(req.body?.balance),
    me.username,
    String(req.body?.note ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true, vault: vaultStore.getSnapshot() });
});

app.post("/api/mainadmin/vault/grant", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  const amount = Number(req.body?.amount);
  const note = String(req.body?.note ?? "");
  const prep = vaultStore.prepareGrant(amount);
  if (!prep.ok) return res.status(400).json(prep);
  const adj = authStore.adjustBalance(userId, prep.amount);
  if (!adj.ok) return res.status(400).json(adj);
  vaultStore.commitGrant(
    prep.amount,
    me.username,
    adj.user.id,
    adj.user.username,
    note,
  );
  const live = engine.applyAuthBalance(userId, adj.user.balance);
  for (const sid of live.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: live.balance });
  }
  res.json({ ok: true, user: adj.user, vault: vaultStore.getSnapshot() });
});

app.post("/api/mainadmin/vault/seize", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  const amount = Math.floor(Number(req.body?.amount));
  const note = String(req.body?.note ?? "");
  if (!userId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId/amount" });
  }
  const adj = authStore.adjustBalance(userId, -amount);
  if (!adj.ok) return res.status(400).json(adj);
  vaultStore.commitSeize(
    amount,
    me.username,
    adj.user.id,
    adj.user.username,
    note,
  );
  const live = engine.applyAuthBalance(userId, adj.user.balance);
  for (const sid of live.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: live.balance });
  }
  res.json({ ok: true, user: adj.user, vault: vaultStore.getSnapshot() });
});

app.post("/api/admin/adjust-balance", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const userId = String(req.body?.userId ?? "");
  const delta = Number(req.body?.delta);
  if (!userId || !Number.isFinite(delta)) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId/delta" });
  }
  const result = authStore.adjustBalance(userId, delta);
  if (!result.ok) return res.status(400).json(result);
  const live = engine.applyAuthBalance(userId, result.user.balance);
  for (const sid of live.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: live.balance });
  }
  res.json(result);
});

app.post("/api/admin/bots", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = engine.setBotCount(Number(req.body?.count));
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

io.on("connection", (socket) => {
  socket.on(
    "join",
    (payload?: { name?: string; token?: string }) => {
      const authUser = authStore.resolveToken(payload?.token);
      const session = engine.join(socket.id, {
        name: payload?.name,
        userId: authUser?.id,
      });
      socket.emit("joined", {
        id: session.id,
        name: session.name,
        balance: session.balance,
        userId: session.userId,
      });
      socket.emit("state", engine.getStateFor(socket.id));
    },
  );

  socket.on(
    "placeBet",
    (
      payload: { cardId: number; amount: number; roundId?: number },
      ack?: (r: unknown) => void,
    ) => {
      const result = engine.placeBet(
        socket.id,
        Number(payload?.cardId),
        Number(payload?.amount),
      );
      if (!result.ok) {
        socket.emit("betRejected", { reason: result.reason });
        ack?.(result);
        return;
      }
      socket.emit("balanceUpdate", { balance: result.balance });
      socket.emit("state", engine.getStateFor(socket.id));
      ack?.(result);
    },
  );

  socket.on("getHistory", (payload?: { limit?: number }) => {
    socket.emit("historyData", engine.getHistory(payload?.limit ?? 30));
  });

  socket.on("getLeaderboard", () => {
    socket.emit("leaderboardData", engine.getLeaderboard(socket.id));
  });

  socket.on("getTarotStars", () => {
    socket.emit("tarotStarsData", engine.getTarotStars(socket.id));
  });

  socket.on("setBotCount", (payload: { count: number }, ack?: (r: unknown) => void) => {
    const result = engine.setBotCount(Number(payload?.count));
    if (!result.ok) {
      socket.emit("botConfigRejected", { reason: result.reason });
      ack?.(result);
      return;
    }
    socket.emit("botConfigUpdated", result);
    ack?.(result);
  });

  socket.on("getBotPanel", () => {
    socket.emit("botPanelData", engine.getBotPanel());
  });

  socket.on("disconnect", () => {
    engine.leave(socket.id);
  });
});

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get("*", (_req, res) => {
    res.sendFile(join(CLIENT_DIST, "index.html"));
  });
}

engine.start();

httpServer.listen(PORT, () => {
  console.log(`[server] Tarot demo listening on http://localhost:${PORT}`);
  if (existsSync(CLIENT_DIST)) {
    console.log(`[server] Serving client from ${CLIENT_DIST}`);
  }
});
