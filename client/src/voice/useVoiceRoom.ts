import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getToken } from "../auth";
import { getIceServers } from "./ice";
import type {
  VoiceRoomId,
  VoiceRoomPublic,
  VoiceSeatIndex,
  VoiceSeatPublic,
  VoiceSignalData,
} from "./types";

export type VoiceStatus = "idle" | "joining" | "inRoom" | "error";

const VOICE_VOL_KEY = "tarot_voice_volumes_v1";

function loadVoiceVolumes(): {
  inputVolume: number;
  outputVolume: number;
  outputMuted: boolean;
} {
  try {
    const raw = localStorage.getItem(VOICE_VOL_KEY);
    if (!raw) {
      return { inputVolume: 100, outputVolume: 100, outputMuted: false };
    }
    const p = JSON.parse(raw) as Record<string, unknown>;
    const clamp = (n: unknown, d: number) => {
      const v = Math.floor(Number(n));
      if (!Number.isFinite(v)) return d;
      return Math.max(0, Math.min(100, v));
    };
    return {
      inputVolume: clamp(p.inputVolume, 100),
      outputVolume: clamp(p.outputVolume, 100),
      outputMuted: !!p.outputMuted,
    };
  } catch {
    return { inputVolume: 100, outputVolume: 100, outputMuted: false };
  }
}

function saveVoiceVolumes(v: {
  inputVolume: number;
  outputVolume: number;
  outputMuted: boolean;
}) {
  try {
    localStorage.setItem(VOICE_VOL_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

interface UseVoiceRoomOpts {
  socket: Socket | null;
  enabled?: boolean;
}

export function useVoiceRoom({ socket, enabled = true }: UseVoiceRoomOpts) {
  const initialVol = loadVoiceVolumes();
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lobby, setLobby] = useState<VoiceRoomPublic[]>([]);
  const [room, setRoom] = useState<VoiceRoomPublic | null>(null);
  const [seat, setSeat] = useState<VoiceSeatIndex | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [localMuted, setLocalMuted] = useState(false);
  const [forceMuted, setForceMuted] = useState(false);
  const [inputVolume, setInputVolumeState] = useState(initialVol.inputVolume);
  const [outputVolume, setOutputVolumeState] = useState(
    initialVol.outputVolume,
  );
  const [outputMuted, setOutputMutedState] = useState(initialVol.outputMuted);

  const localStreamRef = useRef<MediaStream | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const inputGainRef = useRef<GainNode | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const socketIdRef = useRef<string | null>(null);
  const outputVolumeRef = useRef(initialVol.outputVolume);
  const outputMutedRef = useRef(initialVol.outputMuted);
  const inputVolumeRef = useRef(initialVol.inputVolume);

  const token = () => getToken() ?? undefined;

  const cleanupPeer = useCallback((remoteId: string) => {
    const pc = pcsRef.current.get(remoteId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      pcsRef.current.delete(remoteId);
    }
    const audio = remoteAudioRef.current.get(remoteId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      remoteAudioRef.current.delete(remoteId);
    }
    makingOfferRef.current.delete(remoteId);
  }, []);

  const cleanupAllPeers = useCallback(() => {
    for (const id of [...pcsRef.current.keys()]) cleanupPeer(id);
  }, [cleanupPeer]);

  const applyOutputToAudio = useCallback((audio: HTMLAudioElement) => {
    const vol = outputMutedRef.current
      ? 0
      : Math.max(0, Math.min(1, outputVolumeRef.current / 100));
    audio.volume = vol;
    audio.muted = outputMutedRef.current;
  }, []);

  const applyOutputToAll = useCallback(() => {
    for (const audio of remoteAudioRef.current.values()) {
      applyOutputToAudio(audio);
    }
  }, [applyOutputToAudio]);

  const applyInputGain = useCallback(() => {
    const gain = inputGainRef.current;
    if (!gain) return;
    // 0–100 → 0–1 linear (đủ dùng chat voice)
    gain.gain.value = Math.max(0, Math.min(1, inputVolumeRef.current / 100));
  }, []);

  const stopLocalMedia = useCallback(() => {
    const processed = localStreamRef.current;
    if (processed) {
      for (const t of processed.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    const raw = rawMicStreamRef.current;
    if (raw) {
      for (const t of raw.getTracks()) t.stop();
      rawMicStreamRef.current = null;
    }
    inputGainRef.current = null;
    const ctx = audioCtxRef.current;
    if (ctx) {
      void ctx.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const ensureLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const raw = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    rawMicStreamRef.current = raw;

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
    const source = ctx.createMediaStreamSource(raw);
    const gain = ctx.createGain();
    inputGainRef.current = gain;
    gain.gain.value = Math.max(0, Math.min(1, inputVolumeRef.current / 100));
    const dest = ctx.createMediaStreamDestination();
    source.connect(gain);
    gain.connect(dest);

    localStreamRef.current = dest.stream;
    return dest.stream;
  }, []);

  const applyLocalMute = useCallback((muted: boolean) => {
    const raw = rawMicStreamRef.current;
    if (raw) {
      for (const t of raw.getAudioTracks()) t.enabled = !muted;
    }
    const processed = localStreamRef.current;
    if (processed) {
      for (const t of processed.getAudioTracks()) t.enabled = !muted;
    }
  }, []);

  const createPeer = useCallback(
    async (remoteId: string, asOfferer: boolean) => {
      if (!socket || pcsRef.current.has(remoteId)) return;
      const stream = await ensureLocalMedia();
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcsRef.current.set(remoteId, pc);

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        socket.emit("voice:signal", {
          toSocketId: remoteId,
          data: {
            type: "candidate",
            candidate: ev.candidate.toJSON(),
          } satisfies VoiceSignalData,
          token: token(),
        });
      };

      pc.ontrack = (ev) => {
        let audio = remoteAudioRef.current.get(remoteId);
        if (!audio) {
          audio = document.createElement("audio");
          audio.autoplay = true;
          audio.setAttribute("playsinline", "true");
          audio.style.display = "none";
          document.body.appendChild(audio);
          remoteAudioRef.current.set(remoteId, audio);
        }
        audio.srcObject = ev.streams[0] ?? null;
        applyOutputToAudio(audio);
        void audio.play().catch(() => {});
      };

      if (asOfferer) {
        makingOfferRef.current.add(remoteId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("voice:signal", {
            toSocketId: remoteId,
            data: {
              type: "offer",
              sdp: pc.localDescription!,
            } satisfies VoiceSignalData,
            token: token(),
          });
        } finally {
          makingOfferRef.current.delete(remoteId);
        }
      }
    },
    [socket, ensureLocalMedia, applyOutputToAudio],
  );

  const handleSignal = useCallback(
    async (fromSocketId: string, data: VoiceSignalData) => {
      if (!socket) return;
      let pc = pcsRef.current.get(fromSocketId);
      if (!pc) {
        await createPeer(fromSocketId, false);
        pc = pcsRef.current.get(fromSocketId);
      }
      if (!pc) return;

      try {
        if (data.type === "offer") {
          if (makingOfferRef.current.has(fromSocketId)) return;
          await pc.setRemoteDescription(data.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("voice:signal", {
            toSocketId: fromSocketId,
            data: {
              type: "answer",
              sdp: pc.localDescription!,
            } satisfies VoiceSignalData,
            token: token(),
          });
        } else if (data.type === "answer") {
          await pc.setRemoteDescription(data.sdp);
        } else if (data.type === "candidate" && data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch {
            /* ignore late candidates */
          }
        }
      } catch (err) {
        console.warn("[voice] signal error", err);
      }
    },
    [socket, createPeer],
  );

  const refreshLobby = useCallback(() => {
    if (!socket) return;
    socket.emit("voice:list");
  }, [socket]);

  const joinRoom = useCallback(
    async (roomId: VoiceRoomId, seat?: VoiceSeatIndex) => {
      if (!socket) {
        setError("Chưa kết nối");
        setStatus("error");
        return;
      }
      if (!getToken()) {
        setError("Cần đăng nhập để vào phòng voice");
        setStatus("error");
        return;
      }
      setStatus("joining");
      setError(null);
      try {
        await ensureLocalMedia();
      } catch {
        setError("Không mở được mic — kiểm tra quyền trình duyệt");
        setStatus("error");
        return;
      }

      await new Promise<void>((resolve) => {
        socket.emit(
          "voice:join",
          { roomId, seat, token: token() },
          (r: {
            ok?: boolean;
            reason?: string;
            room?: VoiceRoomPublic;
            seat?: VoiceSeatIndex;
            isHost?: boolean;
            peers?: VoiceSeatPublic[];
          }) => {
            if (!r?.ok || !r.room || !r.seat) {
              setError(r?.reason || "Không vào được phòng");
              setStatus("error");
              resolve();
              return;
            }
            setRoom(r.room);
            setSeat(r.seat);
            setIsHost(!!r.isHost);
            setStatus("inRoom");
            setForceMuted(false);
            void (async () => {
              for (const p of r.peers ?? []) {
                await createPeer(p.socketId, true);
              }
            })();
            resolve();
          },
        );
      });
    },
    [socket, ensureLocalMedia, createPeer],
  );

  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.emit("voice:leave", { token: token() });
    }
    cleanupAllPeers();
    stopLocalMedia();
    setRoom(null);
    setSeat(null);
    setIsHost(false);
    setLocalMuted(false);
    setForceMuted(false);
    setStatus("idle");
    setError(null);
  }, [socket, cleanupAllPeers, stopLocalMedia]);

  const toggleMute = useCallback(() => {
    if (forceMuted) return;
    const next = !localMuted;
    setLocalMuted(next);
    applyLocalMute(next);
    socket?.emit("voice:mute", { muted: next, token: token() });
  }, [forceMuted, localMuted, applyLocalMute, socket]);

  const setInputVolume = useCallback(
    (pct: number) => {
      const v = Math.max(0, Math.min(100, Math.floor(pct)));
      inputVolumeRef.current = v;
      setInputVolumeState(v);
      applyInputGain();
      saveVoiceVolumes({
        inputVolume: v,
        outputVolume: outputVolumeRef.current,
        outputMuted: outputMutedRef.current,
      });
    },
    [applyInputGain],
  );

  const setOutputVolume = useCallback(
    (pct: number) => {
      const v = Math.max(0, Math.min(100, Math.floor(pct)));
      outputVolumeRef.current = v;
      setOutputVolumeState(v);
      if (v > 0 && outputMutedRef.current) {
        outputMutedRef.current = false;
        setOutputMutedState(false);
      }
      applyOutputToAll();
      saveVoiceVolumes({
        inputVolume: inputVolumeRef.current,
        outputVolume: v,
        outputMuted: outputMutedRef.current,
      });
    },
    [applyOutputToAll],
  );

  const toggleOutputMute = useCallback(() => {
    const next = !outputMutedRef.current;
    outputMutedRef.current = next;
    setOutputMutedState(next);
    applyOutputToAll();
    saveVoiceVolumes({
      inputVolume: inputVolumeRef.current,
      outputVolume: outputVolumeRef.current,
      outputMuted: next,
    });
  }, [applyOutputToAll]);

  const moveSeat = useCallback(
    (nextSeat: VoiceSeatIndex) => {
      if (!socket) return;
      socket.emit(
        "voice:moveSeat",
        { seat: nextSeat, token: token() },
        (r: { ok?: boolean; reason?: string; seat?: VoiceSeatIndex }) => {
          if (!r?.ok) setError(r?.reason || "Không đổi ghế được");
          else if (r.seat) setSeat(r.seat);
        },
      );
    },
    [socket],
  );

  const kick = useCallback(
    (targetSocketId: string) => {
      socket?.emit("voice:kick", {
        targetSocketId,
        token: token(),
      });
    },
    [socket],
  );

  const forceMutePeer = useCallback(
    (targetSocketId: string, muted: boolean) => {
      socket?.emit("voice:forceMute", {
        targetSocketId,
        muted,
        token: token(),
      });
    },
    [socket],
  );

  const claimHost = useCallback(() => {
    socket?.emit(
      "voice:claimHost",
      { token: token() },
      (r: { ok?: boolean; reason?: string }) => {
        if (!r?.ok) setError(r?.reason || "Không claim host");
      },
    );
  }, [socket]);

  const setRoomOpen = useCallback(
    (open: boolean) => {
      socket?.emit(
        "voice:setOpen",
        { open, token: token() },
        (r: { ok?: boolean; reason?: string; room?: VoiceRoomPublic }) => {
          if (!r?.ok) setError(r?.reason || "Không đổi trạng thái phòng");
          else if (r.room) setRoom(r.room);
        },
      );
    },
    [socket],
  );

  useEffect(() => {
    if (!socket || !enabled) return;
    socketIdRef.current = socket.id ?? null;

    const onLobby = (rows: VoiceRoomPublic[]) => setLobby(rows);
    const onRoom = (r: VoiceRoomPublic) => {
      setRoom(r);
      const meId = socket.id;
      setIsHost(r.hostSocketId === meId);
      const mine = r.seats.find((s) => s?.socketId === meId);
      if (mine) {
        setSeat(mine.seat);
        setForceMuted(!!mine.forceMuted);
        if (mine.forceMuted) {
          setLocalMuted(true);
          applyLocalMute(true);
        }
      }
    };
    const onPeerJoined = (payload: {
      peer?: VoiceSeatPublic | null;
      room?: VoiceRoomPublic;
    }) => {
      if (payload.room) setRoom(payload.room);
      // Người mới join tự offer — peer cũ chờ offer
    };
    const onPeerLeft = (payload: {
      socketId?: string;
      room?: VoiceRoomPublic;
    }) => {
      if (payload.socketId) cleanupPeer(payload.socketId);
      if (payload.room) setRoom(payload.room);
    };
    const onSignal = (payload: {
      fromSocketId?: string;
      data?: VoiceSignalData;
    }) => {
      if (!payload.fromSocketId || !payload.data) return;
      void handleSignal(payload.fromSocketId, payload.data);
    };
    const onKicked = (payload: { reason?: string }) => {
      cleanupAllPeers();
      stopLocalMedia();
      setRoom(null);
      setSeat(null);
      setIsHost(false);
      setStatus("idle");
      setError(payload.reason || "Bạn bị mời ra khỏi phòng");
    };
    const onForceMuted = (payload: {
      muted?: boolean;
      room?: VoiceRoomPublic;
    }) => {
      const m = !!payload.muted;
      setForceMuted(m);
      setLocalMuted(m);
      applyLocalMute(m);
      if (payload.room) setRoom(payload.room);
    };
    const onError = (payload: { reason?: string }) => {
      setError(payload.reason || "Lỗi voice");
      setStatus("error");
    };

    socket.on("voice:lobby", onLobby);
    socket.on("voice:room", onRoom);
    socket.on("voice:peerJoined", onPeerJoined);
    socket.on("voice:peerLeft", onPeerLeft);
    socket.on("voice:signal", onSignal);
    socket.on("voice:kicked", onKicked);
    socket.on("voice:forceMuted", onForceMuted);
    socket.on("voice:error", onError);

    socket.emit("voice:list");

    return () => {
      socket.off("voice:lobby", onLobby);
      socket.off("voice:room", onRoom);
      socket.off("voice:peerJoined", onPeerJoined);
      socket.off("voice:peerLeft", onPeerLeft);
      socket.off("voice:signal", onSignal);
      socket.off("voice:kicked", onKicked);
      socket.off("voice:forceMuted", onForceMuted);
      socket.off("voice:error", onError);
    };
  }, [
    socket,
    enabled,
    cleanupPeer,
    cleanupAllPeers,
    stopLocalMedia,
    handleSignal,
    applyLocalMute,
  ]);

  // Rời voice khi unmount / mất socket — không đụng Tarot
  useEffect(() => {
    return () => {
      if (socket?.connected) {
        socket.emit("voice:leave", { token: token() });
      }
      cleanupAllPeers();
      stopLocalMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    error,
    setError,
    lobby,
    room,
    seat,
    isHost,
    localMuted,
    forceMuted,
    inputVolume,
    outputVolume,
    outputMuted,
    setInputVolume,
    setOutputVolume,
    toggleOutputMute,
    refreshLobby,
    joinRoom,
    leaveRoom,
    toggleMute,
    moveSeat,
    kick,
    forceMutePeer,
    claimHost,
    setRoomOpen,
  };
}
