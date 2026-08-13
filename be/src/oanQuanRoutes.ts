import type { Express, Request, Response } from "express";
import { authStore } from "./auth.js";
import { oanQuanRoomStore } from "./oanQuanRoomStore.js";
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

export function mountOanQuanRoutes(app: Express) {
  app.get("/api/oan-quan/rooms", (_req, res) => {
    res.json({
      ok: true,
      rooms: oanQuanRoomStore.listOpen(),
      stakePresets: oanQuanRoomStore.stakePresets(),
    });
  });

  app.post("/api/oan-quan/rooms", (req, res) => {
    const ip = clientIp(req);
    if (!rateLimit(`oan-create:${ip}`, 40, 60_000)) {
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
    const vsBot = req.body?.vsBot !== false && req.body?.mode !== "pvp";
    const mode = String(req.body?.mode || "").toLowerCase();
    const resolvedVsBot = mode === "pvp" ? false : vsBot;
    const autoStart =
      req.body?.autoStart !== false && resolvedVsBot;

    const room = oanQuanRoomStore.createRoom({
      userId: a.userId,
      guestId: a.guestId,
      displayName: a.displayName,
      stake,
      vsBot: resolvedVsBot,
      autoStart,
    });
    if ("error" in room) {
      res.status(400).json({ ok: false, reason: room.error });
      return;
    }
    res.json({ ok: true, room });
  });

  app.post("/api/oan-quan/rooms/:id/start", (req, res) => {
    const a = actor(req);
    if (!a.userId && !a.guestId) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập hoặc guest" });
      return;
    }
    const out = oanQuanRoomStore.startRoom(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/oan-quan/rooms/:id/join", (req, res) => {
    const a = actor(req);
    if (!a.userId && !a.guestId) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập hoặc guest" });
      return;
    }
    const out = oanQuanRoomStore.joinRoom(String(req.params.id || ""), {
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

  app.get("/api/oan-quan/rooms/:id", (req, res) => {
    const ip = clientIp(req);
    if (!rateLimit(`oan-poll:${ip}`, 240, 60_000)) {
      res.status(429).json({
        ok: false,
        reason: "Poll quá nhanh — thử lại sau vài giây",
      });
      return;
    }
    const room = oanQuanRoomStore.get(String(req.params.id || ""));
    if (!room) {
      res.status(404).json({ ok: false, reason: "Không thấy phòng" });
      return;
    }
    res.json({ ok: true, room });
  });

  app.post("/api/oan-quan/rooms/:id/sow", (req, res) => {
    const a = actor(req);
    const pitIndex = Math.floor(Number(req.body?.pitIndex));
    if (!Number.isFinite(pitIndex)) {
      res.status(400).json({ ok: false, reason: "Thiếu pitIndex" });
      return;
    }
    const out = oanQuanRoomStore.sow(String(req.params.id || ""), pitIndex, {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.post("/api/oan-quan/rooms/:id/reconnect", (req: Request, res: Response) => {
    const a = actor(req);
    const out = oanQuanRoomStore.reconnect(String(req.params.id || ""), {
      userId: a.userId,
      guestId: a.guestId,
    });
    if ("error" in out) {
      res.status(404).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });

  app.get("/api/admin/oan-quan/rooms", (req, res) => {
    const user = bearerUser(req);
    if (!user || (user.role !== "mainadmin" && user.role !== "admin")) {
      res.status(403).json({ ok: false, reason: "Forbidden" });
      return;
    }
    res.json({
      ok: true,
      rooms: oanQuanRoomStore.listAdmin(80),
      stakePresets: oanQuanRoomStore.stakePresets(),
    });
  });

  app.post("/api/admin/oan-quan/rooms/:id/close", (req, res) => {
    const user = bearerUser(req);
    if (!user || user.role !== "mainadmin") {
      res.status(403).json({ ok: false, reason: "Chỉ mainadmin" });
      return;
    }
    const out = oanQuanRoomStore.adminClose(String(req.params.id || ""));
    if ("error" in out) {
      res.status(400).json({ ok: false, reason: out.error });
      return;
    }
    res.json({ ok: true, room: out });
  });
}
