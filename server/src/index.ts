import cors from "cors";
import express from "express";
import { existsSync } from "fs";
import { createServer } from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { authStore } from "./auth.js";
import { CARDS, GameEngine } from "./game.js";
import type { PublicState } from "./types.js";

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
  if (user.role !== "admin") {
    res.status(403).json({ ok: false, reason: "Chỉ admin" });
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

app.get("/api/admin/overview", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    ok: true,
    stats: engine.getOnlineStats(),
    users: authStore.listUsers(),
    botPanel: engine.getBotPanel(),
  });
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
  console.log(`[server] Seed: admin/admin123 · demo/demo123`);
  if (existsSync(CLIENT_DIST)) {
    console.log(`[server] Serving client from ${CLIENT_DIST}`);
  }
});
