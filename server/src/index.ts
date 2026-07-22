import cors from "cors";
import express from "express";
import { existsSync } from "fs";
import { createServer } from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import {
  authStore,
  canAccessRoomAdmin,
  canControlVoiceRoomLock,
  canGrantVoiceRooms,
  canManageCultivation,
  canModerateVoiceRoom,
  canAccessStaffDashboard,
  hasCapability,
  isBalanceOperator,
  isMainAdmin,
  isStaff,
  isUserOutcomeMode,
  userDisplayName,
  VIP_ROUNDS_REQUIRED,
  type GrantCapability,
} from "./auth.js";
import { auditStore } from "./auditStore.js";
import {
  AVATARS,
  normalizeAvatar,
  saveUploadedAvatar,
  UPLOADS_DIR,
} from "./avatars.js";
import { betStore, PER_USER_BET_CAP } from "./betStore.js";
import { couponStore } from "./couponStore.js";
import { inviteStore } from "./inviteStore.js";
import { cardProbabilities } from "./cards.js";
import { CARDS, GameEngine } from "./game.js";
import { interStore, isInterMode } from "./interStore.js";
import { interObserveStore } from "./interObserveStore.js";
import { guestIpStore } from "./guestIpStore.js";
import { guestPlayStore } from "./guestPlayStore.js";
import {
  deviceStore,
  normalizeDeviceId,
  sanitizeDeviceMeta,
} from "./deviceStore.js";
import { lookupIpGeoMany } from "./ipGeo.js";
import { reportStore } from "./reportStore.js";
import type { PublicState } from "./types.js";
import { arcanaWheelStore } from "./arcanaWheelStore.js";
import { arcanaMissionStore } from "./arcanaMissionStore.js";
import { tutienBetLimitsStore } from "./tutienBetLimitsStore.js";
import { chatConfigStore } from "./chatConfigStore.js";
import { vaultArcana, vaultStore } from "./vaultStore.js";
import {
  cultivationStore,
  isCultivationRank,
} from "./cultivationStore.js";
import { attachVoiceSocket, broadcastVoiceRoom } from "./voiceSocket.js";
import {
  isRoomId,
  voiceRoomStore,
} from "./voiceRoomStore.js";
import {
  clientIp,
  globalHttpRateLimit,
  rateLimit,
  socketIp,
  startRateLimitPrune,
  trackSocketConnect,
  trackSocketDisconnect,
} from "./rateLimit.js";
import { securityHeaders, warnOpenCorsIfProd } from "./securityHeaders.js";

const PORT = Number(process.env.PORT) || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = join(__dirname, "..", "..", "client", "dist");
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
warnOpenCorsIfProd(ALLOWED_ORIGINS);
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
app.use(securityHeaders);
app.use(express.json({ limit: "1.5mb" }));
app.use(globalHttpRateLimit({ max: 160, windowMs: 60_000, skipPaths: ["/health"] }));
app.use("/uploads/avatars", express.static(UPLOADS_DIR));
startRateLimitPrune(60_000);

function kickUserSockets(userId: string, reason: string) {
  for (const sid of engine.getSocketIdsForUser(userId)) {
    io.to(sid).emit("sessionReplaced", { reason });
    io.sockets.sockets.get(sid)?.disconnect(true);
  }
}

function kickSocketIds(socketIds: string[], reason: string) {
  for (const sid of socketIds) {
    io.to(sid).emit("sessionReplaced", { reason });
    io.sockets.sockets.get(sid)?.disconnect(true);
  }
}

function audit(
  me: { id: string; username: string },
  action: string,
  opts?: { targetId?: string; targetName?: string; detail?: string },
) {
  auditStore.log({
    actorId: me.id,
    actorName: me.username,
    action,
    targetId: opts?.targetId,
    targetName: opts?.targetName,
    detail: opts?.detail,
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin:
      ALLOWED_ORIGINS.length > 0
        ? ALLOWED_ORIGINS
        : true,
  },
  maxHttpBufferSize: 1e5,
  connectTimeout: 20_000,
});

attachVoiceSocket(io);

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
  if (!canAccessStaffDashboard(user)) {
    res.status(403).json({ ok: false, reason: "Chỉ staff dashboard" });
    return null;
  }
  return user;
}

function requireCapability(
  req: express.Request,
  res: express.Response,
  cap: GrantCapability,
  reason = "Không đủ quyền",
): ReturnType<typeof authStore.resolveToken> {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!hasCapability(user, cap)) {
    res.status(403).json({ ok: false, reason });
    return null;
  }
  return user;
}

function requireBalanceOperator(
  req: express.Request,
  res: express.Response,
): ReturnType<typeof authStore.resolveToken> {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!isBalanceOperator(user)) {
    res.status(403).json({ ok: false, reason: "Không có quyền chỉnh xu" });
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

/** Tab Room + REST điều hành voice — mainadmin / mod (admin staff cũng được). */
function requireRoomModerator(
  req: express.Request,
  res: express.Response,
): ReturnType<typeof authStore.resolveToken> {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!canModerateVoiceRoom(user)) {
    res.status(403).json({ ok: false, reason: "Chỉ mainadmin / mod / admin" });
    return null;
  }
  return user;
}

function requireCultivationManager(
  req: express.Request,
  res: express.Response,
): ReturnType<typeof authStore.resolveToken> {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!canManageCultivation(user)) {
    res.status(403).json({ ok: false, reason: "Chỉ Tu Tiên / mainadmin" });
    return null;
  }
  return user;
}

function buildInterPayload() {
  const inter = interStore.getSnapshot();
  const authBets = engine.getAuthBets();
  const recentWins = engine.getHistory(3).map((h) => h.win);
  const effective = inter.effectiveMode;
  return {
    ...inter,
    realBetsRound: engine.getRealBets(),
    authBetsRound: authBets,
    recentWins,
    probabilities: cardProbabilities(effective, authBets, recentWins),
    probabilitiesByMode: Object.fromEntries(
      (
        inter.rotateCatalog?.map((e) => e.id) ?? [
          "auto",
          "small",
          "big",
          "flat",
          "cool",
          "app",
          "hedge",
          "user",
          "fed",
        ]
      ).map((id) => [
        id,
        cardProbabilities(
          id as Parameters<typeof cardProbabilities>[0],
          authBets,
          recentWins,
        ),
      ]),
    ),
  };
}

app.get("/health", (_req, res) => {
  const started = (globalThis as { __sofiaoreBootAt?: number }).__sofiaoreBootAt;
  const bootAt = started ?? Date.now();
  if (!(globalThis as { __sofiaoreBootAt?: number }).__sofiaoreBootAt) {
    (globalThis as { __sofiaoreBootAt?: number }).__sofiaoreBootAt = bootAt;
  }
  const stats = engine.getOnlineStats();
  const dataDir = join(__dirname, "..", "data");
  const checks = {
    cards: CARDS.length === 8,
    clientDist: existsSync(CLIENT_DIST),
    dataDir: existsSync(dataDir),
    engine: typeof stats?.phase === "string",
  };
  const ok = Object.values(checks).every(Boolean);
  res.status(ok ? 200 : 503).json({
    ok,
    service: "sofiaore-tarot",
    version: process.env.npm_package_version ?? "1.0.0",
    node: process.version,
    uptimeSec: Math.floor(process.uptime()),
    ts: Date.now(),
    cards: CARDS.length,
    phase: stats.phase,
    roundNumber: stats.roundNumber,
    displayOnline: stats.displayOnline,
    requireInvite: inviteStore.isInviteRequired(),
    checks,
  });
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

app.get("/api/leaderboard/balance", (req, res) => {
  const viewer = authStore.resolveToken(bearer(req));
  res.json({
    ok: true,
    rows: authStore.listBalanceLeaders(20, viewer?.id),
  });
});

app.post("/api/auth/gift-xu", (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const ip = clientIp(req);
  if (
    !rateLimit(`gift:${me.id}`, 20, 60_000) ||
    !rateLimit(`giftip:${ip}`, 40, 60_000)
  ) {
    return res.status(429).json({ ok: false, reason: "Tặng quá nhanh — thử lại sau" });
  }
  const toUserId = String(req.body?.toUserId ?? "").trim();
  const toCode = String(req.body?.toCode ?? "").trim();
  if (!toUserId && !toCode) {
    return res.status(400).json({ ok: false, reason: "Thiếu người nhận" });
  }
  const result = authStore.giftXu(
    me.id,
    { userId: toUserId || undefined, code: toCode || undefined },
    req.body?.amount,
  );
  if (!result.ok) return res.status(400).json(result);

  const fromLive = engine.applyAuthBalance(result.from.id, result.from.balance);
  const toLive = engine.applyAuthBalance(result.to.id, result.to.balance);
  for (const sid of fromLive.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: fromLive.balance });
  }
  for (const sid of toLive.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: toLive.balance });
  }

  const note = String(req.body?.note ?? "").trim().slice(0, 80);
  audit(me, "gift_xu", {
    targetId: result.to.id,
    targetName: result.to.username,
    detail: `amount=${result.amount}${note ? ` note=${note}` : ""}`,
  });

  res.json({
    ok: true,
    amount: result.amount,
    from: result.from,
    to: result.to,
  });
});

app.post("/api/auth/register", (req, res) => {
  const ip = clientIp(req);
  const deviceId = normalizeDeviceId(req.body?.deviceId);
  if (deviceId && deviceStore.isBlocked(deviceId)) {
    return res.status(403).json({
      ok: false,
      reason: deviceStore.blockReason(deviceId) ?? "Thiết bị bị tạm khóa",
    });
  }
  if (!rateLimit(`reg:${ip}`, 10, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần thử" });
  }
  const inviteRequired = inviteStore.isInviteRequired();
  let inviteCodeUsed: string | null = null;
  if (inviteRequired) {
    const invitePreview = inviteStore.preview(String(req.body?.inviteCode ?? ""));
    if (!invitePreview.ok) {
      return res.status(400).json(invitePreview);
    }
    inviteCodeUsed = invitePreview.code;
  }
  const result = authStore.register(
    String(req.body?.username ?? ""),
    String(req.body?.password ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  if (inviteCodeUsed) {
    const consumed = inviteStore.consume(inviteCodeUsed);
    if (!consumed.ok) {
      console.warn(
        `[invite] consume failed after register user=${result.user.username}: ${consumed.reason}`,
      );
    }
  }
  authStore.recordIp(result.user.id, ip);
  if (deviceId) {
    deviceStore.recordTouch({
      deviceId,
      ip,
      meta: sanitizeDeviceMeta(req.body?.device),
      userId: result.user.id,
      username: result.user.username,
    });
  }
  const guestBalance = Number(req.body?.guestBalance);
  const guestAvatar = String(req.body?.guestAvatar ?? "");
  if (
    (Number.isFinite(guestBalance) && guestBalance > 0) ||
    guestAvatar
  ) {
    const merged = authStore.mergeGuestIntoUser(result.user.id, {
      balance: Number.isFinite(guestBalance) ? guestBalance : undefined,
      avatar: guestAvatar || undefined,
    });
    if (merged.ok) {
      return res.json({
        ok: true,
        user: { ...merged.user, recoveryCode: result.user.recoveryCode },
        token: result.token,
        guestMerged: true,
      });
    }
  }
  res.json(result);
});

app.post("/api/auth/login", (req, res) => {
  const ip = clientIp(req);
  const deviceId = normalizeDeviceId(req.body?.deviceId);
  if (deviceId && deviceStore.isBlocked(deviceId)) {
    return res.status(403).json({
      ok: false,
      reason: deviceStore.blockReason(deviceId) ?? "Thiết bị bị tạm khóa",
    });
  }
  if (!rateLimit(`login:${ip}`, 20, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần thử" });
  }
  const result = authStore.login(
    String(req.body?.username ?? ""),
    String(req.body?.password ?? ""),
  );
  if (!result.ok) return res.status(401).json(result);
  authStore.recordIp(result.user.id, ip);
  if (deviceId) {
    deviceStore.recordTouch({
      deviceId,
      ip,
      meta: sanitizeDeviceMeta(req.body?.device),
      userId: result.user.id,
      username: result.user.username,
    });
  }
  const guestBalance = Number(req.body?.guestBalance);
  const guestAvatar = String(req.body?.guestAvatar ?? "");
  if (
    (Number.isFinite(guestBalance) && guestBalance > 0) ||
    guestAvatar
  ) {
    const merged = authStore.mergeGuestIntoUser(result.user.id, {
      balance: Number.isFinite(guestBalance) ? guestBalance : undefined,
      avatar: guestAvatar || undefined,
    });
    if (merged.ok) {
      return res.json({
        ok: true,
        user: merged.user,
        token: result.token,
        guestMerged: true,
        betLimits: tutienBetLimitsStore.limitsForUser(merged.user),
      });
    }
  }
  res.json({
    ...result,
    betLimits: tutienBetLimitsStore.limitsForUser(result.user),
  });
});

app.post("/api/auth/recover-password", (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit(`recover:${ip}`, 8, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần thử" });
  }
  const result = authStore.recoverPassword(
    String(req.body?.username ?? ""),
    String(req.body?.recoveryCode ?? ""),
    String(req.body?.nextPassword ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true, message: "Đã đặt mật khẩu mới — đăng nhập lại" });
});

app.post("/api/auth/recovery-code", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = authStore.revealRecoveryCode(user.id);
  if (!result.ok) return res.status(400).json(result);
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

app.get("/api/auth/register-config", (_req, res) => {
  res.json({ ok: true, ...inviteStore.getPublicConfig() });
});

app.get("/api/auth/me", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json({
    ok: true,
    user,
    betLimits: tutienBetLimitsStore.limitsForUser(user),
  });
});

/** Thẻ profile công khai (VIP + ID) — dùng khi mở popup người chơi. */
app.get("/api/players/card", (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit(`player-card:${ip}`, 120, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần tra cứu" });
  }
  const userId = String(req.query.userId ?? "").trim();
  const code = String(req.query.code ?? "").trim();
  if (!userId && !code) {
    return res
      .status(400)
      .json({ ok: false, reason: "Thiếu userId hoặc code" });
  }
  const card = authStore.getPublicCard({ userId, code });
  if (!card) {
    return res.status(404).json({ ok: false, reason: "Không tìm thấy" });
  }
  res.json({ ok: true, card });
});

app.get("/api/auth/bets", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const raw = Number(req.query.limit);
  const limit = Math.min(
    PER_USER_BET_CAP,
    Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 50),
  );
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

app.post("/api/auth/rename", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = authStore.renameUsername(
    user.id,
    String(req.body?.username ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  engine.applyAuthDisplayName(user.id);
  res.json(result);
});

app.post("/api/auth/nickname", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!rateLimit(`nickname:${user.id}`, 12, 60 * 60 * 1000)) {
    return res.status(429).json({
      ok: false,
      reason: "Đổi nickname quá nhiều lần — thử lại sau",
    });
  }
  const result = authStore.setNickname(
    user.id,
    String(req.body?.nickname ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  engine.applyAuthDisplayName(user.id);
  res.json(result);
});

/** Upload avatar từ máy (user đã login hoặc khách kèm guestCode). */
app.post("/api/avatar/upload", (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit(`avatar:${ip}`, 20, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần upload" });
  }
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

/** Danh sách người đã nạp xu (tổng theo user — không lộ mã coupon). */
app.get("/api/topups", (_req, res) => {
  if (!rateLimit("topups:public", 60, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Thử lại sau" });
  }
  const rows = couponStore.topDepositors(50).map((row, i) => {
    const u = authStore.getById(row.userId);
    return {
      rank: i + 1,
      userId: row.userId,
      name: u ? userDisplayName(u) : row.username,
      avatar: normalizeAvatar(u?.avatar),
      code: u?.code ?? null,
      totalAmount: row.totalAmount,
      redeemCount: row.redeemCount,
      lastAt: row.lastAt,
    };
  });
  const totalXu = rows.reduce((s, r) => s + r.totalAmount, 0);
  res.json({ ok: true, totalXu, rows });
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

/** Admin/eco: tạo / cập nhật coupon (audit không đụng). */
app.post("/api/admin/coupons", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  if (me.role === "audit") {
    return res.status(403).json({ ok: false, reason: "Audit không quản lý coupon" });
  }
  const result = couponStore.upsert({
    code: String(req.body?.code ?? ""),
    amount: Number(req.body?.amount),
    label: req.body?.label != null ? String(req.body.label) : undefined,
    enabled: req.body?.enabled,
    oncePerUser: req.body?.oncePerUser,
    secret: req.body?.secret,
  });
  if (!result.ok) return res.status(400).json(result);
  audit(me, "coupon_upsert", { detail: result.coupon.code });
  res.json({
    ok: true,
    coupon: result.coupon,
    coupons: couponStore.listForAdmin(),
  });
});

/** Admin/eco: bật/tắt coupon. */
app.post("/api/admin/coupons/toggle", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  if (me.role === "audit") {
    return res.status(403).json({ ok: false, reason: "Audit không quản lý coupon" });
  }
  const code = String(req.body?.code ?? "");
  const enabled = !!req.body?.enabled;
  const result = couponStore.setEnabled(code, enabled);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "coupon_toggle", {
    detail: `${code} → ${enabled ? "on" : "off"}`,
  });
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
  // Coupon ẩn: staff dashboard (trừ audit — tránh lộ mã nạp)
  if (me.role !== "audit") {
    payload.coupons = couponStore.listForAdmin();
    payload.couponRedemptions = couponStore.recentRedemptions(40);
  }
  payload.audit = auditStore.list(80);
  payload.reports = reportStore.list(60);
  payload.liveGuests = engine.listLiveGuestsForAdmin();

  const canVault = hasCapability(me, "vault_ops");
  const canTraffic = hasCapability(me, "traffic_view");
  const canInter = hasCapability(me, "inter_control");
  const canChat = hasCapability(me, "chat_config");
  const canInvites = hasCapability(me, "invite_ops");
  const canArcana = hasCapability(me, "arcana_config");
  const canCult = canManageCultivation(me);

  if (canVault || canTraffic || canInter || canChat || canInvites || canArcana) {
    const vault = vaultStore.getSnapshot();
    const vaultArcanaSnap = vaultArcana.getSnapshot();
    const bets = betStore.getTrafficStats();
    const accounts = authStore.getAccountStats();
    const live = engine.getLiveTraffic();
    if (canVault) {
      payload.vault = vault;
      payload.vaultArcana = vaultArcanaSnap;
    }
    if (canArcana) {
      payload.arcanaStats = arcanaWheelStore.getStats();
      payload.arcanaConfig = arcanaWheelStore.getConfig();
      payload.arcanaRtpPreview = arcanaWheelStore.getRtpPreview();
    }
    if (canInter) {
      payload.inter = buildInterPayload();
    }
    if (canChat) {
      payload.chatConfig = chatConfigStore.getSnapshot();
    }
    if (canInvites) {
      payload.invites = inviteStore.list();
      payload.requireInvite = inviteStore.isInviteRequired();
    }
    if (canCult || isMainAdmin(me)) {
      payload.cultivation = cultivationStore.getPublic();
    }
    if (canTraffic || canVault) {
      payload.traffic = {
        ...live,
        ...accounts,
        ...bets,
        vaultBalance: vault.balance,
        vaultStakeIn: vault.totalStakeIn,
        vaultPayoutOut: vault.totalPayoutOut,
        vaultNetHouse: vault.netHouse,
        houseEdgeXu: vault.totalStakeIn - vault.totalPayoutOut,
        vaultFlows: vault.flows,
        vaultArcanaBalance: vaultArcanaSnap.balance,
        vaultArcanaStakeIn: vaultArcanaSnap.totalStakeIn,
        vaultArcanaPayoutOut: vaultArcanaSnap.totalPayoutOut,
        vaultArcanaNetHouse: vaultArcanaSnap.netHouse,
        arcanaHouseEdgeXu:
          vaultArcanaSnap.totalStakeIn - vaultArcanaSnap.totalPayoutOut,
        vaultArcanaFlows: vaultArcanaSnap.flows,
        interMode: interStore.getMode(),
        interEffectiveMode: interStore.getEffectiveMode(),
      };
    }
  }
  res.json(payload);
});

app.get("/api/mainadmin/inter", (req, res) => {
  if (!requireCapability(req, res, "inter_control", "Chỉ Inter")) return;
  res.json({
    ok: true,
    inter: buildInterPayload(),
  });
});

app.get("/api/mainadmin/inter/live", (req, res) => {
  if (!requireCapability(req, res, "inter_control", "Chỉ Inter")) return;
  const authBets = engine.getAuthBets();
  const realBets = engine.getRealBets();
  const stats = engine.getOnlineStats();
  const botTotal = engine
    .getBotPanel()
    .botBetsTotal.reduce((a, b) => a + b, 0);
  const displayStake = realBets.reduce((a, b) => a + b, 0) + botTotal;
  res.json({
    ok: true,
    live: interObserveStore.buildLive({
      phase: String(stats.phase),
      roundNumber: Number(stats.roundNumber) || 0,
      authBets,
      realBets,
      displayStake,
      recentWins: engine.getHistory(3).map((h) => h.win),
    }),
  });
});

app.post("/api/mainadmin/inter", (req, res) => {
  const me = requireCapability(req, res, "inter_control", "Chỉ Inter");
  if (!me) return;
  const mode = req.body?.mode;
  if (mode !== undefined && mode !== null && mode !== "") {
    if (!isInterMode(mode)) {
      return res.status(400).json({
        ok: false,
        reason: "mode phải là all | auto | small | big | app | user | fed | 1…8",
      });
    }
    interStore.setMode(mode, me.username);
    audit(me, "inter_set", { detail: String(mode) });
  }
  if (req.body?.allSlotMinutes != null && req.body?.allSlotMinutes !== "") {
    const result = interStore.setAllSlotMinutes(
      Number(req.body.allSlotMinutes),
      me.username,
    );
    if (!result.ok) return res.status(400).json(result);
    audit(me, "inter_all_slot", {
      detail: `${result.allSlotMinutes} phút`,
    });
  }
  if (req.body?.rotation != null) {
    const result = interStore.setAllRotation(req.body.rotation, me.username);
    if (!result.ok) return res.status(400).json(result);
    audit(me, "inter_rotation", {
      detail: result.allRotation.join("→"),
    });
  }
  if (req.body?.winBiasPct != null && req.body?.winBiasPct !== "") {
    const result = interStore.setWinBiasPct(
      Number(req.body.winBiasPct),
      me.username,
    );
    audit(me, "inter_win_bias", { detail: String(result.winBiasPct) });
  }
  if (req.body?.vaultInterLink != null) {
    const result = interStore.setVaultInterLink(
      req.body.vaultInterLink,
      me.username,
    );
    audit(me, "vault_inter_link", {
      detail: JSON.stringify(result.vaultInterLink),
    });
  }
  res.json({
    ok: true,
    inter: buildInterPayload(),
  });
});

app.get("/api/mainadmin/vault", (req, res) => {
  if (!requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)")) return;
  res.json({ ok: true, vault: vaultStore.getSnapshot() });
});

app.post("/api/mainadmin/vault/adjust", (req, res) => {
  const me = requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)");
  if (!me) return;
  const result = vaultStore.adjust(
    Number(req.body?.delta),
    me.username,
    String(req.body?.note ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "vault_adjust", { detail: `${req.body?.delta} ${req.body?.note ?? ""}` });
  res.json({ ok: true, vault: vaultStore.getSnapshot() });
});

app.post("/api/mainadmin/vault/set", (req, res) => {
  const me = requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)");
  if (!me) return;
  const result = vaultStore.setBalance(
    Number(req.body?.balance),
    me.username,
    String(req.body?.note ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "vault_set", { detail: String(req.body?.balance) });
  res.json({ ok: true, vault: vaultStore.getSnapshot() });
});

app.post("/api/mainadmin/vault/grant", (req, res) => {
  const me = requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)");
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
  audit(me, "vault_grant", {
    targetId: adj.user.id,
    targetName: adj.user.username,
    detail: `+${prep.amount}`,
  });
  const live = engine.applyAuthBalance(userId, adj.user.balance);
  for (const sid of live.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: live.balance });
  }
  res.json({ ok: true, user: adj.user, vault: vaultStore.getSnapshot() });
});

app.post("/api/mainadmin/vault/seize", (req, res) => {
  const me = requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)");
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
  audit(me, "vault_seize", {
    targetId: adj.user.id,
    targetName: adj.user.username,
    detail: `-${amount}`,
  });
  const live = engine.applyAuthBalance(userId, adj.user.balance);
  for (const sid of live.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: live.balance });
  }
  res.json({ ok: true, user: adj.user, vault: vaultStore.getSnapshot() });
});

/** Flag Inter trên từng kho (Tarot | Arcana). */
app.post("/api/mainadmin/vault-flags", (req, res) => {
  const me = requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)");
  if (!me) return;
  const key = String(req.body?.vaultKey ?? "tarot").trim();
  if (key !== "tarot" && key !== "arcana") {
    return res.status(400).json({ ok: false, reason: "vaultKey tarot|arcana" });
  }
  const store = key === "arcana" ? vaultArcana : vaultStore;
  const flagsBody =
    req.body?.flags && typeof req.body.flags === "object"
      ? req.body.flags
      : req.body;
  const result = store.setInterFlags(flagsBody);
  audit(me, "vault_inter_flags", {
    detail: `${key} ${JSON.stringify(result.interFlags)}`,
  });
  res.json({
    ok: true,
    vaultKey: key,
    vault: store.getSnapshot(),
    interFlags: result.interFlags,
  });
});

/** Kho Arcana — chỉ adjust/set (ops ví dùng Kho Tarot) */
app.get("/api/mainadmin/vault-arcana", (req, res) => {
  if (!requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)")) return;
  res.json({ ok: true, vault: vaultArcana.getSnapshot() });
});

app.post("/api/mainadmin/vault-arcana/adjust", (req, res) => {
  const me = requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)");
  if (!me) return;
  const result = vaultArcana.adjust(
    Number(req.body?.delta),
    me.username,
    String(req.body?.note ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "vault_arcana_adjust", {
    detail: `${req.body?.delta} ${req.body?.note ?? ""}`,
  });
  res.json({ ok: true, vault: vaultArcana.getSnapshot() });
});

app.post("/api/mainadmin/vault-arcana/set", (req, res) => {
  const me = requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)");
  if (!me) return;
  const result = vaultArcana.setBalance(
    Number(req.body?.balance),
    me.username,
    String(req.body?.note ?? ""),
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "vault_arcana_set", { detail: String(req.body?.balance) });
  res.json({ ok: true, vault: vaultArcana.getSnapshot() });
});

app.get("/api/mainadmin/games", (req, res) => {
  if (!requireCapability(req, res, "vault_ops", "Cần quyền kho (eco)")) return;
  const cfg = arcanaWheelStore.getConfig();
  res.json({
    ok: true,
    games: [
      {
        id: "tarot",
        label: "Bàn Tarot",
        vaultKey: "tarot",
        enabled: true,
      },
      {
        id: "arcana",
        label: "Bánh xe Arcana",
        vaultKey: "arcana",
        enabled: cfg.enabled,
      },
    ],
  });
});

app.get("/api/mainadmin/arcana/config", (req, res) => {
  if (!requireCapability(req, res, "arcana_config", "Cần quyền Arcana (eco)")) return;
  res.json({
    ok: true,
    config: arcanaWheelStore.getConfig(),
    stats: arcanaWheelStore.getStats(),
    rtpPreview: arcanaWheelStore.getRtpPreview(),
  });
});

app.patch("/api/mainadmin/arcana/config", (req, res) => {
  const me = requireCapability(req, res, "arcana_config", "Cần quyền Arcana (eco)");
  if (!me) return;
  const result = arcanaWheelStore.updateConfig(
    {
      enabled: req.body?.enabled,
      betTiers: req.body?.betTiers,
      tutienMaxByRank: req.body?.tutienMaxByRank,
      payoutScale: req.body?.payoutScale,
      streakBonusEnabled: req.body?.streakBonusEnabled,
      streakBonusMinStreak: req.body?.streakBonusMinStreak,
      streakBonusPercentPerStep: req.body?.streakBonusPercentPerStep,
      streakBonusCapPercent: req.body?.streakBonusCapPercent,
      slots: req.body?.slots,
    },
    me.username,
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "arcana_config", {
    detail: JSON.stringify({
      enabled: req.body?.enabled,
      betTiers: req.body?.betTiers,
    }),
  });
  res.json({
    ok: true,
    config: result.config,
    stats: arcanaWheelStore.getStats(),
    rtpPreview: arcanaWheelStore.getRtpPreview(),
  });
});

app.get("/api/mainadmin/arcana/spins", (req, res) => {
  if (!requireCapability(req, res, "arcana_config", "Cần quyền Arcana (eco)")) return;
  const limit = Number(req.query.limit ?? 100);
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  res.json({
    ok: true,
    spins: arcanaWheelStore.listSpins(limit, userId),
    stats: arcanaWheelStore.getStats(),
  });
});

/** Player: bàn Bánh xe Arcana */
app.get("/api/arcana-wheel", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json({
    ok: true,
    ...arcanaWheelStore.getPublicState(user.id),
    balance: user.balance,
  });
});

app.get("/api/arcana-wheel/history", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const limit = Number(req.query.limit ?? 50);
  res.json({
    ok: true,
    spins: arcanaWheelStore.listSpins(limit, user.id),
  });
});

app.post("/api/arcana-wheel/spin", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!rateLimit(`arcana-spin:${user.id}`, 60, 60_000)) {
    return res
      .status(429)
      .json({ ok: false, reason: "Quay quá nhanh — thử lại sau" });
  }
  const result = arcanaWheelStore.spin({
    userId: user.id,
    stake: Number(req.body?.stake),
    pickIds: req.body?.pickIds,
    pickId: req.body?.pickId,
    useBonusSpin: !!req.body?.useBonusSpin,
    outerBet: req.body?.outerBet,
  });
  if (!result.ok) return res.status(400).json(result);
  const live = engine.applyAuthBalance(user.id, result.balance);
  for (const sid of live.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: live.balance });
  }
  res.json({
    ok: true,
    spin: result.spin,
    slot: result.slot,
    balance: result.balance,
    luckStreak: result.luckStreak,
    streakBonus: result.streakBonus,
    recent: arcanaWheelStore.getPublicState(user.id).recent,
    mission: arcanaMissionStore.getProgress(user.id),
  });
});

app.post("/api/admin/adjust-balance", (req, res) => {
  const me = requireBalanceOperator(req, res);
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
  audit(me, "adjust_balance", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail: String(Math.floor(delta)),
  });
  const live = engine.applyAuthBalance(userId, result.user.balance);
  for (const sid of live.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: live.balance });
  }
  res.json(result);
});

/** Admin: cộng/trừ xu khách đang ở bàn Tarot (theo socketId hoặc guest code). */
app.post("/api/admin/guest/adjust-balance", (req, res) => {
  const me = requireBalanceOperator(req, res);
  if (!me) return;
  const socketId = String(req.body?.socketId ?? "").trim();
  const guestCode = String(req.body?.guestCode ?? "").trim();
  const delta = Number(req.body?.delta);
  if ((!socketId && !guestCode) || !Number.isFinite(delta)) {
    return res
      .status(400)
      .json({ ok: false, reason: "Thiếu socketId/guestCode hoặc delta" });
  }
  const result = engine.adjustGuestBalance({ socketId, guestCode, delta });
  if (!result.ok) return res.status(400).json(result);
  vaultStore.recordAdminAdjust(
    Math.floor(delta),
    me.username,
    result.guestCode ?? socketId,
    `${result.name} (khách)`,
  );
  audit(me, "adjust_balance_guest", {
    targetName: result.name,
    detail: `${Math.floor(delta)} · ${result.guestCode ?? socketId}`,
  });
  for (const sid of result.socketIds) {
    io.to(sid).emit("balanceUpdate", { balance: result.balance });
  }
  res.json(result);
});

/** Deal / admin / mainadmin: tra cứu user để chỉnh xu. */
app.get("/api/deal/lookup", (req, res) => {
  const me = requireBalanceOperator(req, res);
  if (!me) return;
  const q = String(req.query.q ?? "").trim();
  if (q.length < 1) {
    return res.status(400).json({ ok: false, reason: "Nhập từ khóa" });
  }
  const users = authStore.searchUsers(q, 8).map((u) => ({
    id: u.id,
    username: u.username,
    code: u.code,
    balance: u.balance,
    role: u.role,
  }));
  res.json({ ok: true, users });
});

app.post("/api/admin/bots", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = engine.setBotCount(Number(req.body?.count));
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

/** Admin: mode kết quả riêng cho 1 user (lose | normal | win) + winPct 80–100. */
app.post("/api/admin/user-outcome", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const hasWinPct =
    req.body?.winPct != null && req.body?.winPct !== "";
  const winPctRaw = hasWinPct ? Number(req.body.winPct) : undefined;
  const modeRaw = req.body?.mode;

  /** Chỉ cập nhật % (tự bật win) */
  if (hasWinPct && (modeRaw == null || modeRaw === "")) {
    const result = authStore.setOutcomeWinPct(userId, winPctRaw!);
    if (!result.ok) return res.status(400).json(result);
    audit(me, "user_outcome", {
      targetId: result.user.id,
      targetName: result.user.username,
      detail: `win@${result.user.outcomeWinPct ?? winPctRaw}%`,
    });
    return res.json(result);
  }

  if (!isUserOutcomeMode(modeRaw)) {
    return res
      .status(400)
      .json({ ok: false, reason: "Thiếu userId hoặc mode (normal|win|lose)" });
  }
  const result = authStore.setOutcomeMode(
    userId,
    modeRaw,
    hasWinPct ? winPctRaw : undefined,
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "user_outcome", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail:
      modeRaw === "win"
        ? `win@${result.user.outcomeWinPct ?? 100}%`
        : String(modeRaw),
  });
  res.json(result);
});

/** Admin: bật/tắt VIP (chat bay màn hình). */
app.post("/api/admin/user-vip", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  const isVip = !!req.body?.isVip;
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const result = authStore.setVip(userId, isVip);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "user_vip", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail: isVip ? "grant" : "revoke",
  });
  engine.refreshAllClients();
  res.json(result);
});

/** Admin: chỉnh ID riêng cho user. */
app.post("/api/admin/user-code", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  const code = String(req.body?.code ?? "");
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const result = authStore.setUserCode(userId, code);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "user_code", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail: result.user.code,
  });
  engine.refreshAllClients();
  res.json(result);
});

/** Admin: khóa / mở khóa tài khoản. */
app.post("/api/admin/user-ban", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  const banned = !!req.body?.banned;
  const reason = String(req.body?.reason ?? "");
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  if (userId === me.id) {
    return res.status(400).json({ ok: false, reason: "Không tự khóa mình" });
  }
  const result = authStore.setBanned(userId, banned, reason);
  if (!result.ok) return res.status(400).json(result);
  audit(me, banned ? "user_ban" : "user_unban", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail: reason || undefined,
  });
  if (banned) {
    kickUserSockets(userId, "Tài khoản bị khóa");
  }
  res.json(result);
});

/** Admin: mute chat (minutes; 0 = unmute; permanent = true). */
app.post("/api/admin/user-mute", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  let mutedUntil = 0;
  if (req.body?.permanent) {
    mutedUntil = Number.MAX_SAFE_INTEGER;
  } else {
    const minutes = Math.floor(Number(req.body?.minutes ?? 0));
    if (minutes > 0) mutedUntil = Date.now() + minutes * 60_000;
  }
  const result = authStore.setMuted(userId, mutedUntil);
  if (!result.ok) return res.status(400).json(result);
  audit(me, mutedUntil > Date.now() ? "user_mute" : "user_unmute", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail: req.body?.permanent
      ? "permanent"
      : mutedUntil
        ? `${req.body?.minutes}m`
        : "off",
  });
  res.json(result);
});

/** Admin: reset mật khẩu tạm. */
app.post("/api/admin/user-reset-password", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "");
  const nextPassword = String(req.body?.password ?? "");
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const result = authStore.adminResetPassword(userId, nextPassword);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "user_reset_password", {
    targetId: result.user.id,
    targetName: result.user.username,
  });
  kickUserSockets(userId, "Mật khẩu đã được admin đặt lại");
  res.json({
    ok: true,
    user: result.user,
    tempPassword: result.tempPassword,
    recoveryCode: result.user.recoveryCode,
  });
});

/** Mainadmin: chỉnh giá chat No / VIP / Saint. */
app.post("/api/mainadmin/chat-config", (req, res) => {
  const me = requireCapability(req, res, "chat_config", "Cần quyền chat (audit)");
  if (!me) return;
  const { noCost, vipCost, saintCost } = req.body ?? {};
  if (noCost == null && vipCost == null && saintCost == null) {
    return res.status(400).json({
      ok: false,
      reason: "Cần noCost, vipCost hoặc saintCost",
    });
  }
  const result = chatConfigStore.updateConfig(
    { noCost, vipCost, saintCost },
    me.username,
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "chat_cost", {
    detail: `No ${result.config.noCost} · VIP ${result.config.vipCost} · Saint ${result.config.saintCost}`,
  });
  engine.refreshAllClients();
  res.json({ ok: true, chatConfig: result.config });
});

/** User: báo cáo tin chat. */
app.post("/api/chat/report", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!rateLimit(`report:${user.id}`, 20, 60_000)) {
    return res.status(429).json({ ok: false, reason: "Quá nhiều lần báo cáo" });
  }
  const text = String(req.body?.text ?? "").trim();
  const targetName = String(req.body?.targetName ?? "").trim();
  if (!text || !targetName) {
    return res.status(400).json({ ok: false, reason: "Thiếu nội dung báo cáo" });
  }
  const report = reportStore.add({
    reporterId: user.id,
    reporterName: user.username,
    targetUserId: req.body?.targetUserId
      ? String(req.body.targetUserId)
      : undefined,
    targetName,
    text,
    mode: req.body?.mode ? String(req.body.mode) : undefined,
  });
  res.json({ ok: true, report });
});

/** Admin: đánh dấu báo cáo. */
app.post("/api/admin/reports/status", (req, res) => {
  const me = requireAdmin(req, res);
  if (!me) return;
  const id = String(req.body?.id ?? "");
  const status = req.body?.status === "done" ? "done" : "open";
  const result = reportStore.setStatus(id, status);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "report_status", { detail: `${id} → ${status}` });
  res.json(result);
});

async function enrichIpRows() {
  const usersById = new Map(authStore.listUsers().map((u) => [u.id, u]));
  const rows = guestIpStore.listForAdmin();
  const geoMap = await lookupIpGeoMany(rows.map((r) => r.ip));

  return rows.map((row) => {
    const userStats = row.userIds.map((id) => {
      const u = usersById.get(id);
      const stats = betStore.getUserStats24h(id);
      return {
        id,
        code: u?.code ?? "—",
        username: u?.username ?? id,
        role: u?.role ?? "user",
        balance: u?.balance ?? 0,
        isVip: !!u?.isVip,
        banned: !!u?.banned,
        muted: !!u?.muted,
        roundsPlayed: u?.roundsPlayed ?? 0,
        stake24h: stats.stake24h,
        bets24h: stats.bets24h,
        profit24h: stats.profit24h,
      };
    });
    const stake24h = userStats.reduce((s, u) => s + u.stake24h, 0);
    const bets24h = userStats.reduce((s, u) => s + u.bets24h, 0);
    const profit24h = userStats.reduce((s, u) => s + u.profit24h, 0);
    return {
      ...row,
      geo: geoMap.get(row.ip) ?? null,
      devices: deviceStore.getByIp(row.ip),
      users: userStats,
      stake24h,
      bets24h,
      profit24h,
    };
  });
}

app.get("/api/mainadmin/ips", async (req, res) => {
  if (!requireCapability(req, res, "ip_audit", "Cần quyền IP (audit)")) return;
  res.json({ ok: true, rows: await enrichIpRows() });
});

/** Lịch sử user (IP + cược) — chỉ mainadmin; không lộ ra client player. */
app.get("/api/mainadmin/users/:userId/history", (req, res) => {
  if (!requireCapability(req, res, "ip_audit", "Cần quyền IP (audit)")) return;
  const userId = String(req.params.userId ?? "").trim();
  const rec = authStore.getById(userId);
  if (!rec) {
    return res.status(404).json({ ok: false, reason: "Không tìm thấy user" });
  }
  const intel = authStore.getIpIntel(userId)!;
  const roundsPlayed = Math.max(0, Math.floor(rec.roundsPlayed ?? 0));
  const isVip =
    !!rec.vipGranted || roundsPlayed >= VIP_ROUNDS_REQUIRED;
  res.json({
    ok: true,
    user: {
      id: rec.id,
      username: rec.username,
      code: rec.code,
      balance: rec.balance,
      role: rec.role,
      banned: !!rec.banned,
      muted: (rec.mutedUntil ?? 0) > Date.now(),
      isVip,
      roundsPlayed,
    },
    lastIp: intel.lastIp ?? null,
    lastIpAt: intel.lastIpAt ?? null,
    ipHistory: intel.ipHistory,
    relatedIps: guestIpStore.findIpsForUser(userId),
    recentBets: betStore.getByUser(userId, 20),
    recentArcanaSpins: arcanaWheelStore.listSpins(40, userId),
    stake24h: betStore.getUserStats24h(userId),
  });
});

/** Tra cứu nhanh: user / ID / IP / guest code. */
app.get("/api/mainadmin/lookup", async (req, res) => {
  if (!requireCapability(req, res, "tools_lookup", "Cần quyền tra cứu (audit)")) return;
  const q = String(req.query.q ?? "").trim();
  if (q.length < 1) {
    return res.status(400).json({ ok: false, reason: "Nhập từ khóa" });
  }
  const qLower = q.toLowerCase();
  const users = authStore.searchUsers(q, 40).map((u) => ({
    ...u,
    ...betStore.getUserStats24h(u.id),
  }));

  const allIps = await enrichIpRows();
  const ips = allIps.filter((row) => {
    const blob = [
      row.ip,
      row.guestCode,
      row.kind,
      ...(row.seenUsers ?? []).map((s) => `${s.username} ${s.userId}`),
      ...(row.seenGuests ?? []).map((s) => s.code),
      ...(row.users ?? []).map(
        (u: { username?: string; code?: string; id?: string }) =>
          `${u.username} ${u.code} ${u.id}`,
      ),
      formatGeoBlob(row.geo),
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(qLower);
  });

  // IP liên quan tới user khớp
  const userIds = new Set(users.map((u) => u.id));
  for (const row of allIps) {
    const hit =
      row.userIds?.some((id: string) => userIds.has(id)) ||
      row.users?.some((u: { id?: string }) => u.id && userIds.has(u.id));
    if (hit && !ips.some((r) => r.ip === row.ip)) ips.push(row);
  }

  const primary = users[0];
  const recentBets = primary
    ? betStore.getByUser(primary.id, 20)
    : [];

  res.json({
    ok: true,
    q,
    users,
    ips: ips.slice(0, 40),
    recentBets,
    counts: {
      users: users.length,
      ips: ips.length,
      vip: users.filter((u) => u.isVip).length,
      banned: users.filter((u) => u.banned).length,
      muted: users.filter((u) => u.muted).length,
      clusters: ips.filter((r) => r.clusterFlag).length,
    },
  });
});

function formatGeoBlob(geo: unknown): string {
  if (!geo || typeof geo !== "object") return "";
  const g = geo as Record<string, unknown>;
  return [g.city, g.regionName, g.country, g.isp, g.org, g.as]
    .filter((x) => typeof x === "string")
    .join(" ");
}

app.post("/api/mainadmin/ips/clear-guest", async (req, res) => {
  const me = requireCapability(req, res, "ip_audit", "Cần quyền IP (audit)");
  if (!me) return;
  const ip = String(req.body?.ip ?? "").trim();
  const result = guestIpStore.clearGuestBind(ip);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "ip_clear_guest", { detail: ip });
  res.json({ ok: true, rows: await enrichIpRows() });
});

app.get("/api/mainadmin/invites", (req, res) => {
  if (!requireCapability(req, res, "invite_ops", "Cần quyền mã TV (eco)")) return;
  res.json({
    ok: true,
    invites: inviteStore.list(),
    requireInvite: inviteStore.isInviteRequired(),
  });
});

app.post("/api/mainadmin/invites", (req, res) => {
  const me = requireCapability(req, res, "invite_ops", "Cần quyền mã TV (eco)");
  if (!me) return;
  const result = inviteStore.create({
    code: req.body?.code != null ? String(req.body.code) : undefined,
    maxUses: Number(req.body?.maxUses),
    note: req.body?.note != null ? String(req.body.note) : undefined,
    createdBy: me.username,
  });
  if (!result.ok) return res.status(400).json(result);
  audit(me, "invite_create", {
    detail: `${result.invite.code} · max ${result.invite.maxUses}`,
  });
  res.json({
    ok: true,
    invite: result.invite,
    invites: inviteStore.list(),
    requireInvite: inviteStore.isInviteRequired(),
  });
});

app.post("/api/mainadmin/invites/toggle", (req, res) => {
  const me = requireCapability(req, res, "invite_ops", "Cần quyền mã TV (eco)");
  if (!me) return;
  const code = String(req.body?.code ?? "");
  const enabled = !!req.body?.enabled;
  const result = inviteStore.setEnabled(code, enabled);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "invite_toggle", {
    detail: `${result.invite.code} → ${enabled ? "on" : "off"}`,
  });
  res.json({
    ok: true,
    invite: result.invite,
    invites: inviteStore.list(),
    requireInvite: inviteStore.isInviteRequired(),
  });
});

/** Eco/main: bật/tắt bắt buộc mã thành viên khi đăng ký. */
app.post("/api/mainadmin/invites/require", (req, res) => {
  const me = requireCapability(req, res, "invite_ops", "Cần quyền mã TV (eco)");
  if (!me) return;
  const enabled = !!req.body?.enabled;
  const result = inviteStore.setRequireInvite(enabled);
  audit(me, "invite_require", {
    detail: enabled ? "require=on" : "require=off",
  });
  res.json({
    ok: true,
    requireInvite: result.requireInvite,
    invites: inviteStore.list(),
  });
});

app.post("/api/mainadmin/user-role", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "").trim();
  const role = req.body?.role;
  if (
    !userId ||
    (role !== "user" &&
      role !== "deal" &&
      role !== "admin" &&
      role !== "onl" &&
      role !== "tutien" &&
      role !== "mod" &&
      role !== "eco" &&
      role !== "audit")
  ) {
    return res.status(400).json({
      ok: false,
      reason:
        "Thiếu userId hoặc role (user|deal|admin|onl|tutien|mod|eco|audit)",
    });
  }
  const result = authStore.setUserRole(userId, role);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "user_role", {
    targetId: userId,
    targetName: result.user.username,
    detail: String(role),
  });
  res.json({ ok: true, user: result.user });
});

/** Dashboard Room — danh sách 5 phòng voice + ghế. */
app.get("/api/room/overview", (req, res) => {
  const me = requireRoomModerator(req, res);
  if (!me) return;
  res.json({
    ok: true,
    me: { id: me.id, username: me.username, role: me.role },
    rooms: voiceRoomStore.listAllRooms(),
    canAccessRoomAdmin: canAccessRoomAdmin(me),
  });
});

app.post("/api/room/set-open", (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const roomId = Number(req.body?.roomId);
  const open = !!req.body?.open;
  if (!canControlVoiceRoomLock(me, roomId)) {
    return res.status(403).json({
      ok: false,
      reason: "Cần được admin cấp đúng Room# này (hoặc mainadmin)",
    });
  }
  const result = voiceRoomStore.staffSetOpen(roomId, open);
  if (!result.ok) return res.status(400).json(result);
  if (isRoomId(roomId)) broadcastVoiceRoom(io, roomId);
  audit(me, "room_set_open", {
    detail: `room=${roomId} → ${open ? "open" : "closed"}`,
  });
  res.json({ ok: true, room: result.room });
});

app.post("/api/room/set-password", (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const roomId = Number(req.body?.roomId);
  if (!canControlVoiceRoomLock(me, roomId)) {
    return res.status(403).json({
      ok: false,
      reason: "Cần được admin cấp đúng Room# này (hoặc mainadmin)",
    });
  }
  const result = voiceRoomStore.staffSetPassword(roomId, req.body?.password);
  if (!result.ok) return res.status(400).json(result);
  if (isRoomId(roomId)) broadcastVoiceRoom(io, roomId);
  audit(me, "room_set_password", {
    detail: `room=${roomId} hasPassword=${result.room.hasPassword}`,
  });
  res.json({ ok: true, room: result.room });
});

app.post("/api/admin/voice-room-grants", (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  if (!canGrantVoiceRooms(me)) {
    return res.status(403).json({
      ok: false,
      reason: "Chỉ mainadmin / admin cấp Room#",
    });
  }
  const userId = String(req.body?.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const result = authStore.setVoiceRoomGrants(userId, req.body?.rooms);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "voice_room_grants", {
    targetId: userId,
    targetName: result.user.username,
    detail: `rooms=${(result.user.voiceRoomGrants ?? []).join(",") || "none"}`,
  });
  res.json({ ok: true, user: result.user });
});

app.post("/api/mainadmin/staff-grant-level", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const raw = req.body?.level;
  const level =
    raw === null || raw === undefined || raw === "" ? null : raw;
  const result = authStore.setStaffGrantLevel(userId, level);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "staff_grant_level", {
    targetId: userId,
    targetName: result.user.username,
    detail:
      result.user.staffGrantLevel != null
        ? `level=${result.user.staffGrantLevel}`
        : "level=role-default",
  });
  res.json({ ok: true, user: result.user });
});

app.post("/api/room/force-mute", (req, res) => {
  const me = requireRoomModerator(req, res);
  if (!me) return;
  const targetSocketId = String(req.body?.targetSocketId ?? "").trim();
  const muted = !!req.body?.muted;
  if (!targetSocketId) {
    return res.status(400).json({ ok: false, reason: "Thiếu targetSocketId" });
  }
  const result = voiceRoomStore.staffForceMute(targetSocketId, muted);
  if (!result.ok) return res.status(400).json(result);
  io.to(targetSocketId).emit("voice:forceMuted", {
    muted,
    room: result.room,
  });
  broadcastVoiceRoom(io, result.roomId);
  audit(me, "room_force_mute", {
    detail: `room=${result.roomId} target=${targetSocketId} muted=${muted}`,
  });
  res.json({ ok: true, room: result.room });
});

app.post("/api/room/kick", (req, res) => {
  const me = requireRoomModerator(req, res);
  if (!me) return;
  const targetSocketId = String(req.body?.targetSocketId ?? "").trim();
  if (!targetSocketId) {
    return res.status(400).json({ ok: false, reason: "Thiếu targetSocketId" });
  }
  const result = voiceRoomStore.kick("", targetSocketId, true);
  if (!result.ok) return res.status(400).json(result);
  const targetSock = io.sockets.sockets.get(targetSocketId);
  if (targetSock) void targetSock.leave(`voice:${result.roomId}`);
  io.to(targetSocketId).emit("voice:kicked", {
    reason: "Mod đã mời bạn ra khỏi phòng voice",
    room: result.room,
  });
  io.to(`voice:${result.roomId}`).emit("voice:peerLeft", {
    socketId: targetSocketId,
    room: result.room,
  });
  broadcastVoiceRoom(io, result.roomId);
  audit(me, "room_kick", {
    detail: `room=${result.roomId} target=${targetSocketId}`,
  });
  res.json({ ok: true, room: result.room });
});

app.post("/api/room/clear", (req, res) => {
  const me = requireRoomModerator(req, res);
  if (!me) return;
  const roomId = Number(req.body?.roomId);
  const result = voiceRoomStore.staffClearRoom(roomId);
  if (!result.ok) return res.status(400).json(result);
  for (const sid of result.kicked) {
    const sock = io.sockets.sockets.get(sid);
    if (sock && isRoomId(roomId)) void sock.leave(`voice:${roomId}`);
    io.to(sid).emit("voice:kicked", {
      reason: "Mod đã dọn phòng voice",
      room: result.room,
    });
  }
  if (isRoomId(roomId)) broadcastVoiceRoom(io, roomId);
  audit(me, "room_clear", {
    detail: `room=${roomId} kicked=${result.kicked.length}`,
  });
  res.json({ ok: true, room: result.room, kicked: result.kicked.length });
});

/** Public: bảng màu + label cảnh giới (chip UI). */
app.get("/api/cultivation/colors", (_req, res) => {
  res.json({ ok: true, ...cultivationStore.getPublic() });
});

/** Tu Tiên / mainadmin: overview gán rank + màu. */
app.get("/api/tutien/overview", (req, res) => {
  const me = requireCultivationManager(req, res);
  if (!me) return;
  res.json({
    ok: true,
    me: { id: me.id, username: me.username, role: me.role },
    users: authStore.listUsers(),
    cultivation: cultivationStore.getPublic(),
    stats: engine.getOnlineStats(),
  });
});

app.get("/api/tutien/cultivation/colors", (req, res) => {
  const me = requireCultivationManager(req, res);
  if (!me) return;
  res.json({ ok: true, ...cultivationStore.getPublic() });
});

app.post("/api/tutien/cultivation/colors", (req, res) => {
  const me = requireCultivationManager(req, res);
  if (!me) return;
  const result = cultivationStore.setColors(
    req.body?.colors ?? req.body,
    me.username,
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "cultivation_colors", {
    detail: `updatedBy=${me.username}`,
  });
  res.json({ ok: true, ...cultivationStore.getPublic() });
});

/** Mainadmin: lợi ích + phí duy trì 9 bậc */
app.post("/api/mainadmin/cultivation/config", (req, res) => {
  const me = requireMainAdmin(req, res);
  if (!me) return;
  const result = cultivationStore.setBenefitsAndMaintenance(
    {
      benefits: req.body?.benefits,
      maintenance: req.body?.maintenance,
    },
    me.username,
  );
  if (!result.ok) return res.status(400).json(result);
  audit(me, "cultivation_config", { detail: "benefits+maintenance" });
  res.json({ ok: true, ...cultivationStore.getPublic() });
});

/** Tu Tiên / mainadmin: gán hoặc xóa cảnh giới. */
app.post("/api/admin/cultivation/rank", (req, res) => {
  const me = requireCultivationManager(req, res);
  if (!me) return;
  const userId = String(req.body?.userId ?? "").trim();
  const rawRank = req.body?.rank;
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  let rank: import("./cultivationRanks.js").CultivationRank | null = null;
  if (rawRank === null || rawRank === undefined || rawRank === "") {
    rank = null;
  } else if (isCultivationRank(rawRank)) {
    rank = rawRank;
  } else {
    return res.status(400).json({ ok: false, reason: "Cảnh giới không hợp lệ" });
  }
  const result = authStore.setCultivationRank(userId, rank);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "cultivation_rank", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail: rank ?? "cleared",
  });
  engine.refreshAllClients();
  res.json({ ok: true, user: result.user });
});

/** Mainadmin: ẩn/hiện user trên bảng xếp hạng Tarot */
app.post("/api/mainadmin/user-leaderboard-hide", (req, res) => {
  const me = requireCapability(req, res, "tools_lookup", "Cần quyền tra cứu (audit)");
  if (!me) return;
  const userId = String(req.body?.userId ?? "").trim();
  const hidden = !!req.body?.hidden;
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const result = authStore.setHideFromLeaderboard(userId, hidden);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "user_leaderboard_hide", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail: hidden ? "hide" : "show",
  });
  engine.refreshAllClients();
  res.json(result);
});

/** Mainadmin: ẩn nick công khai (displayName → Ẩn danh) */
app.post("/api/mainadmin/user-hide-nickname", (req, res) => {
  const me = requireCapability(req, res, "tools_lookup", "Cần quyền tra cứu (audit)");
  if (!me) return;
  const userId = String(req.body?.userId ?? "").trim();
  const hidden = !!req.body?.hidden;
  if (!userId) {
    return res.status(400).json({ ok: false, reason: "Thiếu userId" });
  }
  const result = authStore.setHideNickname(userId, hidden);
  if (!result.ok) return res.status(400).json(result);
  audit(me, "user_hide_nickname", {
    targetId: result.user.id,
    targetName: result.user.username,
    detail: hidden ? "hide" : "show",
  });
  engine.refreshAllClients();
  res.json(result);
});

app.post("/api/mainadmin/ips/kick", async (req, res) => {
  const me = requireCapability(req, res, "ip_audit", "Cần quyền IP (audit)");
  if (!me) return;
  const ip = String(req.body?.ip ?? "").trim();
  if (!ip) return res.status(400).json({ ok: false, reason: "Thiếu IP" });
  const sids = guestIpStore.getSocketIdsForIp(ip);
  kickSocketIds(sids, "Mainadmin kick theo IP");
  audit(me, "ip_kick", { detail: `${ip} · ${sids.length} socket` });
  res.json({
    ok: true,
    kicked: sids.length,
    rows: await enrichIpRows(),
  });
});

app.post("/api/mainadmin/ips/block", async (req, res) => {
  const me = requireCapability(req, res, "ip_audit", "Cần quyền IP (audit)");
  if (!me) return;
  const ip = String(req.body?.ip ?? "").trim();
  const hours = Number(req.body?.hours ?? 0);
  const result = guestIpStore.setBlock(ip, hours);
  if (!result.ok) return res.status(400).json(result);
  if (hours > 0) {
    kickSocketIds(
      guestIpStore.getSocketIdsForIp(ip),
      "IP bị chặn bởi mainadmin",
    );
  }
  audit(me, hours > 0 ? "ip_block" : "ip_unblock", {
    detail: `${ip} · ${hours}h`,
  });
  res.json({
    ok: true,
    blockedUntil: result.blockedUntil,
    rows: await enrichIpRows(),
  });
});

app.get("/api/mainadmin/devices", async (req, res) => {
  if (!requireCapability(req, res, "ip_audit", "Cần quyền IP (audit)")) return;
  const limit = Number(req.query.limit ?? 200);
  res.json({ ok: true, devices: deviceStore.listForAdmin(limit) });
});

app.post("/api/mainadmin/devices/block", async (req, res) => {
  const me = requireCapability(req, res, "ip_audit", "Cần quyền IP (audit)");
  if (!me) return;
  const deviceId = String(req.body?.deviceId ?? "");
  const hours = Number(req.body?.hours ?? 0);
  const note = String(req.body?.note ?? "");
  const result = deviceStore.setBlock(deviceId, hours, note);
  if (!result.ok) return res.status(400).json(result);
  const norm = normalizeDeviceId(deviceId);
  if (hours > 0 && norm) {
    kickSocketIds(
      deviceStore.getSocketIdsForDevice(norm),
      "Thiết bị bị chặn bởi mainadmin",
    );
  }
  audit(me, hours > 0 ? "device_block" : "device_unblock", {
    detail: `${norm ?? deviceId} · ${hours}h`,
  });
  res.json({
    ok: true,
    blockedUntil: result.blockedUntil,
    rows: await enrichIpRows(),
    devices: deviceStore.listForAdmin(200),
  });
});

app.post("/api/mainadmin/devices/kick", async (req, res) => {
  const me = requireCapability(req, res, "ip_audit", "Cần quyền IP (audit)");
  if (!me) return;
  const deviceId = normalizeDeviceId(req.body?.deviceId);
  if (!deviceId) {
    return res.status(400).json({ ok: false, reason: "deviceId không hợp lệ" });
  }
  kickSocketIds(
    deviceStore.getSocketIdsForDevice(deviceId),
    "Bị kick theo thiết bị",
  );
  audit(me, "device_kick", { detail: deviceId });
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  const connIp = socketIp(socket);
  if (!rateLimit(`conn:${connIp}`, 15, 60_000)) {
    socket.disconnect(true);
    return;
  }
  const tracked = trackSocketConnect(connIp, socket.id, 25);
  if (!tracked.ok) {
    socket.disconnect(true);
    return;
  }

  socket.on(
    "join",
    (payload?: {
      name?: string;
      token?: string;
      avatar?: string;
      guestCode?: string;
      guestBalance?: number;
      deviceId?: string;
      device?: unknown;
    }) => {
      const ip = socketIp(socket);
      if (!rateLimit(`join:${ip}`, 30, 60_000)) {
        socket.emit("joinRejected", { reason: "Quá nhiều lần vào phòng" });
        return;
      }
      const deviceId = normalizeDeviceId(payload?.deviceId);
      if (deviceId && deviceStore.isBlocked(deviceId)) {
        socket.emit("joinRejected", {
          reason:
            deviceStore.blockReason(deviceId) ??
            "Thiết bị bị tạm khóa — liên hệ admin",
        });
        return;
      }
      const token = payload?.token;
      const peekId = authStore.peekTokenUserId(token);
      if (peekId && authStore.isBanned(peekId)) {
        const u = authStore.getById(peekId);
        const reason = u?.banReason
          ? `Tài khoản bị khóa: ${u.banReason}`
          : "Tài khoản bị khóa";
        authStore.revokeToken(token);
        socket.emit("joinRejected", { reason });
        socket.emit("sessionReplaced", { reason });
        socket.disconnect(true);
        return;
      }
      const authUser = authStore.resolveToken(token);
      if (token && !authUser) {
        socket.emit("joinRejected", {
          reason: "Phiên đăng nhập hết hạn — đăng nhập lại",
        });
        return;
      }
      if (!authUser) {
        if (guestIpStore.isBlocked(ip)) {
          socket.emit("joinRejected", {
            reason: "IP tạm bị chặn — thử lại sau hoặc đăng ký",
          });
          return;
        }
        const claimed = guestIpStore.claimGuest(
          ip,
          String(payload?.guestCode ?? ""),
          socket.id,
        );
        if (!claimed.ok) {
          socket.emit("joinRejected", { reason: claimed.reason });
          return;
        }
        kickSocketIds(
          claimed.socketIdsToKick,
          "Phiên khách khác trên cùng IP",
        );
      }

      const joined = engine.join(socket.id, {
        name: payload?.name,
        userId: authUser?.id,
        avatar: payload?.avatar,
        guestCode: authUser ? undefined : payload?.guestCode,
        guestBalance: authUser ? undefined : Number(payload?.guestBalance),
      });
      if (!joined.ok) {
        socket.emit("joinRejected", { reason: joined.reason });
        socket.emit("sessionReplaced", { reason: joined.reason });
        socket.disconnect(true);
        return;
      }
      for (const sid of joined.kickedSocketIds) {
        io.to(sid).emit("sessionReplaced", {
          reason: "Đã đăng nhập ở tab khác",
        });
        io.sockets.sockets.get(sid)?.disconnect(true);
      }

      if (authUser) {
        authStore.recordIp(authUser.id, ip);
        guestIpStore.touchLive({
          ip,
          socketId: socket.id,
          kind: "user",
          userId: authUser.id,
          username: authUser.username,
          name: joined.session.name,
        });
      } else {
        guestIpStore.touchLive({
          ip,
          socketId: socket.id,
          kind: "guest",
          guestCode: String(payload?.guestCode ?? "")
            .trim()
            .toUpperCase(),
          name: joined.session.name,
        });
      }

      if (deviceId) {
        deviceStore.recordTouch({
          deviceId,
          ip,
          meta: sanitizeDeviceMeta(payload?.device),
          socketId: socket.id,
          userId: authUser?.id,
          username: authUser?.username,
          guestCode: authUser
            ? undefined
            : String(payload?.guestCode ?? "").trim().toUpperCase(),
        });
      }

      socket.emit("joined", {
        id: joined.session.id,
        name: joined.session.name,
        balance: joined.session.balance,
        userId: joined.session.userId,
        avatar: joined.session.avatar,
        recoveredBets: !!joined.recoveredOrphan,
        guestPlayExpired: joined.guestPlayExpired,
        guestPlayRemainingMs: joined.guestPlayRemainingMs,
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
      const ip = socketIp(socket);
      if (!rateLimit(`bet:${socket.id}`, 40, 10_000) || !rateLimit(`betip:${ip}`, 80, 10_000)) {
        const result = { ok: false as const, reason: "Đặt xu quá nhanh" };
        socket.emit("betRejected", { reason: result.reason });
        ack?.(result);
        return;
      }
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
      const ip = socketIp(socket);
      if (
        !rateLimit(`shout:${socket.id}`, 12, 30_000) ||
        !rateLimit(`shoutip:${ip}`, 40, 30_000)
      ) {
        ack?.({ ok: false, reason: "Chat quá nhanh — chờ chút" });
        return;
      }
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

  socket.on("getBalanceLeaderboard", () => {
    const viewerUserId = engine.getUserIdForSocket(socket.id);
    socket.emit(
      "balanceLeaderboardData",
      authStore.listBalanceLeaders(20, viewerUserId),
    );
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
    trackSocketDisconnect(connIp, socket.id);
    deviceStore.onDisconnect(socket.id);
    guestIpStore.onDisconnect(socket.id);
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

/** Phí duy trì cảnh giới + vault→Inter link */
setInterval(() => {
  try {
    const fees = authStore.processCultivationFees();
    if (fees.charged || fees.demoted) {
      console.log(
        `[cultivation] fees charged=${fees.charged} demoted=${fees.demoted}`,
      );
      engine.refreshAllClients();
    }
  } catch (err) {
    console.warn("[cultivation] fee tick failed:", err);
  }
  try {
    const tarot = vaultStore.getSnapshot();
    const arcana = vaultArcana.getSnapshot();
    const r = interStore.applyVaultSignals([
      {
        key: "tarot",
        netFromPlay: tarot.netFromPlay ?? tarot.netHouse,
        edgePct: tarot.health?.edgePct,
        blendEdgePct: tarot.health?.blendEdgePct,
        flags: tarot.interFlags ?? {
          interSignal: true,
          interWeightPct: 100,
          interPriority: 10,
          lossThresholdXu: 0,
          profitThresholdXu: 0,
          onLossMode: "",
          onProfitMode: "",
          usePercent: true,
          lossPct: 8,
          profitPct: 12,
        },
      },
      {
        key: "arcana",
        netFromPlay: arcana.netFromPlay ?? arcana.netHouse,
        edgePct: arcana.health?.edgePct,
        blendEdgePct: arcana.health?.blendEdgePct,
        flags: arcana.interFlags ?? {
          interSignal: false,
          interWeightPct: 50,
          interPriority: 5,
          lossThresholdXu: 0,
          profitThresholdXu: 0,
          onLossMode: "",
          onProfitMode: "",
          usePercent: true,
          lossPct: 10,
          profitPct: 15,
        },
      },
    ]);
    if (r.applied) {
      console.log(
        `[inter] vault-auto → ${r.mode} (${r.reason}${r.source ? ` · ${r.source}` : ""})`,
      );
    }
  } catch (err) {
    console.warn("[inter] vault link tick failed:", err);
  }
}, 5 * 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`[server] Tarot demo listening on http://localhost:${PORT}`);
  if (existsSync(CLIENT_DIST)) {
    console.log(`[server] Serving client from ${CLIENT_DIST}`);
  }
});
