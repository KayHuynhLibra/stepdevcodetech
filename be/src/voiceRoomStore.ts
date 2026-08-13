import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** Voice lounge — 5 phòng × 8 ghế (ephemeral, tách bàn Tarot). */

export const VOICE_ROOM_COUNT = 5;
export const VOICE_SEATS_PER_ROOM = 8;
/** Mesh HD: tối đa cam bật cùng lúc / phòng (tránh 8×720p). */
export const VOICE_MAX_LIVE_CAMS = 4;

export type VoiceRoomId = 1 | 2 | 3 | 4 | 5;
export type VoiceSeatIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/** voice = chỉ mic · live = cho phép bật cam (opt-in từng người) */
export type VoiceMediaMode = "voice" | "live";

export interface VoiceSeatPublic {
  seat: VoiceSeatIndex;
  socketId: string;
  userId: string;
  name: string;
  avatar: string;
  muted: boolean;
  forceMuted: boolean;
  /** Đang gửi camera (chỉ khi room.mediaMode === live) */
  videoOn: boolean;
  joinedAt: number;
}

export interface VoiceRoomPublic {
  roomId: VoiceRoomId;
  hostSocketId: string | null;
  hostUserId: string | null;
  seats: (VoiceSeatPublic | null)[];
  occupied: number;
  /** Host/staff có thể đóng — không cho join mới */
  open: boolean;
  /** Có mật khẩu vào phòng (không lộ hash) */
  hasPassword: boolean;
  mediaMode: VoiceMediaMode;
}

interface SeatInternal {
  socketId: string;
  userId: string;
  name: string;
  avatar: string;
  muted: boolean;
  forceMuted: boolean;
  videoOn: boolean;
  joinedAt: number;
  voiceSeatPriority: number;
}

interface RoomInternal {
  hostSocketId: string | null;
  hostUserId: string | null;
  seats: (SeatInternal | null)[];
  open: boolean;
  passwordHash: string | null;
  passwordSalt: string | null;
  mediaMode: VoiceMediaMode;
}

function emptySeats(): (SeatInternal | null)[] {
  return Array.from({ length: VOICE_SEATS_PER_ROOM }, () => null);
}

function isRoomId(v: unknown): v is VoiceRoomId {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= VOICE_ROOM_COUNT;
}

function isSeatIndex(v: unknown): v is VoiceSeatIndex {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= VOICE_SEATS_PER_ROOM;
}

function hashRoomPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(`${salt}:${password}`, "utf8")
    .digest("hex");
}

function passwordOk(room: RoomInternal, password: unknown): boolean {
  if (!room.passwordHash || !room.passwordSalt) return true;
  const pw = String(password ?? "");
  if (!pw) return false;
  const h = hashRoomPassword(pw, room.passwordSalt);
  try {
    const a = Buffer.from(h, "hex");
    const b = Buffer.from(room.passwordHash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function toPublicSeat(
  seat: VoiceSeatIndex,
  s: SeatInternal,
): VoiceSeatPublic {
  return {
    seat,
    socketId: s.socketId,
    userId: s.userId,
    name: s.name,
    avatar: s.avatar,
    muted: s.muted,
    forceMuted: s.forceMuted,
    videoOn: !!s.videoOn,
    joinedAt: s.joinedAt,
  };
}

function toPublicRoom(roomId: VoiceRoomId, room: RoomInternal): VoiceRoomPublic {
  const seats = room.seats.map((s, i) =>
    s ? toPublicSeat((i + 1) as VoiceSeatIndex, s) : null,
  );
  return {
    roomId,
    hostSocketId: room.hostSocketId,
    hostUserId: room.hostUserId,
    seats,
    occupied: seats.filter(Boolean).length,
    open: room.open !== false,
    hasPassword: !!(room.passwordHash && room.passwordSalt),
    mediaMode: room.mediaMode === "live" ? "live" : "voice",
  };
}

class VoiceRoomStore {
  private rooms = new Map<VoiceRoomId, RoomInternal>();
  /** socketId → room đang ngồi */
  private bySocket = new Map<string, VoiceRoomId>();

  constructor() {
    for (let i = 1; i <= VOICE_ROOM_COUNT; i++) {
      this.rooms.set(i as VoiceRoomId, {
        hostSocketId: null,
        hostUserId: null,
        seats: emptySeats(),
        open: true,
        passwordHash: null,
        passwordSalt: null,
        mediaMode: "voice",
      });
    }
  }

  listLobby(): VoiceRoomPublic[] {
    const out: VoiceRoomPublic[] = [];
    for (let i = 1; i <= VOICE_ROOM_COUNT; i++) {
      const id = i as VoiceRoomId;
      out.push(toPublicRoom(id, this.rooms.get(id)!));
    }
    return out;
  }

  getRoom(roomId: VoiceRoomId): VoiceRoomPublic {
    return toPublicRoom(roomId, this.rooms.get(roomId)!);
  }

  getMembership(socketId: string): {
    roomId: VoiceRoomId;
    seat: VoiceSeatIndex;
  } | null {
    const roomId = this.bySocket.get(socketId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId)!;
    const idx = room.seats.findIndex((s) => s?.socketId === socketId);
    if (idx < 0) return null;
    return { roomId, seat: (idx + 1) as VoiceSeatIndex };
  }

  /** User đang ngồi trong phòng (unique), có thể exclude người gửi lì xì */
  listSeatedUserIds(
    roomId: VoiceRoomId,
    excludeUserId?: string,
  ): { userId: string; name: string; avatar: string }[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const seen = new Set<string>();
    const out: { userId: string; name: string; avatar: string }[] = [];
    for (const s of room.seats) {
      if (!s?.userId) continue;
      if (excludeUserId && s.userId === excludeUserId) continue;
      if (seen.has(s.userId)) continue;
      seen.add(s.userId);
      out.push({ userId: s.userId, name: s.name, avatar: s.avatar });
    }
    return out;
  }

  join(opts: {
    socketId: string;
    roomId: unknown;
    seat?: unknown;
    userId: string;
    name: string;
    avatar: string;
    voiceSeatPriority?: number;
    password?: unknown;
  }):
    | {
        ok: true;
        room: VoiceRoomPublic;
        seat: VoiceSeatIndex;
        isHost: boolean;
        peers: VoiceSeatPublic[];
        leftRoomId?: VoiceRoomId;
      }
    | { ok: false; reason: string } {
    if (!isRoomId(opts.roomId)) {
      return { ok: false, reason: "Phòng không hợp lệ" };
    }
    const roomId = opts.roomId;
    let leftRoomId: VoiceRoomId | undefined;

    // Một socket chỉ 1 ghế — rời phòng cũ nếu có
    const prev = this.getMembership(opts.socketId);
    if (prev) {
      if (prev.roomId === roomId && opts.seat == null) {
        const room = this.getRoom(roomId);
        const peers = room.seats.filter(
          (s): s is VoiceSeatPublic =>
            !!s && s.socketId !== opts.socketId,
        );
        return {
          ok: true,
          room,
          seat: prev.seat,
          isHost: room.hostSocketId === opts.socketId,
          peers,
        };
      }
      this.leave(opts.socketId);
      leftRoomId = prev.roomId;
    }

    // Cùng user chỉ 1 ghế — đá ghế cũ (socket khác)
    for (const [sid, rid] of this.bySocket) {
      if (sid === opts.socketId) continue;
      const r = this.rooms.get(rid)!;
      const hit = r.seats.find((s) => s?.userId === opts.userId);
      if (hit) {
        this.leave(sid);
        leftRoomId = rid;
      }
    }

    const room = this.rooms.get(roomId)!;
    if (room.open === false) {
      return { ok: false, reason: "Phòng đang đóng" };
    }
    if (!passwordOk(room, opts.password)) {
      return { ok: false, reason: "Sai mật khẩu phòng" };
    }

    const priority = Math.max(
      0,
      Math.min(8, Math.floor(opts.voiceSeatPriority ?? 0)),
    );

    let seatIdx: number;
    if (opts.seat != null && opts.seat !== "") {
      if (!isSeatIndex(opts.seat)) {
        return { ok: false, reason: "Ghế không hợp lệ" };
      }
      seatIdx = opts.seat - 1;
      if (room.seats[seatIdx]) {
        return { ok: false, reason: "Ghế đã có người" };
      }
    } else {
      // Ưu tiên ghế trống số nhỏ; bậc cao được ưu tiên khi tranh (auto)
      const empty: number[] = [];
      for (let i = 0; i < room.seats.length; i++) {
        if (!room.seats[i]) empty.push(i);
      }
      if (empty.length === 0) {
        return { ok: false, reason: "Phòng đầy" };
      }
      // Ghế thấp hơn trước; nếu nhiều người join cùng lúc, priority chỉ metadata
      seatIdx = empty[0]!;
      // Soft bump: bậc cao lấy ghế gần giữa nếu còn trống nhiều
      if (priority >= 4 && empty.length > 1) {
        const mid = empty[Math.floor(empty.length / 2)]!;
        seatIdx = mid;
      }
    }

    const seatNum = (seatIdx + 1) as VoiceSeatIndex;
    const now = Date.now();
    room.seats[seatIdx] = {
      socketId: opts.socketId,
      userId: opts.userId,
      name: String(opts.name || "Player").slice(0, 24),
      avatar: String(opts.avatar || ""),
      muted: false,
      forceMuted: false,
      videoOn: false,
      joinedAt: now,
      voiceSeatPriority: priority,
    };
    this.bySocket.set(opts.socketId, roomId);

    if (!room.hostSocketId) {
      room.hostSocketId = opts.socketId;
      room.hostUserId = opts.userId;
    }

    const pub = toPublicRoom(roomId, room);
    const peers = pub.seats.filter(
      (s): s is VoiceSeatPublic => !!s && s.socketId !== opts.socketId,
    );
    return {
      ok: true,
      room: pub,
      seat: seatNum,
      isHost: room.hostSocketId === opts.socketId,
      peers,
      leftRoomId,
    };
  }

  moveSeat(
    socketId: string,
    seatRaw: unknown,
  ):
    | { ok: true; room: VoiceRoomPublic; seat: VoiceSeatIndex }
    | { ok: false; reason: string } {
    const mem = this.getMembership(socketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    if (!isSeatIndex(seatRaw)) {
      return { ok: false, reason: "Ghế không hợp lệ" };
    }
    const room = this.rooms.get(mem.roomId)!;
    const from = mem.seat - 1;
    const to = seatRaw - 1;
    if (from === to) {
      return { ok: true, room: this.getRoom(mem.roomId), seat: mem.seat };
    }
    if (room.seats[to]) return { ok: false, reason: "Ghế đã có người" };
    const seat = room.seats[from];
    if (!seat || seat.socketId !== socketId) {
      return { ok: false, reason: "Ghế không hợp lệ" };
    }
    room.seats[to] = seat;
    room.seats[from] = null;
    return {
      ok: true,
      room: toPublicRoom(mem.roomId, room),
      seat: seatRaw,
    };
  }

  leave(socketId: string): {
    left: boolean;
    roomId?: VoiceRoomId;
    room?: VoiceRoomPublic;
    hostChanged?: boolean;
  } {
    const roomId = this.bySocket.get(socketId);
    if (!roomId) return { left: false };
    const room = this.rooms.get(roomId)!;
    const idx = room.seats.findIndex((s) => s?.socketId === socketId);
    if (idx >= 0) room.seats[idx] = null;
    this.bySocket.delete(socketId);

    let hostChanged = false;
    if (room.hostSocketId === socketId) {
      const next = [...room.seats]
        .filter((s): s is SeatInternal => !!s)
        .sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) {
        room.hostSocketId = next.socketId;
        room.hostUserId = next.userId;
      } else {
        room.hostSocketId = null;
        room.hostUserId = null;
      }
      hostChanged = true;
    }

    return {
      left: true,
      roomId,
      room: toPublicRoom(roomId, room),
      hostChanged,
    };
  }

  setSelfMute(
    socketId: string,
    muted: boolean,
  ): { ok: true; room: VoiceRoomPublic } | { ok: false; reason: string } {
    const mem = this.getMembership(socketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    const room = this.rooms.get(mem.roomId)!;
    const seat = room.seats[mem.seat - 1];
    if (!seat) return { ok: false, reason: "Ghế không hợp lệ" };
    seat.muted = !!muted;
    return { ok: true, room: toPublicRoom(mem.roomId, room) };
  }

  /** Bật/tắt camera — chỉ khi phòng đang Live; mỗi người tự opt-in. */
  setSelfVideo(
    socketId: string,
    videoOn: boolean,
  ): { ok: true; room: VoiceRoomPublic } | { ok: false; reason: string } {
    const mem = this.getMembership(socketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    const room = this.rooms.get(mem.roomId)!;
    if (room.mediaMode !== "live" && videoOn) {
      return {
        ok: false,
        reason: "Phòng đang Voice — Host bật Live để dùng camera",
      };
    }
    const seat = room.seats[mem.seat - 1];
    if (!seat) return { ok: false, reason: "Ghế không hợp lệ" };
    if (videoOn && !seat.videoOn) {
      const onCount = room.seats.filter((s) => s?.videoOn).length;
      if (onCount >= VOICE_MAX_LIVE_CAMS) {
        return {
          ok: false,
          reason: `Tối đa ${VOICE_MAX_LIVE_CAMS} camera HD / phòng`,
        };
      }
    }
    seat.videoOn = !!videoOn && room.mediaMode === "live";
    return { ok: true, room: toPublicRoom(mem.roomId, room) };
  }

  /** Host hoặc staff: Voice ↔ Live. Chuyển về Voice thì tắt hết cam. */
  setMediaMode(
    actorSocketId: string,
    modeRaw: unknown,
    asStaff: boolean,
  ): { ok: true; room: VoiceRoomPublic } | { ok: false; reason: string } {
    const mem = this.getMembership(actorSocketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    const room = this.rooms.get(mem.roomId)!;
    if (!asStaff && room.hostSocketId !== actorSocketId) {
      return { ok: false, reason: "Chỉ host / staff đổi chế độ Live" };
    }
    const mode: VoiceMediaMode = modeRaw === "live" ? "live" : "voice";
    room.mediaMode = mode;
    if (mode === "voice") {
      for (const s of room.seats) {
        if (s) s.videoOn = false;
      }
    }
    return { ok: true, room: toPublicRoom(mem.roomId, room) };
  }

  forceMute(
    actorSocketId: string,
    targetSocketId: string,
    muted: boolean,
    asStaff: boolean,
  ):
    | { ok: true; room: VoiceRoomPublic; targetSocketId: string }
    | { ok: false; reason: string } {
    const mem = this.getMembership(actorSocketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    const room = this.rooms.get(mem.roomId)!;
    if (!asStaff && room.hostSocketId !== actorSocketId) {
      return { ok: false, reason: "Chỉ host / staff" };
    }
    const tMem = this.getMembership(targetSocketId);
    if (!tMem || tMem.roomId !== mem.roomId) {
      return { ok: false, reason: "Người đó không trong phòng" };
    }
    const seat = room.seats[tMem.seat - 1];
    if (!seat) return { ok: false, reason: "Ghế trống" };
    seat.forceMuted = !!muted;
    if (muted) seat.muted = true;
    return {
      ok: true,
      room: toPublicRoom(mem.roomId, room),
      targetSocketId,
    };
  }

  /** Host/staff tắt cam một người (opt-out bắt buộc). */
  forceVideoOff(
    actorSocketId: string,
    targetSocketId: string,
    asStaff: boolean,
  ):
    | { ok: true; room: VoiceRoomPublic; targetSocketId: string }
    | { ok: false; reason: string } {
    const mem = this.getMembership(actorSocketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    const room = this.rooms.get(mem.roomId)!;
    if (!asStaff && room.hostSocketId !== actorSocketId) {
      return { ok: false, reason: "Chỉ host / staff" };
    }
    const tMem = this.getMembership(targetSocketId);
    if (!tMem || tMem.roomId !== mem.roomId) {
      return { ok: false, reason: "Người đó không trong phòng" };
    }
    const seat = room.seats[tMem.seat - 1];
    if (!seat) return { ok: false, reason: "Ghế trống" };
    seat.videoOn = false;
    return {
      ok: true,
      room: toPublicRoom(mem.roomId, room),
      targetSocketId,
    };
  }

  kick(
    actorSocketId: string,
    targetSocketId: string,
    asStaff: boolean,
  ):
    | {
        ok: true;
        room: VoiceRoomPublic;
        targetSocketId: string;
        roomId: VoiceRoomId;
      }
    | { ok: false; reason: string } {
    const mem = this.getMembership(actorSocketId);
    if (!mem && !asStaff) {
      return { ok: false, reason: "Bạn chưa ngồi ghế" };
    }
    const tMem = this.getMembership(targetSocketId);
    if (!tMem) return { ok: false, reason: "Người đó không trong phòng" };
    if (mem && tMem.roomId !== mem.roomId && !asStaff) {
      return { ok: false, reason: "Khác phòng" };
    }
    const room = this.rooms.get(tMem.roomId)!;
    if (!asStaff && room.hostSocketId !== actorSocketId) {
      return { ok: false, reason: "Chỉ host / staff" };
    }
    if (targetSocketId === actorSocketId) {
      return { ok: false, reason: "Không tự kick" };
    }
    const left = this.leave(targetSocketId);
    return {
      ok: true,
      room: left.room!,
      targetSocketId,
      roomId: tMem.roomId,
    };
  }

  claimHost(
    socketId: string,
    asStaff: boolean,
  ): { ok: true; room: VoiceRoomPublic } | { ok: false; reason: string } {
    if (!asStaff) return { ok: false, reason: "Chỉ staff" };
    const mem = this.getMembership(socketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    const room = this.rooms.get(mem.roomId)!;
    const seat = room.seats[mem.seat - 1];
    if (!seat) return { ok: false, reason: "Ghế trống" };
    room.hostSocketId = socketId;
    room.hostUserId = seat.userId;
    return { ok: true, room: toPublicRoom(mem.roomId, room) };
  }

  /**
   * Đóng/mở phòng — chỉ khi caller có quyền lock (Room# grant / mainadmin).
   * Không còn dựa vào host thường.
   */
  setOpen(
    actorSocketId: string,
    open: boolean,
    canLock: boolean,
  ):
    | { ok: true; room: VoiceRoomPublic }
    | { ok: false; reason: string } {
    const mem = this.getMembership(actorSocketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    if (!canLock) {
      return {
        ok: false,
        reason: "Cần được admin cấp đúng Room# này để đóng/mở",
      };
    }
    const room = this.rooms.get(mem.roomId)!;
    room.open = !!open;
    return { ok: true, room: toPublicRoom(mem.roomId, room) };
  }

  /** Đặt / xóa mật khẩu phòng — cùng quyền lock như đóng phòng. */
  setPassword(
    actorSocketId: string,
    passwordRaw: unknown,
    canLock: boolean,
  ):
    | { ok: true; room: VoiceRoomPublic }
    | { ok: false; reason: string } {
    const mem = this.getMembership(actorSocketId);
    if (!mem) return { ok: false, reason: "Bạn chưa ngồi ghế" };
    if (!canLock) {
      return {
        ok: false,
        reason: "Cần được admin cấp đúng Room# này để đặt mật khẩu",
      };
    }
    const room = this.rooms.get(mem.roomId)!;
    const pw = String(passwordRaw ?? "").trim();
    if (!pw) {
      room.passwordHash = null;
      room.passwordSalt = null;
    } else {
      if (pw.length < 4 || pw.length > 32) {
        return { ok: false, reason: "Mật khẩu 4–32 ký tự" };
      }
      const salt = randomBytes(8).toString("hex");
      room.passwordSalt = salt;
      room.passwordHash = hashRoomPassword(pw, salt);
    }
    return { ok: true, room: toPublicRoom(mem.roomId, room) };
  }

  /** Dashboard: mở/đóng theo roomId (caller đã check grant). */
  staffSetOpen(
    roomIdRaw: unknown,
    open: boolean,
  ): { ok: true; room: VoiceRoomPublic } | { ok: false; reason: string } {
    if (!isRoomId(roomIdRaw)) return { ok: false, reason: "Phòng không hợp lệ" };
    const room = this.rooms.get(roomIdRaw)!;
    room.open = !!open;
    return { ok: true, room: toPublicRoom(roomIdRaw, room) };
  }

  staffSetPassword(
    roomIdRaw: unknown,
    passwordRaw: unknown,
  ): { ok: true; room: VoiceRoomPublic } | { ok: false; reason: string } {
    if (!isRoomId(roomIdRaw)) return { ok: false, reason: "Phòng không hợp lệ" };
    const room = this.rooms.get(roomIdRaw)!;
    const pw = String(passwordRaw ?? "").trim();
    if (!pw) {
      room.passwordHash = null;
      room.passwordSalt = null;
    } else {
      if (pw.length < 4 || pw.length > 32) {
        return { ok: false, reason: "Mật khẩu 4–32 ký tự" };
      }
      const salt = randomBytes(8).toString("hex");
      room.passwordSalt = salt;
      room.passwordHash = hashRoomPassword(pw, salt);
    }
    return { ok: true, room: toPublicRoom(roomIdRaw, room) };
  }

  /** Mod/staff từ dashboard — mute không cần ngồi cùng phòng. */
  staffForceMute(
    targetSocketId: string,
    muted: boolean,
  ):
    | {
        ok: true;
        room: VoiceRoomPublic;
        targetSocketId: string;
        roomId: VoiceRoomId;
      }
    | { ok: false; reason: string } {
    const tMem = this.getMembership(targetSocketId);
    if (!tMem) return { ok: false, reason: "Người đó không trong phòng" };
    const room = this.rooms.get(tMem.roomId)!;
    const seat = room.seats[tMem.seat - 1];
    if (!seat) return { ok: false, reason: "Ghế trống" };
    seat.forceMuted = !!muted;
    if (muted) seat.muted = true;
    return {
      ok: true,
      room: toPublicRoom(tMem.roomId, room),
      targetSocketId,
      roomId: tMem.roomId,
    };
  }

  staffForceVideoOff(targetSocketId: string):
    | {
        ok: true;
        room: VoiceRoomPublic;
        targetSocketId: string;
        roomId: VoiceRoomId;
      }
    | { ok: false; reason: string } {
    const tMem = this.getMembership(targetSocketId);
    if (!tMem) return { ok: false, reason: "Người đó không trong phòng" };
    const room = this.rooms.get(tMem.roomId)!;
    const seat = room.seats[tMem.seat - 1];
    if (!seat) return { ok: false, reason: "Ghế trống" };
    seat.videoOn = false;
    return {
      ok: true,
      room: toPublicRoom(tMem.roomId, room),
      targetSocketId,
      roomId: tMem.roomId,
    };
  }

  staffSetMediaMode(
    roomIdRaw: unknown,
    modeRaw: unknown,
  ): { ok: true; room: VoiceRoomPublic } | { ok: false; reason: string } {
    if (!isRoomId(roomIdRaw)) return { ok: false, reason: "Phòng không hợp lệ" };
    const room = this.rooms.get(roomIdRaw)!;
    const mode: VoiceMediaMode = modeRaw === "live" ? "live" : "voice";
    room.mediaMode = mode;
    if (mode === "voice") {
      for (const s of room.seats) {
        if (s) s.videoOn = false;
      }
    }
    return { ok: true, room: toPublicRoom(roomIdRaw, room) };
  }

  /** Mod/staff: đuổi hết người trong 1 phòng. */
  staffClearRoom(roomIdRaw: unknown): {
    ok: true;
    room: VoiceRoomPublic;
    kicked: string[];
  } | { ok: false; reason: string } {
    if (!isRoomId(roomIdRaw)) return { ok: false, reason: "Phòng không hợp lệ" };
    const room = this.rooms.get(roomIdRaw)!;
    const kicked: string[] = [];
    for (const seat of [...room.seats]) {
      if (!seat) continue;
      kicked.push(seat.socketId);
      this.leave(seat.socketId);
    }
    return {
      ok: true,
      room: toPublicRoom(roomIdRaw, this.rooms.get(roomIdRaw)!),
      kicked,
    };
  }

  listAllRooms(): VoiceRoomPublic[] {
    return this.listLobby();
  }
}

export const voiceRoomStore = new VoiceRoomStore();
export { isRoomId, isSeatIndex };
