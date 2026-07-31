import type { Express, Request, Response } from "express";
import { authStore } from "./auth.js";
import { ludoRoomStore } from "./ludoRoomStore.js";
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

  app.post("/api/ludo/rooms", (req, res) => {
    const ip = clientIp(req);
    if (!rateLimit(`ludo-create:${ip}`, 20, 60_000)) {
      res.status(429).json({ ok: false, reason: "Quá nhanh" });
      return;
    }
    const a = actor(req);
    if (!a.userId && !a.guestId) {
      res.status(401).json({ ok: false, reason: "Cần đăng nhập hoặc guest" });
      return;
    }
    const stake = Math.floor(Number(req.body?.stake) || 0);
    const room = ludoRoomStore.createRoom({
      userId: a.userId,
      guestId: a.guestId,
      displayName: a.displayName,
      stake: Number.isFinite(stake) ? Math.min(stake, 100_000) : 0,
      fillBots: req.body?.fillBots !== false,
    });
    res.json({ ok: true, room });
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
    const out = ludoRoomStore.pick(String(req.params.id || ""), tokenId, {
      userId: a.userId,
      guestId: a.guestId,
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
