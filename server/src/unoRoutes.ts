import type { Express, Request, Response } from "express";
import { authStore } from "./auth.js";
import { unoDecorStore } from "./unoDecorStore.js";
import { unoRoomStore } from "./unoRoomStore.js";
import { MAX_SEATS, MIN_PLAYERS, UNO_COLORS, type UnoColor } from "./unoEngine.js";
import { resolveShopPay } from "./gem.js";
import { applyNobilityShopPay } from "./statusBenefits.js";
import { nobilityLabel } from "./nobilityRanks.js";
import { clientIp, rateLimit } from "./rateLimit.js";

function bearerUser(req: Request) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return authStore.resolveToken(h.slice(7).trim());
}

function actor(req: Request): {
  userId: string | null;
  guestId: string | null;
  displayName: string;
} {
  const user = bearerUser(req);
  if (user) {
    return {
      userId: user.id,
      guestId: null,
      displayName: user.nickname || user.code || "Player",
    };
  }
  const guestId = String(
    req.headers["x-guest-id"] || req.body?.guestId || "",
  )
    .trim()
    .toUpperCase()
    .slice(0, 16);
  return {
    userId: null,
    guestId: guestId || null,
    displayName: guestId ? `Khách ${guestId.slice(0, 4)}` : "Khách",
  };
}

function parseColor(v: unknown): UnoColor | undefined {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return UNO_COLORS.includes(s as UnoColor) ? (s as UnoColor) : undefined;
}

export function mountUnoRoutes(app: Express) {
  app.get("/api/uno/rooms", (_req, res) => {
    res.json({
      ok: true,
      rooms: unoRoomStore.listOpen(),
      stakePresets: unoRoomStore.stakePresets(),
      playerCounts: Array.from(
        { length: MAX_SEATS - MIN_PLAYERS + 1 },
        (_, i) => i + MIN_PLAYERS,
      ),
    });
  });

  app.get("/api/uno/shop", (req, res) => {
    const user = bearerUser(req);
    if (!user) {
      res.status(401).json({
        ok: false,
        reason: "Đăng nhập để mở shop",
        catalog: unoDecorStore.catalog(),
      });
      return;
    }
    const snap = unoDecorStore.snapshot(user.id);
    res.json({
      ok: true,
      ...snap,
      balance: user.balance,
      gemBalance: user.gemBalance ?? 0,
    });
  });

  app.post("/api/uno/shop/buy", (req, res) => {
    const user = bearerUser(req);
    if (!user) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập" });
      return;
    }
    const ip = clientIp(req);
    if (!rateLimit(`uno-shop-buy:${user.id}`, 30, 60_000)) {
      res.status(429).json({ ok: false, reason: "Quá nhanh" });
      return;
    }
    if (!rateLimit(`uno-shop-buy-ip:${ip}`, 60, 60_000)) {
      res.status(429).json({ ok: false, reason: "Quá nhanh" });
      return;
    }
    const itemId = String(req.body?.itemId || "").trim();
    const item = unoDecorStore.getItem(itemId);
    if (!item) {
      res.status(400).json({ ok: false, reason: "Không có vật phẩm" });
      return;
    }
    const snap = unoDecorStore.ensureUser(user.id);
    if (snap.ownedIds.includes(itemId)) {
      res.status(400).json({ ok: false, reason: "Đã sở hữu" });
      return;
    }
    const pay = resolveShopPay(item, req.body?.payWith);
    if (!pay.ok) {
      res.status(400).json({ ok: false, reason: pay.reason });
      return;
    }
    const nobilityTier = Math.max(0, Math.floor(user.nobilityTier ?? 0));
    const needNoble = Math.max(0, Math.floor(item.minNobility ?? 0));
    if (needNoble > 0 && nobilityTier < needNoble) {
      res.status(400).json({
        ok: false,
        reason: `Cần bậc Quý tộc ${nobilityLabel(needNoble) || needNoble}+`,
      });
      return;
    }
    const priced = applyNobilityShopPay(pay, nobilityTier);
    let paidXu = 0;
    let paidGem = 0;
    if (priced.currency === "play" && priced.amount > 0) {
      const adj = authStore.adjustBalance(user.id, -priced.amount, {
        lane: "play",
        reason: `uno_shop:${itemId}`,
        gameId: "uno",
      });
      if (!adj.ok) {
        res.status(400).json({ ok: false, reason: adj.reason });
        return;
      }
      paidXu = priced.amount;
    } else if (priced.currency === "gem" && priced.amount > 0) {
      const adj = authStore.spendGem(user.id, priced.amount);
      if (!adj.ok) {
        res.status(400).json({ ok: false, reason: adj.reason });
        return;
      }
      paidGem = priced.amount;
    }
    const grant = unoDecorStore.grantOwned(user.id, itemId);
    if (!grant.ok) {
      if (paidXu > 0) {
        authStore.adjustBalance(user.id, paidXu, {
          lane: "play",
          reason: `uno_shop_refund:${itemId}`,
          gameId: "uno",
        });
      }
      if (paidGem > 0) {
        authStore.refundShopGem(user.id, paidGem);
      }
      res.status(400).json({ ok: false, reason: grant.reason });
      return;
    }
    const fresh = authStore.getById(user.id);
    res.json({
      ok: true,
      ...unoDecorStore.snapshot(user.id),
      balance: fresh?.balance ?? 0,
      gemBalance: fresh?.gemBalance ?? 0,
      gemSpentLifetime: fresh?.gemSpentLifetime ?? 0,
      paidWith: priced.currency === "free" ? "free" : priced.currency,
      discountPct: priced.discountPct || undefined,
    });
  });

  app.post("/api/uno/shop/equip", (req, res) => {
    const user = bearerUser(req);
    if (!user) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập" });
      return;
    }
    const backId =
      req.body?.backId === undefined
        ? undefined
        : req.body.backId === null
          ? null
          : String(req.body.backId);
    const feltId =
      req.body?.feltId === undefined
        ? undefined
        : req.body.feltId === null
          ? null
          : String(req.body.feltId);
    const out = unoDecorStore.equip(user.id, { backId, feltId });
    if (!out.ok) {
      res.status(400).json({ ok: false, reason: out.reason });
      return;
    }
    res.json({ ok: true, ...unoDecorStore.snapshot(user.id) });
  });

  app.post("/api/uno/rooms", (req, res) => {
    const ip = clientIp(req);
    if (!rateLimit(`uno-create:${ip}`, 40, 60_000)) {
      res.status(429).json({
        ok: false,
        reason: "Tạo phòng quá nhanh — đợi vài giây",
      });
      return;
    }
    const a = actor(req);
    if (!a.userId && !a.guestId) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập hoặc guest" });
      return;
    }
    const stakeRaw = Math.floor(Number(req.body?.stake) || 0);
    const stake = Number.isFinite(stakeRaw)
      ? Math.min(Math.max(0, stakeRaw), 100_000)
      : 0;
    if (stake > 0 && !a.userId) {
      res.status(400).json({
        ok: false,
        reason: "Cược xu cần tài khoản đăng nhập",
      });
      return;
    }
    const playerCount = Math.floor(Number(req.body?.playerCount) || 4);
    const fillBots = req.body?.fillBots !== false && req.body?.mode !== "pvp";
    const mode = String(req.body?.mode || "").toLowerCase();
    const resolvedFillBots = mode === "pvp" ? false : fillBots;
    const autoStart =
      req.body?.autoStart !== false && resolvedFillBots;

    const room = unoRoomStore.createRoom({
      userId: a.userId,
      guestId: a.guestId,
      displayName: a.displayName,
      stake,
      playerCount,
      fillBots: resolvedFillBots,
      autoStart,
    });
    if ("error" in room) {
      res.status(400).json({ ok: false, reason: room.error });
      return;
    }
    res.json({ ok: true, room });
  });

  app.post("/api/uno/rooms/:id/start", (req, res) => {
    const a = actor(req);
    if (!a.userId && !a.guestId) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập hoặc guest" });
      return;
    }
    const out = unoRoomStore.startRoom(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/uno/rooms/:id/join", (req, res) => {
    const a = actor(req);
    if (!a.userId && !a.guestId) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập hoặc guest" });
      return;
    }
    const out = unoRoomStore.joinRoom(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
      displayName: a.displayName,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.get("/api/uno/rooms/:id", (req, res) => {
    const ip = clientIp(req);
    if (!rateLimit(`uno-poll:${ip}`, 240, 60_000)) {
      res.status(429).json({
        ok: false,
        reason: "Poll quá nhanh — thử lại sau vài giây",
      });
      return;
    }
    const a = actor(req);
    const room = unoRoomStore.get(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if (!room) {
      res.status(404).json({ ok: false, reason: "Không thấy phòng" });
      return;
    }
    res.json({ ok: true, room });
  });

  app.post("/api/uno/rooms/:id/play", (req, res) => {
    const a = actor(req);
    const cardId = String(req.body?.cardId || "").trim();
    if (!cardId) {
      res.status(400).json({ ok: false, reason: "Thiếu cardId" });
      return;
    }
    const color = parseColor(req.body?.color);
    const out = unoRoomStore.playCard(
      String(req.params.id || ""),
      cardId,
      color,
      { userId: a.userId, guestId: a.guestId },
    );
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/uno/rooms/:id/color", (req, res) => {
    const a = actor(req);
    const color = parseColor(req.body?.color);
    if (!color) {
      res.status(400).json({ ok: false, reason: "Chọn màu hợp lệ" });
      return;
    }
    const out = unoRoomStore.chooseColor(String(req.params.id || ""), color, {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/uno/rooms/:id/draw", (req, res) => {
    const a = actor(req);
    const out = unoRoomStore.drawCard(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/uno/rooms/:id/uno", (req, res) => {
    const a = actor(req);
    const out = unoRoomStore.callUno(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/uno/rooms/:id/catch", (req, res) => {
    const a = actor(req);
    const targetSeat = Math.floor(Number(req.body?.targetSeat));
    if (!Number.isFinite(targetSeat)) {
      res.status(400).json({ ok: false, reason: "Thiếu targetSeat" });
      return;
    }
    const out = unoRoomStore.catchUno(String(req.params.id || ""), targetSeat, {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/uno/rooms/:id/reconnect", (req, res) => {
    const a = actor(req);
    const out = unoRoomStore.reconnect(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.get("/api/admin/uno/rooms", (req, res) => {
    const user = bearerUser(req);
    if (!user || (user.role !== "mainadmin" && user.role !== "admin")) {
      res.status(403).json({ ok: false, reason: "Forbidden" });
      return;
    }
    res.json({
      ok: true,
      rooms: unoRoomStore.listAdmin(80),
      stakePresets: unoRoomStore.stakePresets(),
    });
  });

  app.post("/api/admin/uno/rooms/:id/close", (req, res) => {
    const user = bearerUser(req);
    if (!user || user.role !== "mainadmin") {
      res.status(403).json({ ok: false, reason: "Chỉ mainadmin" });
      return;
    }
    const out = unoRoomStore.adminClose(String(req.params.id || ""));
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });
}
