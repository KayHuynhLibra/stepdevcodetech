import type { Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { normalizeAvatar, DEFAULT_AVATAR } from "../avatars";
import {
  canControlVoiceRoomLock,
  canModerateVoiceRoom,
  type AuthUser,
} from "../auth";
import { useVoiceRoom } from "../voice/useVoiceRoom";
import type { VoiceRoomId, VoiceSeatIndex } from "../voice/types";
import {
  VOICE_MAX_LIVE_CAMS,
  VOICE_ROOM_COUNT,
  VOICE_SEATS_PER_ROOM,
} from "../voice/types";
import {
  hasCamConsent,
  isHdWebClient,
  setCamConsent,
} from "../voice/videoProfile";

function SeatVideo({
  stream,
  mirror,
  contain,
}: {
  stream: MediaStream;
  mirror?: boolean;
  contain?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={`absolute inset-0 h-full w-full ${
        contain ? "object-contain bg-black" : "object-cover"
      } ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}
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
  const [lixiAmount, setLixiAmount] = useState("10000000");
  const [camConsentOpen, setCamConsentOpen] = useState(false);
  const [camOk, setCamOk] = useState(() => hasCamConsent());

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
      const pipRemote = voice.room.seats.filter(
        (s) =>
          s &&
          s.socketId !== socket?.id &&
          s.videoOn &&
          voice.remoteVideoStreams[s.socketId],
      );
      const showPip =
        voice.room.mediaMode === "live" &&
        (voice.localVideoOn || pipRemote.length > 0);
      return (
        <>
          {showPip ? (
            <div className="fixed bottom-36 right-3 z-[54] flex max-w-[min(100vw-1.5rem,22rem)] gap-1 overflow-x-auto rounded-xl bg-black/70 p-1 ring-1 ring-white/20">
              {voice.localVideoOn && voice.localPreviewStream ? (
                <button
                  type="button"
                  onClick={onOpen}
                  className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black"
                >
                  <SeatVideo stream={voice.localPreviewStream} mirror contain />
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[8px] font-bold text-white">
                    Bạn
                  </span>
                </button>
              ) : null}
              {pipRemote.map((s) => (
                <button
                  key={s!.socketId}
                  type="button"
                  onClick={onOpen}
                  className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black"
                >
                  <SeatVideo
                    stream={voice.remoteVideoStreams[s!.socketId]!}
                    contain
                  />
                  <span className="absolute bottom-0.5 left-0.5 max-w-[90%] truncate rounded bg-black/70 px-1 text-[8px] font-bold text-white">
                    {s!.name}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
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
            {voice.room.mediaMode === "live" ? " · LIVE" : ""}
            {voice.localVideoOn ? " · CAM" : ""}
          </button>
        </>
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
      <div
        className={`sheet-shell relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-2xl px-4 pb-5 pt-4 shadow-xl ring-1 ring-[var(--jade)]/40 sm:rounded-2xl ${
          inRoom && voice.room?.mediaMode === "live"
            ? "max-w-5xl"
            : "max-w-md"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-sm tracking-wide text-[var(--jade-soft)]">
              Room voice / live
            </p>
            <p className="mt-0.5 text-[11px] text-white/55">
              Voice mặc định · Host bật Live · cam opt-in · web HD 720p · tối đa{" "}
              {VOICE_MAX_LIVE_CAMS} cam/phòng
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
                const live = row?.mediaMode === "live";
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
                        {live ? (
                          <span className="ml-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                            LIVE
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-white/50">
                        {closed
                          ? "Đang đóng"
                          : full
                            ? "Phòng đầy — chọn phòng khác"
                            : `${occ}/${VOICE_SEATS_PER_ROOM} ghế · ${live ? "Live video" : "Voice"}`}
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

            <div className="mb-3 rounded-xl bg-[#1a1520]/90 px-3 py-2.5 ring-1 ring-white/10">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Live video {isHdWebClient() ? "· HD 720p" : "· 360p mobile"}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                    voice.room.mediaMode === "live"
                      ? "bg-rose-600 text-white"
                      : "bg-white/12 text-white/70"
                  }`}
                >
                  {voice.room.mediaMode === "live" ? "LIVE" : "VOICE"}
                </span>
              </div>
              <p className="mb-2 text-[10px] text-white/50">
                Cam không tự mở. Tối đa {VOICE_MAX_LIVE_CAMS} người HD / phòng.
                Server không ghi hình — P2P trong phòng.
              </p>
              {voice.iceHint === "failed" || voice.iceHint === "disconnected" ? (
                <p className="mb-2 rounded bg-rose-600/30 px-2 py-1 text-[10px] text-rose-100">
                  Mạng video kém (cần TURN trên 4G/NAT). Vẫn nghe mic nếu STUN
                  ok.
                </p>
              ) : voice.iceHint === "checking" || voice.iceHint === "new" ? (
                <p className="mb-2 text-[10px] text-amber-200/80">
                  Đang kết nối video…
                </p>
              ) : null}
              {(voice.isHost || staff) && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => voice.setMediaMode("voice")}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                      voice.room.mediaMode !== "live"
                        ? "bg-[var(--wood-deep)] text-amber-100"
                        : "bg-white/12 text-white/80"
                    }`}
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => voice.setMediaMode("live")}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                      voice.room.mediaMode === "live"
                        ? "bg-rose-600 text-white"
                        : "bg-white/12 text-white/80"
                    }`}
                  >
                    Live
                  </button>
                </div>
              )}
              {voice.room.mediaMode === "live" && voice.cameras.length > 1 ? (
                <label className="mb-2 block">
                  <span className="text-[9px] font-semibold text-white/45">
                    Camera
                  </span>
                  <select
                    value={voice.cameraId}
                    onChange={(e) => voice.setCameraId(e.target.value)}
                    onFocus={() => void voice.refreshCameras()}
                    className="mt-0.5 w-full rounded-lg bg-black/30 px-2 py-1.5 text-[11px] text-white outline-none ring-1 ring-white/20"
                  >
                    {voice.cameras.map((c, i) => (
                      <option key={c.deviceId || i} value={c.deviceId}>
                        {c.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                disabled={voice.room.mediaMode !== "live"}
                onClick={() => {
                  if (!voice.localVideoOn && !camOk) {
                    setCamConsentOpen(true);
                    return;
                  }
                  voice.toggleVideo();
                }}
                className={`w-full rounded-full px-3 py-2 text-[11px] font-extrabold disabled:opacity-45 ${
                  voice.localVideoOn
                    ? "bg-rose-600 text-white"
                    : "bg-white/12 text-white"
                }`}
              >
                {voice.room.mediaMode !== "live"
                  ? "Bật Live (host) để dùng cam"
                  : voice.localVideoOn
                    ? "Tắt camera"
                    : "Bật camera của tôi"}
              </button>
              {camConsentOpen ? (
                <div className="mt-2 rounded-lg bg-black/40 px-2.5 py-2 ring-1 ring-amber-400/40">
                  <p className="text-[11px] font-semibold text-amber-100">
                    Trước khi bật cam
                  </p>
                  <p className="mt-1 text-[10px] text-white/70">
                    Người trong phòng sẽ thấy hình bạn. Server không lưu video.
                    Không quay/phát lại người khác. 18+.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      className="rounded-full bg-rose-600 px-3 py-1 text-[10px] font-extrabold text-white"
                      onClick={() => {
                        setCamConsent(true);
                        setCamOk(true);
                        setCamConsentOpen(false);
                        void voice.setLocalVideo(true);
                      }}
                    >
                      Đồng ý · bật cam
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold text-white"
                      onClick={() => setCamConsentOpen(false)}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : null}
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

            <div className="mb-3 rounded-xl bg-rose-500/15 px-2.5 py-2 ring-1 ring-rose-400/35">
              <p className="text-[11px] font-bold text-rose-100">
                🧧 Lì xì Room
              </p>
              <p className="mt-0.5 text-[9px] text-white/55">
                Tối thiểu{" "}
                {voice.lixiConfig.minAmount.toLocaleString("vi-VN")} xu · phát{" "}
                {voice.lixiConfig.payoutPct}% cho người ngồi trong phòng (trừ
                bạn) · phần còn lại vào kho
              </p>
              <div className="mt-1.5 flex flex-wrap items-end gap-2">
                <label className="min-w-[7rem] flex-1">
                  <span className="text-[9px] font-semibold text-white/45">
                    Số xu
                  </span>
                  <input
                    type="number"
                    min={voice.lixiConfig.minAmount}
                    step={1_000_000}
                    value={lixiAmount}
                    onChange={(e) => setLixiAmount(e.target.value)}
                    className="mt-0.5 w-full rounded-lg bg-black/25 px-2 py-1.5 text-xs font-semibold text-white outline-none ring-1 ring-white/20"
                  />
                </label>
                <button
                  type="button"
                  disabled={voice.lixiBusy}
                  onClick={() => {
                    const n = Math.floor(Number(lixiAmount));
                    voice.sendLixi(n);
                  }}
                  className="rounded-full bg-rose-600 px-3 py-1.5 text-[10px] font-extrabold text-white disabled:opacity-50"
                >
                  {voice.lixiBusy ? "…" : "Phát lì xì"}
                </button>
              </div>
              {voice.lastLixi && (
                <p className="mt-1.5 text-[10px] font-semibold text-amber-100">
                  {voice.lastLixi}
                </p>
              )}
            </div>

            {voice.room.mediaMode === "live" &&
            voice.room.seats.some(
              (s) =>
                s &&
                (s.videoOn ||
                  (s.socketId === socket?.id && voice.localVideoOn)),
            ) ? (
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {voice.room.seats.map((s) => {
                  if (!s) return null;
                  const isMe = s.socketId === socket?.id;
                  const remoteVid = !isMe
                    ? voice.remoteVideoStreams[s.socketId]
                    : undefined;
                  const showLocalVid =
                    isMe && voice.localVideoOn && voice.localPreviewStream;
                  if (!(showLocalVid || (s.videoOn && remoteVid))) return null;
                  return (
                    <div
                      key={s.socketId}
                      className="relative aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-white/20"
                    >
                      {showLocalVid ? (
                        <SeatVideo
                          stream={voice.localPreviewStream!}
                          mirror
                          contain
                        />
                      ) : (
                        <SeatVideo stream={remoteVid!} contain />
                      )}
                      <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {isMe ? "Bạn" : s.name}
                        {s.videoOn ? " · CAM" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: VOICE_SEATS_PER_ROOM }, (_, i) => {
                const seatNum = (i + 1) as VoiceSeatIndex;
                const s = voice.room!.seats[i];
                const isMe = s?.socketId === socket?.id;
                const remoteVid =
                  s && !isMe
                    ? voice.remoteVideoStreams[s.socketId]
                    : undefined;
                const showLocalVid =
                  isMe && voice.localVideoOn && voice.localPreviewStream;
                const showVid = !!(
                  (showLocalVid || remoteVid) &&
                  (isMe ? true : s?.videoOn)
                );
                return (
                  <div
                    key={seatNum}
                    className={`relative flex flex-col items-center overflow-hidden rounded-xl px-1.5 py-2 ring-1 ${
                      isMe
                        ? "bg-amber-400/20 ring-amber-300/50"
                        : s
                          ? "bg-white/8 ring-white/12"
                          : "bg-white/5 ring-dashed ring-white/20"
                    }`}
                  >
                    {s ? (
                      <>
                        <div className="relative h-14 w-full overflow-hidden rounded-lg bg-black/40">
                          {showVid && showLocalVid ? (
                            <SeatVideo
                              stream={voice.localPreviewStream!}
                              mirror
                            />
                          ) : showVid && remoteVid ? (
                            <SeatVideo stream={remoteVid} />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <img
                                src={normalizeAvatar(s.avatar) || DEFAULT_AVATAR}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover ring-1 ring-white/30"
                              />
                            </div>
                          )}
                          {s.videoOn ? (
                            <span className="absolute right-0.5 top-0.5 rounded bg-rose-600 px-1 text-[7px] font-bold text-white">
                              CAM
                            </span>
                          ) : null}
                        </div>
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
                          <span className="mt-1 flex flex-wrap justify-center gap-0.5">
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
                            {s.videoOn ? (
                              <button
                                type="button"
                                className="rounded bg-amber-700 px-1 text-[8px] text-white"
                                onClick={() =>
                                  voice.forceVideoOffPeer(s.socketId)
                                }
                              >
                                Tắt cam
                              </button>
                            ) : null}
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
              Đóng popup vẫn giữ mic + PiP cam. «Rời ghế» mới thoát room.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
