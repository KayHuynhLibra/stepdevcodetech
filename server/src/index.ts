import cors from "cors";
import express from "express";
import { existsSync } from "fs";
import { createServer } from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import {
  authStore,
  isMainAdmin,
  isStaff,
  isUserOutcomeMode,
} from "./auth.js";
import {
  AVATARS,
  saveUploadedAvatar,
  UPLOADS_DIR,
} from "./avatars.js";
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
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  }),
);
app.use(express.json({ limit: "1.5mb" }));
app.use("/uploads/avatars", express.static(UPLOADS_DIR));

/** Simple sliding-window rate limit (in-memory). */
const rateBuckets = new Map<string, { n: number; reset: number }>();
function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + windowMs };
    rateBuckets.set(key, b);
  }
  b.n += 1;
  return b.n <= max;
}
function clientIp(req: express.Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0]!.trim();
  return req.socket.remoteAddress || "unknown";
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin:
      ALLOWED_ORIGINS.length > 0
        ? ALLOWED_ORIGINS
        : true,
  },
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
      onlinePlayers: state.onlinePlayers,
      topAces: state.topAces,
      roundTopWinners: state.roundTopWinners,
      tarotStars: state.tarotStars,
      vipPool: state.vipPool,
      chatLines: state.chatLines,
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

function buildInterPayload() {
  const inter = interStore.getSnapshot();
  const authBets = engine.getAuthBets();
  const effective = inter.effectiveMode;
  return {
    ...inter,
    realBetsRound: engine.getRealBets(),
    authBetsRound: authBets,
    probabilities: cardProbabilities(effective, authBets),
    probabilitiesByMode: {
      auto: cardProbabilities("auto"),
      small: cardProbabilities("small"),
      big: cardProbabilities("big"),
      app: cardProbabilities("app", authBets),
      user: cardProbabilities("user", authBets),
      fed: cardProbabilities("fed", authBets),
    },
  };
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
  const ip = clientIp(req);
  if (!rateLimit(`reg:${ip}`, 10, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần thử" });
  }
  const result = authStore.register(
    String(req.body?.username ?? ""),
    String(req.body?.password ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post("/api/auth/login", (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, 20, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần thử" });
  }
  const result = authStore.login(
    String(req.body?.username ?? ""),
    String(req.body?.password ?? ""),
  );
  if (!result.ok) return res.status(401).json(result);
  res.json(result);
});

app.post("/api/auth/logout", (req, res) => {
  const token = bearer(req);
  authStore.revokeToken(token);
  res.json({ ok: true });
});

app.post("/api/auth/change-password", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = authStore.changePassword(
    user.id,
    String(req.body?.currentPassword ?? ""),
    String(req.body?.nextPassword ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true });
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

/** Upload avatar từ máy (user đã login hoặc khách kèm guestCode). */
app.post("/api/avatar/upload", (req, res) => {
  const dataUrl = String(req.body?.dataUrl ?? "");
  const authUser = authStore.resolveToken(bearer(req));
  const guestCode = String(req.body?.guestCode ?? "")
    .trim()
    .toUpperCase();

  let ownerKey = "";
  if (authUser) ownerKey = authUser.id;
  else if (/^G[A-Z0-9]{7}$/.test(guestCode)) ownerKey = guestCode;
  else {
    return res.status(401).json({
      ok: false,
      reason: "Cần đăng nhập hoặc mã khách để upload avatar",
    });
  }

  const saved = saveUploadedAvatar(ownerKey, dataUrl);
  if (!saved.ok) return res.status(400).json(saved);

  if (authUser) {
    const result = authStore.setAvatar(authUser.id, saved.avatar);
    if (!result.ok) return res.status(400).json(result);
    const live = engine.applyAuthAvatar(authUser.id, result.user.avatar);
    for (const sid of live.socketIds) {
      io.to(sid).emit("state", engine.getStateFor(sid));
    }
    return res.json({ ok: true, avatar: result.user.avatar, user: result.user });
  }

  res.json({ ok: true, avatar: saved.avatar });
});

/** User đổi mã nạp xu — không trả danh sách coupon. */
app.post("/api/auth/redeem-coupon", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!rateLimit(`redeem:${user.id}`, 15, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần thử" });
  }
  const code = String(req.body?.code ?? "");
  const preview = couponStore.previewRedeem(code, user.id);
  if (!preview.ok) return res.status(400).json(preview);

  const adj = authStore.adjustBalance(user.id, preview.amount);
  if (!adj.ok) {
    return res.status(400).json({ ok: false, reason: adj.reason });
  }
  vaultStore.recordCouponMint(
    preview.amount,
    user.id,
    user.username,
    preview.code,
  );
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

/** Admin: tạo / cập nhật coupon. */
app.post("/api/admin/coupons", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const result = couponStore.upsert({
    code: String(req.body?.code ?? ""),
    amount: Number(req.body?.amount),
    label: req.body?.label != null ? String(req.body.label) : undefined,
    enabled: req.body?.enabled,
    oncePerUser: req.body?.oncePerUser,
    secret: req.body?.secret,
  });
  if (!result.ok) return res.status(400).json(result);
  res.json({
    ok: true,
    coupon: result.coupon,
    coupons: couponStore.listForAdmin(),
  });
});

/** Admin: bật/tắt coupon. */
app.post("/api/admin/coupons/toggle", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const code = String(req.body?.code ?? "");
  const enabled = !!req.body?.enabled;
  const result = couponStore.setEnabled(code, enabled);
  if (!result.ok) return res.status(400).json(result);
  res.json({
    ok: true,
    coupon: result.coupon,
    coupons: couponStore.listForAdmin(),
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
    payload.vault = vault;
    payload.inter = buildInterPayload();
    payload.traffic = {
      ...live,
      ...accounts,
      ...bets,
      vaultBalance: vault.balance,
      vaultStakeIn: vault.totalStakeIn,
      vaultPayoutOut: vault.totalPayoutOut,
      vaultNetHouse: vault.netHouse,
      houseEdgeXu: vault.totalStakeIn - vault.totalPayoutOut,
      interMode: interStore.getMode(),
      interEffectiveMode: interStore.getEffectiveMode(),
    };
  }
  res.json(payload);
});

app.get("/api/mainadmin/inter", (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  res.json({
    ok: true,
    inter: buildInterPayload(),
  });
});

app.post("/api/mainadmin/inter", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const mode = req.body?.mode;
  if (!isInterMode(mode)) {
    return res.status(400).json({
      ok: false,
      reason: "mode phải là all | auto | small | big | app | user | fed | 1…8",
    });
  }
  interStore.setMode(mode, me.username);
  res.json({
    ok: true,
    inter: buildInterPayload(),
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
  const me = requireAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  const delta = Number(req.body?.delta);
  if (!userId || !Number.isFinite(delta)) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId/delta" });
  }
  const result = authStore.adjustBalance(userId, delta);
  if (!result.ok) return res.status(400).json(result);
  vaultStore.recordAdminAdjust(
    Math.floor(delta),
    me.username,
    userId,
    result.user.username,
  );
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

/** Admin: mode kết quả riêng cho 1 user (lose | normal | win). */
app.post("/api/admin/user-outcome", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const userId = String(req.body?.userId ?? "");
  const mode = req.body?.mode;
  if (!userId || !isUserOutcomeMode(mode)) {
    return res
      .status(400)
      .json({ ok: false, reason: "Thiếu userId hoặc mode (normal|win|lose)" });
  }
  const result = authStore.setOutcomeMode(userId, mode);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

/** Admin: bật/tắt VIP (chat bay màn hình). */
app.post("/api/admin/user-vip", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const userId = String(req.body?.userId ?? "");
  const isVip = !!req.body?.isVip;
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const result = authStore.setVip(userId, isVip);
  if (!result.ok) return res.status(400).json(result);
  engine.refreshAllClients();
  res.json(result);
});

io.on("connection", (socket) => {
  socket.on(
    "join",
    (payload?: { name?: string; token?: string; avatar?: string }) => {
      const authUser = authStore.resolveToken(payload?.token);
      const { session, kickedSocketIds } = engine.join(socket.id, {
        name: payload?.name,
        userId: authUser?.id,
        avatar: payload?.avatar,
      });
      for (const sid of kickedSocketIds) {
        io.to(sid).emit("sessionReplaced", {
          reason: "Đã đăng nhập ở tab khác",
        });
        io.sockets.sockets.get(sid)?.disconnect(true);
      }
      socket.emit("joined", {
        id: session.id,
        name: session.name,
        balance: session.balance,
        userId: session.userId,
        avatar: session.avatar,
      });
      socket.emit("state", engine.getStateFor(socket.id));
    },
  );

  socket.on(
    "setAvatar",
    (
      payload?: { avatar?: string },
      ack?: (r: { ok: boolean; avatar?: string; reason?: string }) => void,
    ) => {
      const result = engine.setSessionAvatar(
        socket.id,
        String(payload?.avatar ?? ""),
      );
      if (!result.ok) {
        ack?.(result);
        return;
      }
      socket.emit("state", engine.getStateFor(socket.id));
      ack?.(result);
    },
  );

  socket.on(
    "setName",
    (
      payload?: { name?: string },
      ack?: (r: { ok: boolean; name?: string; reason?: string }) => void,
    ) => {
      const result = engine.setSessionName(
        socket.id,
        String(payload?.name ?? ""),
      );
      if (!result.ok) {
        ack?.(result);
        return;
      }
      socket.emit("state", engine.getStateFor(socket.id));
      ack?.(result);
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
        payload?.roundId != null ? Number(payload.roundId) : undefined,
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

  socket.on(
    "sendShout",
    (
      payload: {
        id?: string;
        text?: string;
        token?: string;
        mode?: string;
        vipFly?: boolean;
      },
      ack?: (r: { ok: boolean; reason?: string; balance?: number }) => void,
    ) => {
      const authUser = authStore.resolveToken(payload?.token);
      const result = engine.sendShout(socket.id, {
        id: payload?.id,
        text: payload?.text,
        userId: authUser?.id,
        mode: payload?.mode as "no" | "vip" | "saint" | undefined,
        vipFly: !!payload?.vipFly,
      });
      if (!result.ok) {
        ack?.(result);
        return;
      }
      socket.emit("balanceUpdate", { balance: result.balance });
      io.emit("shout", result.event);
      ack?.({ ok: true, balance: result.balance });
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

  socket.on(
    "setBotCount",
    (
      payload: { count: number; token?: string },
      ack?: (r: unknown) => void,
    ) => {
      const user = authStore.resolveToken(payload?.token);
      if (!user || !isStaff(user)) {
        const result = { ok: false as const, reason: "Không có quyền" };
        socket.emit("botConfigRejected", { reason: result.reason });
        ack?.(result);
        return;
      }
      const result = engine.setBotCount(Number(payload?.count));
      if (!result.ok) {
        socket.emit("botConfigRejected", { reason: result.reason });
        ack?.(result);
        return;
      }
      socket.emit("botConfigUpdated", result);
      ack?.(result);
    },
  );

  socket.on("getBotPanel", (payload?: { token?: string }) => {
    const user = authStore.resolveToken(payload?.token);
    if (!user || !isStaff(user)) {
      socket.emit("botPanelData", { error: "Không có quyền" });
      return;
    }
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
