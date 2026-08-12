import type { Server, Socket } from "socket.io";
import {
  authStore,
  canControlVoiceRoomLock,
  canModerateVoiceRoom,
  userDisplayName,
} from "./auth.js";
import { auditStore } from "./auditStore.js";
import { normalizeAvatar } from "./avatars.js";
import { cultivationStore } from "./cultivationStore.js";
import { voicePriority } from "./statusBenefits.js";
import { computeVipTier } from "./vipTiers.js";
import { computeNobilityTier } from "./nobilityRanks.js";
import { rateLimit } from "./rateLimit.js";
import { feePocketStore } from "./feePocketStore.js";
import { voiceLixiStore } from "./voiceLixiStore.js";
import {
  voiceRoomStore,
  type VoiceRoomId,
  type VoiceRoomPublic,
} from "./voiceRoomStore.js";

type Ack = (r: unknown) => void;

export type VoiceBalanceSync = (
  userId: string,
  balance: number,
) => { socketIds: string[]; balance: number };

let balanceSync: VoiceBalanceSync | undefined;

/** Gọi sau khi GameEngine sẵn sàng — cập nhật số dư live trên bàn. */
export function setVoiceBalanceSync(fn: VoiceBalanceSync) {
  balanceSync = fn;
}

function resolveVoiceUser(token?: string) {
  const user = authStore.resolveToken(token);
  if (!user) return { ok: false as const, reason: "Cần đăng nhập để vào phòng voice" };
  if (user.banned) return { ok: false as const, reason: "Tài khoản bị khóa" };
  if (user.muted) {
    return { ok: false as const, reason: "Đang bị mute — không vào voice" };
  }
  return { ok: true as const, user };
}

function emitRoom(
  io: Server,
  roomId: VoiceRoomId,
  room: VoiceRoomPublic,
) {
  io.to(`voice:${roomId}`).emit("voice:room", room);
  io.emit("voice:lobby", voiceRoomStore.listLobby());
}

/** REST / dashboard — đồng bộ trạng thái phòng ra socket. */
export function broadcastVoiceRoom(io: Server, roomId: VoiceRoomId) {
  emitRoom(io, roomId, voiceRoomStore.getRoom(roomId));
}

export function attachVoiceSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("voice:list", (_payload?: unknown, ack?: Ack) => {
      const lobby = voiceRoomStore.listLobby();
      socket.emit("voice:lobby", lobby);
      ack?.({ ok: true, lobby });
    });

    socket.on("voice:lixi-config", (_payload?: unknown, ack?: Ack) => {
      ack?.({ ok: true, config: voiceLixiStore.getPublic() });
      socket.emit("voice:lixiConfig", voiceLixiStore.getPublic());
    });

    socket.on(
      "voice:lixi",
      (
        payload: { amount?: unknown; token?: string; note?: string },
        ack?: Ack,
      ) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          const r = { ok: false as const, reason: auth.reason };
          socket.emit("voice:error", r);
          ack?.(r);
          return;
        }
        if (
          !rateLimit(`voice:lixi:${auth.user.id}`, 5, 60_000) ||
          !rateLimit(`voice:lixi:sock:${socket.id}`, 5, 60_000)
        ) {
          const r = {
            ok: false as const,
            reason: "Phát lì xì quá nhanh — thử lại sau",
          };
          ack?.(r);
          return;
        }
        const mem = voiceRoomStore.getMembership(socket.id);
        if (!mem) {
          const r = {
            ok: false as const,
            reason: "Cần ngồi trong Room để phát lì xì",
          };
          ack?.(r);
          return;
        }
        const recipients = voiceRoomStore.listSeatedUserIds(
          mem.roomId,
          auth.user.id,
        );
        if (recipients.length === 0) {
          const r = {
            ok: false as const,
            reason: "Cần ít nhất 1 người khác trong Room",
          };
          ack?.(r);
          return;
        }
        const cfg = voiceLixiStore.getPublic();
        const result = authStore.sendRoomLixi(
          auth.user.id,
          recipients.map((r) => r.userId),
          payload?.amount,
          cfg.payoutPct,
        );
        if (!result.ok) {
          ack?.(result);
          return;
        }

        if (result.fee > 0) {
          feePocketStore.collectFee({
            source: "lixi",
            amount: result.fee,
            userId: auth.user.id,
            username: auth.user.username,
            note: `Lì xì Room${mem.roomId} phí ${100 - result.payoutPct}%`,
            ref: String(mem.roomId),
          });
        }

        if (balanceSync) {
          const fromLive = balanceSync(result.from.id, result.from.balance);
          for (const sid of fromLive.socketIds) {
            io.to(sid).emit("balanceUpdate", { balance: fromLive.balance });
          }
          for (const share of result.shares) {
            const live = balanceSync(share.userId, share.user.balance);
            for (const sid of live.socketIds) {
              io.to(sid).emit("balanceUpdate", { balance: live.balance });
              io.to(sid).emit("giftReceived", {
                amount: share.amount,
                fromName:
                  result.from.displayName?.trim() || result.from.username,
                giftKey: "lixi",
                giftEmoji: "🧧",
                giftNameVi: "Lì xì Room",
                note: `Room ${mem.roomId}`,
              });
            }
          }
        }

        const note = String(payload?.note ?? "").trim().slice(0, 40);
        const event = {
          roomId: mem.roomId,
          fromName: result.from.displayName?.trim() || result.from.username,
          fromUserId: result.from.id,
          amount: result.amount,
          pool: result.pool,
          fee: result.fee,
          payoutPct: result.payoutPct,
          recipientCount: result.shares.length,
          shares: result.shares.map((s) => ({
            userId: s.userId,
            name: s.user.displayName?.trim() || s.user.username,
            amount: s.amount,
          })),
          note: note || undefined,
          at: Date.now(),
        };
        io.to(`voice:${mem.roomId}`).emit("voice:lixi", event);

        auditStore.log({
          actorId: auth.user.id,
          actorName: auth.user.username,
          action: "voice_lixi",
          detail: `room=${mem.roomId} amount=${result.amount} pool=${result.pool} fee=${result.fee} pct=${result.payoutPct}% n=${result.shares.length}${note ? ` note=${note}` : ""}`,
        });

        ack?.({ ok: true, ...event });
      },
    );

    socket.on(
      "voice:join",
      (
        payload: {
          roomId?: number;
          seat?: number;
          token?: string;
          password?: string;
        },
        ack?: Ack,
      ) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          const r = { ok: false as const, reason: auth.reason };
          socket.emit("voice:error", r);
          ack?.(r);
          return;
        }
        const benefit = cultivationStore.getBenefit(
          auth.user.cultivationRank ?? null,
        );
        const vipTier = computeVipTier(auth.user);
        const nobilityTier = computeNobilityTier(
          auth.user.gemSpentLifetime ?? 0,
        );
        const result = voiceRoomStore.join({
          socketId: socket.id,
          roomId: payload?.roomId,
          seat: payload?.seat,
          userId: auth.user.id,
          name: userDisplayName(auth.user),
          avatar: normalizeAvatar(auth.user.avatar),
          voiceSeatPriority: voicePriority(
            vipTier,
            nobilityTier,
            benefit.voiceSeatPriority,
          ),
          password: payload?.password,
        });
        if (!result.ok) {
          socket.emit("voice:error", result);
          ack?.(result);
          return;
        }

        if (result.leftRoomId && result.leftRoomId !== result.room.roomId) {
          void socket.leave(`voice:${result.leftRoomId}`);
          emitRoom(
            io,
            result.leftRoomId,
            voiceRoomStore.getRoom(result.leftRoomId),
          );
        }

        void socket.join(`voice:${result.room.roomId}`);
        const response = {
          ok: true as const,
          room: result.room,
          seat: result.seat,
          isHost: result.isHost,
          peers: result.peers,
        };
        socket.emit("voice:joined", response);
        socket.to(`voice:${result.room.roomId}`).emit("voice:peerJoined", {
          roomId: result.room.roomId,
          peer: result.room.seats.find((s) => s?.socketId === socket.id),
          room: result.room,
        });
        emitRoom(io, result.room.roomId, result.room);
        ack?.(response);
      },
    );

    socket.on(
      "voice:moveSeat",
      (payload: { seat?: number; token?: string }, ack?: Ack) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          ack?.({ ok: false, reason: auth.reason });
          return;
        }
        const result = voiceRoomStore.moveSeat(socket.id, payload?.seat);
        if (!result.ok) {
          ack?.(result);
          return;
        }
        emitRoom(io, result.room.roomId, result.room);
        ack?.({ ok: true, room: result.room, seat: result.seat });
      },
    );

    socket.on("voice:leave", (_payload?: unknown, ack?: Ack) => {
      const left = voiceRoomStore.leave(socket.id);
      if (left.left && left.roomId && left.room) {
        void socket.leave(`voice:${left.roomId}`);
        socket.to(`voice:${left.roomId}`).emit("voice:peerLeft", {
          socketId: socket.id,
          room: left.room,
        });
        emitRoom(io, left.roomId, left.room);
      }
      ack?.({ ok: true });
    });

    socket.on(
      "voice:mute",
      (payload: { muted?: boolean; token?: string }, ack?: Ack) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          ack?.({ ok: false, reason: auth.reason });
          return;
        }
        const result = voiceRoomStore.setSelfMute(
          socket.id,
          !!payload?.muted,
        );
        if (!result.ok) {
          ack?.(result);
          return;
        }
        emitRoom(io, result.room.roomId, result.room);
        ack?.({ ok: true, room: result.room });
      },
    );

    socket.on(
      "voice:forceMute",
      (
        payload: { targetSocketId?: string; muted?: boolean; token?: string },
        ack?: Ack,
      ) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          ack?.({ ok: false, reason: auth.reason });
          return;
        }
        const asMod = canModerateVoiceRoom(auth.user);
        const result = voiceRoomStore.forceMute(
          socket.id,
          String(payload?.targetSocketId ?? ""),
          !!payload?.muted,
          asMod,
        );
        if (!result.ok) {
          ack?.(result);
          return;
        }
        io.to(result.targetSocketId).emit("voice:forceMuted", {
          muted: !!payload?.muted,
          room: result.room,
        });
        emitRoom(io, result.room.roomId, result.room);
        ack?.({ ok: true, room: result.room });
      },
    );

    socket.on(
      "voice:kick",
      (
        payload: { targetSocketId?: string; token?: string },
        ack?: Ack,
      ) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          ack?.({ ok: false, reason: auth.reason });
          return;
        }
        const asMod = canModerateVoiceRoom(auth.user);
        const target = String(payload?.targetSocketId ?? "");
        const result = voiceRoomStore.kick(socket.id, target, asMod);
        if (!result.ok) {
          ack?.(result);
          return;
        }
        const targetSock = io.sockets.sockets.get(target);
        if (targetSock) void targetSock.leave(`voice:${result.roomId}`);
        io.to(target).emit("voice:kicked", {
          reason: "Host/Mod đã mời bạn ra khỏi phòng voice",
          room: result.room,
        });
        socket.to(`voice:${result.roomId}`).emit("voice:peerLeft", {
          socketId: target,
          room: result.room,
        });
        emitRoom(io, result.roomId, result.room);
        auditStore.log({
          actorId: auth.user.id,
          actorName: auth.user.username,
          action: "voice_kick",
          detail: `room=${result.roomId} target=${target}`,
        });
        ack?.({ ok: true, room: result.room });
      },
    );

    socket.on(
      "voice:claimHost",
      (payload: { token?: string }, ack?: Ack) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          ack?.({ ok: false, reason: auth.reason });
          return;
        }
        const result = voiceRoomStore.claimHost(
          socket.id,
          canModerateVoiceRoom(auth.user),
        );
        if (!result.ok) {
          ack?.(result);
          return;
        }
        emitRoom(io, result.room.roomId, result.room);
        ack?.({ ok: true, room: result.room });
      },
    );

    socket.on(
      "voice:setOpen",
      (payload: { open?: boolean; token?: string }, ack?: Ack) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          ack?.({ ok: false, reason: auth.reason });
          return;
        }
        const mem = voiceRoomStore.getMembership(socket.id);
        const canLock = mem
          ? canControlVoiceRoomLock(auth.user, mem.roomId)
          : false;
        const result = voiceRoomStore.setOpen(
          socket.id,
          !!payload?.open,
          canLock,
        );
        if (!result.ok) {
          ack?.(result);
          return;
        }
        emitRoom(io, result.room.roomId, result.room);
        auditStore.log({
          actorId: auth.user.id,
          actorName: auth.user.username,
          action: "voice_set_open",
          detail: `room=${result.room.roomId} open=${!!payload?.open}`,
        });
        ack?.({ ok: true, room: result.room });
      },
    );

    socket.on(
      "voice:setPassword",
      (payload: { password?: string; token?: string }, ack?: Ack) => {
        const auth = resolveVoiceUser(payload?.token);
        if (!auth.ok) {
          ack?.({ ok: false, reason: auth.reason });
          return;
        }
        const mem = voiceRoomStore.getMembership(socket.id);
        const canLock = mem
          ? canControlVoiceRoomLock(auth.user, mem.roomId)
          : false;
        const result = voiceRoomStore.setPassword(
          socket.id,
          payload?.password,
          canLock,
        );
        if (!result.ok) {
          ack?.(result);
          return;
        }
        emitRoom(io, result.room.roomId, result.room);
        auditStore.log({
          actorId: auth.user.id,
          actorName: auth.user.username,
          action: "voice_set_password",
          detail: `room=${result.room.roomId} hasPassword=${result.room.hasPassword}`,
        });
        ack?.({ ok: true, room: result.room });
      },
    );

    socket.on(
      "voice:signal",
      (payload: {
        toSocketId?: string;
        data?: unknown;
        token?: string;
      }) => {
        if (!rateLimit(`voice:signal:${socket.id}`, 60, 10_000)) return;
        const to = String(payload?.toSocketId ?? "");
        if (!to || !payload?.data) return;
        const fromMem = voiceRoomStore.getMembership(socket.id);
        const toMem = voiceRoomStore.getMembership(to);
        if (!fromMem || !toMem || fromMem.roomId !== toMem.roomId) return;
        io.to(to).emit("voice:signal", {
          fromSocketId: socket.id,
          data: payload.data,
        });
      },
    );

    socket.on("disconnect", () => {
      const left = voiceRoomStore.leave(socket.id);
      if (left.left && left.roomId && left.room) {
        socket.to(`voice:${left.roomId}`).emit("voice:peerLeft", {
          socketId: socket.id,
          room: left.room,
        });
        emitRoom(io, left.roomId, left.room);
      }
    });
  });
}
