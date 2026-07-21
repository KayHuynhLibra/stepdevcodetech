import type { Server, Socket } from "socket.io";
import {
  authStore,
  canModerateVoiceRoom,
  userDisplayName,
} from "./auth.js";
import { auditStore } from "./auditStore.js";
import { normalizeAvatar } from "./avatars.js";
import { cultivationStore } from "./cultivationStore.js";
import {
  voiceRoomStore,
  type VoiceRoomId,
  type VoiceRoomPublic,
} from "./voiceRoomStore.js";

type Ack = (r: unknown) => void;

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

    socket.on(
      "voice:join",
      (
        payload: {
          roomId?: number;
          seat?: number;
          token?: string;
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
        const result = voiceRoomStore.join({
          socketId: socket.id,
          roomId: payload?.roomId,
          seat: payload?.seat,
          userId: auth.user.id,
          name: userDisplayName(auth.user),
          avatar: normalizeAvatar(auth.user.avatar),
          voiceSeatPriority: benefit.voiceSeatPriority,
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
        const result = voiceRoomStore.setOpen(
          socket.id,
          !!payload?.open,
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
      "voice:signal",
      (payload: {
        toSocketId?: string;
        data?: unknown;
        token?: string;
      }) => {
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
