import type { Express, Request, Response } from "express";
import { authStore } from "./auth.js";
import {
  isFreeLudoTheme,
  normalizeLudoThemeId,
} from "./ludoEngine.js";
import {
  LUDO_STAKE_PRESETS,
  ludoDecorStore,
} from "./ludoDecorStore.js";
import { ludoEconomyStore } from "./ludoEconomyStore.js";
import { ludoRoomStore } from "./ludoRoomStore.js";
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

export function mountLudoRoutes(app: Express) {
  app.get("/api/ludo/rooms", (_req, res) => {
    res.json({ ok: true, rooms: ludoRoomStore.listOpen() });
  });

  app.get("/api/ludo/shop", (req, res) => {
    const user = bearerUser(req);
    if (!user) {
      res.status(401).json({
        ok: false,
        reason: "Đăng nhập để mở shop",
        catalog: ludoDecorStore.catalog(),
        stakePresets: ludoEconomyStore.stakePresets(),
      });
      return;
    }
    const snap = ludoDecorStore.snapshot(user.id);
    res.json({
      ok: true,
      ...snap,
      balance: user.balance,
      gemBalance: user.gemBalance ?? 0,
      stakePresets: ludoEconomyStore.stakePresets(),
      botWinMult: ludoEconomyStore.botWinMult(),
    });
  });

  app.get("/api/admin/ludo/economy", (req, res) => {
    const user = bearerUser(req);
    if (!user || (user.role !== "mainadmin" && user.role !== "admin")) {
      res.status(403).json({ ok: false, reason: "Forbidden" });
      return;
    }
    res.json({
      ok: true,
      economy: ludoEconomyStore.get(),
      catalog: ludoDecorStore.catalog(),
    });
  });

  app.get("/api/admin/ludo/rooms", (req, res) => {
    const user = bearerUser(req);
    if (!user || (user.role !== "mainadmin" && user.role !== "admin")) {
      res.status(403).json({ ok: false, reason: "Forbidden" });
      return;
    }
    res.json({
      ok: true,
      rooms: ludoRoomStore.listAdmin(80),
      economy: ludoEconomyStore.get(),
      catalog: ludoDecorStore.catalog(),
    });
  });

  app.post("/api/admin/ludo/rooms/:id/close", (req, res) => {
    const user = bearerUser(req);
    if (!user || user.role !== "mainadmin") {
      res.status(403).json({ ok: false, reason: "Chỉ mainadmin" });
      return;
    }
    const out = ludoRoomStore.adminClose(String(req.params.id || ""));
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/admin/ludo/economy", (req, res) => {
    const user = bearerUser(req);
    if (!user || user.role !== "mainadmin") {
      res.status(403).json({ ok: false, reason: "Chỉ mainadmin" });
      return;
    }
    const economy = ludoEconomyStore.patch({
      stakePresets: req.body?.stakePresets,
      botWinMult: req.body?.botWinMult,
      catalogPrices: req.body?.catalogPrices,
    });
    res.json({
      ok: true,
      economy,
      catalog: ludoDecorStore.catalog(),
    });
  });

  app.post("/api/ludo/shop/buy", (req, res) => {
    const user = bearerUser(req);
    if (!user) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập" });
      return;
    }
    const ip = clientIp(req);
    if (!rateLimit(`ludo-shop-buy:${user.id}`, 30, 60_000)) {
      res.status(429).json({ ok: false, reason: "Quá nhanh" });
      return;
    }
    if (!rateLimit(`ludo-shop-buy-ip:${ip}`, 60, 60_000)) {
      res.status(429).json({ ok: false, reason: "Quá nhanh" });
      return;
    }
    const itemId = String(req.body?.itemId || "").trim();
    const item = ludoDecorStore.getItem(itemId);
    if (!item) {
      res.status(400).json({ ok: false, reason: "Không có vật phẩm" });
      return;
    }
    const snap = ludoDecorStore.ensureUser(user.id);
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
        reason: `ludo_shop:${itemId}`,
        gameId: "ludo",
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
    const grant = ludoDecorStore.grantOwned(user.id, itemId);
    if (!grant.ok) {
      if (paidXu > 0) {
        authStore.adjustBalance(user.id, paidXu, {
          lane: "play",
          reason: `ludo_shop_refund:${itemId}`,
          gameId: "ludo",
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
      ...ludoDecorStore.snapshot(user.id),
      balance: fresh?.balance ?? 0,
      gemBalance: fresh?.gemBalance ?? 0,
      gemSpentLifetime: fresh?.gemSpentLifetime ?? 0,
      paidWith: priced.currency === "free" ? "free" : priced.currency,
      discountPct: priced.discountPct || undefined,
    });
  });

  app.post("/api/ludo/shop/equip", (req, res) => {
    const user = bearerUser(req);
    if (!user) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập" });
      return;
    }
    const frameId =
      req.body?.frameId === undefined
        ? undefined
        : req.body.frameId === null
          ? null
          : String(req.body.frameId);
    const pawnId =
      req.body?.pawnId === undefined
        ? undefined
        : req.body.pawnId === null
          ? null
          : String(req.body.pawnId);
    const boardId =
      req.body?.boardId === undefined
        ? undefined
        : req.body.boardId === null
          ? null
          : String(req.body.boardId);
    const out = ludoDecorStore.equip(user.id, { frameId, pawnId, boardId });
    if (!out.ok) {
      res.status(400).json({ ok: false, reason: out.reason });
      return;
    }
    const roomId = String(req.body?.roomId || "").trim().toUpperCase();
    let room = null;
    if (roomId) {
      const synced = ludoRoomStore.syncPlayerDecor(roomId, user.id);
      if (!("error" in synced)) room = synced;
    }
    res.json({
      ok: true,
      ...ludoDecorStore.snapshot(user.id),
      room,
    });
  });

  app.post("/api/ludo/rooms", (req, res) => {
    const ip = clientIp(req);
    if (!rateLimit(`ludo-create:${ip}`, 40, 60_000)) {
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
    const themeId = normalizeLudoThemeId(req.body?.themeId);
    if (!isFreeLudoTheme(themeId)) {
      if (!a.userId) {
        res.status(400).json({
          ok: false,
          reason: "Bàn cosmetic cần đăng nhập",
        });
        return;
      }
      if (!ludoDecorStore.ownsTheme(a.userId, themeId)) {
        res.status(400).json({
          ok: false,
          reason: "Chưa sở hữu bàn này — mua trong shop",
        });
        return;
      }
    }
    const fillBots = req.body?.fillBots !== false;
    const autoStart = req.body?.autoStart !== false && fillBots;
    const room = ludoRoomStore.createRoom({
      userId: a.userId,
      guestId: a.guestId,
      displayName: a.displayName,
      stake,
      fillBots,
      autoStart,
      themeId,
      diceMode: req.body?.diceMode,
    });
    res.json({ ok: true, room });
  });

  app.post("/api/ludo/rooms/:id/start", (req, res) => {
    const a = actor(req);
    if (!a.userId && !a.guestId) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập hoặc guest" });
      return;
    }
    const out = ludoRoomStore.startRoom(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/ludo/rooms/:id/join", (req, res) => {
    const a = actor(req);
    if (!a.userId && !a.guestId) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập hoặc guest" });
      return;
    }
    const out = ludoRoomStore.joinRoom(String(req.params.id || ""), {
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

  app.get("/api/ludo/rooms/:id", (req, res) => {
    const ip = clientIp(req);
    /* ~4 tab × 1 poll/1.5s ≈ 160/phút — cho dư 240. */
    if (!rateLimit(`ludo-poll:${ip}`, 240, 60_000)) {
      res.status(429).json({
        ok: false,
        reason: "Poll quá nhanh — thử lại sau vài giây",
      });
      return;
    }
    const room = ludoRoomStore.get(String(req.params.id || ""));
    if (!room) {
      res.status(404).json({ ok: false, reason: "Không thấy phòng" });
      return;
    }
    res.json({ ok: true, room });
  });

  app.post("/api/ludo/rooms/:id/roll", (req, res) => {
    const a = actor(req);
    const out = ludoRoomStore.roll(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/ludo/rooms/:id/pick", (req, res) => {
    const a = actor(req);
    const tokenId = String(req.body?.tokenId || "").trim();
    if (!tokenId) {
      res.status(400).json({ ok: false, reason: "Thiếu tokenId" });
      return;
    }
    const dieRaw = req.body?.dieIndex;
    const dieIndex =
      dieRaw === undefined || dieRaw === null || dieRaw === ""
        ? null
        : Math.floor(Number(dieRaw));
    const out = ludoRoomStore.pick(String(req.params.id || ""), tokenId, {
      userId: a.userId,
      guestId: a.guestId,
      dieIndex: Number.isFinite(dieIndex as number) ? dieIndex : null,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/ludo/rooms/:id/reconnect", (req: Request, res: Response) => {
    const a = actor(req);
    const out = ludoRoomStore.reconnect(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(404).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });
}
