import type { Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import { normalizeAvatar, DEFAULT_AVATAR } from "../avatars";
import {
  canControlVoiceRoomLock,
  canModerateVoiceRoom,
  type AuthUser,
} from "../auth";
import { useVoiceRoom } from "../voice/useVoiceRoom";
import type { VoiceRoomId, VoiceSeatIndex } from "../voice/types";
import { VOICE_ROOM_COUNT, VOICE_SEATS_PER_ROOM } from "../voice/types";

interface VoiceRoomHubProps {
  open: boolean;
  socket: Socket | null;
  me: AuthUser | null;
  sessionAuthed: boolean;
  onClose: () => void;
  onOpen: () => void;
  onNeedLogin: () => void;
  /** Báo GamePage để hiện Room #N / Off trên header */
  onStatus?: (s: {
    inRoom: boolean;
    roomId: number | null;
    isHost: boolean;
    roomOpen: boolean;
  }) => void;
}

export function VoiceRoomHub({
  open,
  socket,
  me,
  sessionAuthed,
  onClose,
  onOpen,
  onNeedLogin,
  onStatus,
}: VoiceRoomHubProps) {
  const voice = useVoiceRoom({ socket, enabled: !!socket });
  const staff = canModerateVoiceRoom(me);
  const loggedIn = !!(me && sessionAuthed);
  const canLock = !!(
    voice.room && canControlVoiceRoomLock(me, voice.room.roomId)
  );
  const [joinPassword, setJoinPassword] = useState("");
  const [lockPassword, setLockPassword] = useState("");

  useEffect(() => {
    onStatus?.({
      inRoom: voice.status === "inRoom" && !!voice.room,
      roomId: voice.room?.roomId ?? null,
      isHost: voice.isHost,
      roomOpen: voice.room?.open !== false,
    });
  }, [
    voice.status,
    voice.room?.roomId,
    voice.room?.open,
    voice.isHost,
    onStatus,
  ]);

  if (!open) {
    if (voice.status === "inRoom" && voice.room) {
      return (
        <button
          type="button"
          onClick={onOpen}
          className="fixed bottom-24 right-3 z-[55] flex items-center gap-1.5 rounded-full bg-[var(--wood-deep)]/95 px-3 py-2 text-[10px] font-bold text-amber-100 shadow-lg ring-1 ring-[var(--gold)]/40"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              voice.localMuted || voice.forceMuted
                ? "bg-rose-400"
                : "bg-emerald-400"
            }`}
          />
          Room {voice.room.roomId} · ghế {voice.seat}
        </button>
      );
    }
    return null;
  }

  const inRoom = voice.status === "inRoom" && voice.room;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="sheet-shell relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl px-4 pb-5 pt-4 shadow-xl ring-1 ring-[var(--jade)]/40 sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-sm tracking-wide text-[var(--jade-soft)]">
              Room voice
            </p>
            <p className="mt-0.5 text-[11px] text-white/55">
              Giữ ghế khi đổi Tarot ↔ Arcana · đóng / MK chỉ người được cấp đúng
              Room#
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80"
          >
            Đóng
          </button>
        </div>

        {!loggedIn && (
          <div className="rounded-xl bg-amber-500/15 px-3 py-3 ring-1 ring-amber-400/30">
            <p className="text-sm font-semibold text-amber-100">
              Cần đăng nhập để vào Room voice
            </p>
            <p className="mt-1 text-[11px] text-white/60">
              Khách vẫn chơi Tarot bình thường — voice chỉ dành cho tài khoản.
            </p>
            <button
              type="button"
              onClick={onNeedLogin}
              className="mt-3 rounded-full bg-amber-400 px-4 py-2 text-xs font-extrabold text-[#1a1208]"
            >
              Đăng nhập
            </button>
          </div>
        )}

        {loggedIn && voice.error && (
          <p className="mb-2 rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-[11px] text-rose-100 ring-1 ring-rose-400/30">
            {voice.error}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => voice.setError(null)}
            >
              Ẩn
            </button>
          </p>
        )}

        {loggedIn && !inRoom && (
          <div>
            <label className="mb-2 block">
              <span className="text-[10px] font-semibold text-white/50">
                Mật khẩu (nếu phòng có khóa)
              </span>
              <input
                type="password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="Để trống nếu phòng mở"
                className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/20"
              />
            </label>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              Chọn phòng
            </p>
            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: VOICE_ROOM_COUNT }, (_, i) => {
                const id = (i + 1) as VoiceRoomId;
                const row =
                  voice.lobby.find((r) => r.roomId === id) ?? null;
                const occ = row?.occupied ?? 0;
                const full = occ >= VOICE_SEATS_PER_ROOM;
                const closed = row?.open === false;
                const locked = !!row?.hasPassword;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={full || closed || voice.status === "joining"}
                    onClick={() => {
                      voice.refreshLobby();
                      void voice.joinRoom(
                        id,
                        undefined,
                        joinPassword || undefined,
                      );
                    }}
                    className="flex items-center justify-between rounded-xl bg-white/8 px-3 py-3 text-left ring-1 ring-white/12 transition active:scale-[0.99] disabled:opacity-45"
                  >
                    <span>
                      <span className="font-play text-base font-bold text-[var(--cream)]">
                        Room {id}
                        {locked ? " 🔒" : ""}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-white/50">
                        {closed
                          ? "Đang đóng"
                          : full
                            ? "Phòng đầy — chọn phòng khác"
                            : `${occ}/${VOICE_SEATS_PER_ROOM} ghế`}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                        closed
                          ? "bg-rose-800 text-rose-100"
                          : "bg-[var(--wood-deep)] text-amber-100"
                      }`}
                    >
                      {closed
                        ? "Off"
                        : voice.status === "joining"
                          ? "…"
                          : "Vào"}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => voice.refreshLobby()}
              className="mt-3 w-full text-center text-[11px] font-semibold text-white/45 underline"
            >
              Làm mới số ghế
            </button>
          </div>
        )}

        {loggedIn && inRoom && voice.room && (
          <div>
            <div className="mb-3 rounded-xl bg-[#1a1520]/90 px-3 py-2.5 ring-1 ring-white/10">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-white/45">
                Âm thanh
              </p>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-white/90">
                      Mic (Input)
                    </span>
                    <button
                      type="button"
                      onClick={() => voice.toggleMute()}
                      disabled={voice.forceMuted}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        voice.localMuted || voice.forceMuted
                          ? "bg-rose-600 text-white"
                          : "bg-white/12 text-white/85"
                      }`}
                    >
                      {voice.forceMuted
                        ? "Bị mute"
                        : voice.localMuted
                          ? "Mute"
                          : "Unmute"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={voice.inputVolume}
                      disabled={voice.forceMuted || voice.localMuted}
                      onChange={(e) =>
                        voice.setInputVolume(Number(e.target.value))
                      }
                      className="h-1.5 w-full cursor-pointer accent-[#5865f2] disabled:opacity-40"
                      aria-label="Âm lượng mic"
                    />
                    <span className="w-8 shrink-0 text-right font-play text-[10px] tabular-nums text-white/55">
                      {voice.inputVolume}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-white/90">
                      Loa (Output)
                    </span>
                    <button
                      type="button"
                      onClick={() => voice.toggleOutputMute()}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        voice.outputMuted
                          ? "bg-rose-600 text-white"
                          : "bg-white/12 text-white/85"
                      }`}
                    >
                      {voice.outputMuted ? "Mute loa" : "Nghe"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={voice.outputVolume}
                      disabled={voice.outputMuted}
                      onChange={(e) =>
                        voice.setOutputVolume(Number(e.target.value))
                      }
                      className="h-1.5 w-full cursor-pointer accent-[#5865f2] disabled:opacity-40"
                      aria-label="Âm lượng loa"
                    />
                    <span className="w-8 shrink-0 text-right font-play text-[10px] tabular-nums text-white/55">
                      {voice.outputMuted ? 0 : voice.outputVolume}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-play text-sm font-bold text-[var(--cream)]">
                Room {voice.room.roomId}
                {voice.isHost ? (
                  <span className="ml-1.5 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-extrabold text-[#1a1208]">
                    HOST
                  </span>
                ) : null}
                <span className="ml-1.5 text-[10px] font-normal text-white/45">
                  Ghế {voice.seat}
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {staff && !voice.isHost && (
                  <button
                    type="button"
                    onClick={() => voice.claimHost()}
                    className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold text-white"
                  >
                    Claim host
                  </button>
                )}
                {canLock && (
                  <button
                    type="button"
                    onClick={() =>
                      voice.setRoomOpen(!(voice.room?.open !== false))
                    }
                    className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                      voice.room?.open === false
                        ? "bg-emerald-700 text-white"
                        : "bg-rose-700 text-white"
                    }`}
                  >
                    {voice.room?.open === false ? "Mở phòng" : "Đóng phòng"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => voice.leaveRoom()}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold text-white"
                >
                  Rời ghế
                </button>
              </div>
            </div>

            {canLock && (
              <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-white/8 px-2.5 py-2 ring-1 ring-white/12">
                <label className="min-w-[8rem] flex-1">
                  <span className="text-[9px] font-semibold text-white/45">
                    Mật khẩu phòng (cấp Room#)
                  </span>
                  <input
                    type="password"
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    placeholder="4–32 ký tự · trống = xóa"
                    className="mt-0.5 w-full rounded-lg bg-black/20 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-white/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    voice.setRoomPassword(lockPassword);
                    setLockPassword("");
                  }}
                  className="rounded-full bg-amber-500/90 px-3 py-1.5 text-[10px] font-bold text-[#1a1208]"
                >
                  Lưu MK
                </button>
                {voice.room.hasPassword && (
                  <button
                    type="button"
                    onClick={() => voice.setRoomPassword("")}
                    className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold text-white"
                  >
                    Xóa MK
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: VOICE_SEATS_PER_ROOM }, (_, i) => {
                const seatNum = (i + 1) as VoiceSeatIndex;
                const s = voice.room!.seats[i];
                const isMe = s?.socketId === socket?.id;
                return (
                  <div
                    key={seatNum}
                    className={`relative flex flex-col items-center rounded-xl px-1.5 py-2 ring-1 ${
                      isMe
                        ? "bg-amber-400/20 ring-amber-300/50"
                        : s
                          ? "bg-white/8 ring-white/12"
                          : "bg-white/5 ring-dashed ring-white/20"
                    }`}
                  >
                    {s ? (
                      <>
                        <img
                          src={normalizeAvatar(s.avatar) || DEFAULT_AVATAR}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-white/30"
                        />
                        <span className="mt-1 max-w-full truncate text-[9px] font-semibold text-white/85">
                          {s.name}
                        </span>
                        <span className="text-[8px] text-white/40">
                          #{seatNum}
                          {s.muted || s.forceMuted ? " · mute" : ""}
                          {voice.room!.hostSocketId === s.socketId
                            ? " · H"
                            : ""}
                        </span>
                        {(voice.isHost || staff) && !isMe && (
                          <span className="mt-1 flex gap-0.5">
                            <button
                              type="button"
                              className="rounded bg-white/15 px-1 text-[8px] text-white"
                              onClick={() =>
                                voice.forceMutePeer(
                                  s.socketId,
                                  !s.forceMuted,
                                )
                              }
                            >
                              Mute
                            </button>
                            <button
                              type="button"
                              className="rounded bg-rose-600/80 px-1 text-[8px] text-white"
                              onClick={() => voice.kick(s.socketId)}
                            >
                              Kick
                            </button>
                          </span>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        className="flex flex-col items-center"
                        onClick={() => voice.moveSeat(seatNum)}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white/40">
                          +
                        </span>
                        <span className="mt-1 text-[9px] text-white/45">
                          Ghế {seatNum}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-center text-[10px] text-white/40">
              Đóng popup vẫn giữ mic — đổi Tarot ↔ Arcana không mất ghế. Bấm
              «Rời ghế» hoặc về Hub mới thoát voice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
